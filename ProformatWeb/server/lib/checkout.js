const crypto = require('crypto');
const Company = require('../models/Company');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const OnlinePayment = require('../models/OnlinePayment');
const flexpay = require('./flexpay');
const pawapay = require('./pawapay');

const PROVIDER_API = { flexpay, pawapay };
const PROVIDER_NAME = { flexpay: 'FlexPaie', pawapay: 'pawaPay' };
const { HttpError, round2 } = require('./helpers');
const { decryptSecret } = require('./secret');
const { logActivity } = require('./activity');

// Moyens proposés sur la page de paiement du client
const MOBILE_METHODS = ['M-Pesa', 'Orange Money', 'Airtel Money', 'Africell Money'];
const CARD_METHOD = 'Carte bancaire';
const CHECKOUT_METHODS = [...MOBILE_METHODS, CARD_METHOD];

const CHECK_INTERVAL_MS = 3000;
const EXPIRY_MS = { mobile: 10 * 60 * 1000, card: 60 * 60 * 1000 };
// Mode essai : le paiement réussit après quelques secondes (numéro finissant par 000 : refusé)
const DEMO_DELAY_MS = Number(process.env.CHECKOUT_DEMO_DELAY_MS || 5000);

// Paiement en ligne disponible pour cette entreprise ? Mode, prestataire, identifiants et moyens proposés
const checkoutConfig = async (companyId) => {
  const company = await Company.findById(companyId)
    .select('+flexpayToken +pawapayToken checkoutMode flexpayMerchant paymentProvider pawapayEnv').lean();
  if (!company || company.checkoutMode === 'off' || !company.checkoutMode) return null;
  if (company.checkoutMode === 'demo') return { mode: 'demo', provider: 'demo', methods: CHECKOUT_METHODS };
  if (company.paymentProvider === 'pawapay') {
    const token = decryptSecret(company.pawapayToken);
    if (!token) return null;
    const env = company.pawapayEnv === 'live' ? 'live' : 'sandbox';
    // Environnement de test pawaPay : vrais appels, mais pas d'argent réel
    return { mode: env === 'live' ? 'live' : 'sandbox', provider: 'pawapay', env, token, methods: pawapay.METHODS };
  }
  const token = decryptSecret(company.flexpayToken);
  if (!(company.flexpayMerchant && token)) return null;
  return { mode: 'live', provider: 'flexpay', merchant: company.flexpayMerchant, token, methods: CHECKOUT_METHODS };
};

const balanceOf = (invoice) => round2(invoice.totalAmount - invoice.amountPaid);

// Enregistre l'encaissement d'un paiement en ligne réussi (une seule fois, même si le résultat arrive deux fois)
const settle = async (online, providerReference = '') => {
  const claimed = await OnlinePayment.findOneAndUpdate(
    { _id: online._id, status: 'En cours' },
    { status: 'Réussi', message: 'Paiement reçu.' },
    { returnDocument: 'after' },
  );
  if (!claimed) return OnlinePayment.findById(online._id);
  const invoice = await Invoice.findById(online.invoice);
  const payment = await Payment.create({
    company: online.company, invoice: online.invoice, invoiceNumber: online.invoiceNumber, client: online.client,
    amount: online.amount, currency: online.currency, method: online.channel === 'card' ? 'Carte' : 'Mobile Money',
    date: new Date(), reference: providerReference || online.orderNumber || online.reference,
    note: `Paiement en ligne${online.mode === 'demo' ? ' (essai)' : ''} · ${online.method}${online.phone ? ` · ${online.phone}` : ''}`,
    createdBy: 'Paiement en ligne',
  });
  claimed.payment = payment._id;
  await claimed.save();
  if (invoice) {
    // Même calcul que l'encaissement au bureau
    const { refreshPaymentStatus } = require('../routes/invoices');
    await refreshPaymentStatus(invoice);
  }
  await logActivity('Paiement en ligne', 'Encaissement', `${online.amount.toFixed(2)} ${online.currency} sur la facture N° ${online.invoiceNumber} (${online.method}${online.mode === 'demo' ? ', essai' : ''})`, online.company);
  return claimed;
};

// Mode essai : la page montre un paiement réussi, mais rien n'est encaissé et la facture ne change pas
// (un mode essai oublié ne peut jamais faire passer une facture en « Payée » sans argent)
const demoComplete = async (online, message = 'Essai réussi : aucun argent débité, la facture n\'a pas changé.') => (await OnlinePayment.findOneAndUpdate(
  { _id: online._id, status: 'En cours' },
  { status: 'Réussi', message },
  { returnDocument: 'after' },
)) || OnlinePayment.findById(online._id);

// Montant et devise réellement payés chez FlexPaie (s'ils sont connus) : doivent correspondre à la demande
const amountMatches = (online, result) => {
  if (result.amount !== undefined && Number.isFinite(result.amount) && Math.abs(result.amount - online.amount) > 0.01) return false;
  const expected = online.currency === 'FC' ? 'CDF' : 'USD';
  if (result.currency && !['CDF', 'FC', 'USD'].includes(result.currency)) return false;
  if (result.currency && (result.currency === 'FC' ? 'CDF' : result.currency) !== expected) return false;
  return true;
};

const fail = async (online, message) => (await OnlinePayment.findOneAndUpdate(
  { _id: online._id, status: 'En cours' }, { status: 'Échoué', message }, { returnDocument: 'after' },
)) || OnlinePayment.findById(online._id);

// Démarre un paiement depuis la page du client
const startCheckout = async ({ invoice, company, method, phone, origin, apiOrigin, token }) => {
  const config = await checkoutConfig(company._id);
  if (!config) throw new HttpError(400, 'Le paiement en ligne n\'est pas activé pour cette entreprise.');
  if (invoice.type !== 'Facture') throw new HttpError(400, 'Seule une facture se paie en ligne.');
  if (['Annulée', 'Convertie', 'Payée'].includes(invoice.status)) throw new HttpError(400, 'Cette facture n\'attend plus de paiement.');
  if (!config.methods.includes(method)) throw new HttpError(400, 'Choisissez un moyen de paiement.');
  const amount = balanceOf(invoice);
  if (!(amount > 0)) throw new HttpError(400, 'Cette facture est déjà réglée.');
  const channel = method === CARD_METHOD ? 'card' : 'mobile';
  const msisdn = channel === 'mobile' ? flexpay.normalizePhone(phone) : '';
  if (channel === 'mobile' && !msisdn) throw new HttpError(400, 'Numéro invalide : saisissez votre numéro Mobile Money (ex. 0991234567).');

  const recent = await OnlinePayment.findOne({ invoice: invoice._id, status: 'En cours', channel: 'mobile', createdAt: { $gt: new Date(Date.now() - 90 * 1000) } });
  if (recent && channel === 'mobile') throw new HttpError(409, 'Un paiement est déjà en attente de confirmation sur un téléphone. Patientez une minute.');

  const online = await OnlinePayment.create({
    company: company._id, invoice: invoice._id, invoiceNumber: invoice.number, client: invoice.client, mode: config.mode, provider: config.provider,
    method, channel, phone: msisdn, amount, currency: invoice.currency,
    reference: `${invoice.number}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    callbackKey: crypto.randomBytes(18).toString('base64url'),
  });
  const returnUrl = `${origin}/p/${token}?paiement=${online._id}`;

  // En production, le paiement réel n'utilise que des adresses https
  const { isProduction } = require('./origin');
  if (config.mode === 'live' && isProduction() && !(origin.startsWith('https://') && apiOrigin.startsWith('https://'))) {
    await fail(online, 'Adresse non sécurisée.');
    throw new HttpError(400, 'Le paiement en ligne exige une adresse sécurisée (https).');
  }

  if (config.mode === 'demo') {
    online.orderNumber = `ESSAI-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    await online.save();
    return { online, redirectUrl: channel === 'card' ? returnUrl : null };
  }

  const fpCurrency = invoice.currency === 'FC' ? 'CDF' : 'USD';
  const callbackUrl = `${apiOrigin}/api/public/flexpay/callback/${online._id}/${online.callbackKey}`;
  const result = config.provider === 'pawapay'
    ? await pawapay.startDeposit({ env: config.env, token: config.token, method, phone: msisdn, amount, currency: fpCurrency, reference: online.reference })
    : channel === 'card'
    ? await flexpay.startCard({ merchant: config.merchant, token: config.token, reference: online.reference, amount, currency: fpCurrency, callbackUrl, returnUrl })
    : await flexpay.startMobile({ merchant: config.merchant, token: config.token, phone: msisdn, reference: online.reference, amount, currency: fpCurrency, callbackUrl });
  if (!result.ok) {
    await fail(online, result.message);
    throw new HttpError(502, `Paiement non lancé : ${result.message}`);
  }
  online.orderNumber = result.orderNumber || '';
  await online.save();
  return { online, redirectUrl: result.url || null };
};

// Met à jour un paiement en cours (appelé par la page du client toutes les quelques secondes et par FlexPaie)
const refreshCheckout = async (online, { force = false } = {}) => {
  if (online.status !== 'En cours') return online;
  const age = Date.now() - new Date(online.createdAt).getTime();
  if (!force && online.lastCheckedAt && Date.now() - new Date(online.lastCheckedAt).getTime() < CHECK_INTERVAL_MS) return online;
  await OnlinePayment.updateOne({ _id: online._id }, { lastCheckedAt: new Date() });

  if (online.mode === 'demo') {
    if (age < DEMO_DELAY_MS && online.channel === 'mobile') return online;
    if (online.phone.endsWith('000')) return fail(online, 'Paiement refusé (essai : numéro se terminant par 000).');
    return demoComplete(online);
  }

  const config = await checkoutConfig(online.company);
  const provider = online.provider || 'flexpay';
  if (config && config.provider === provider && PROVIDER_API[provider]) {
    const result = await PROVIDER_API[provider].check({ env: config.env, token: config.token, orderNumber: online.orderNumber });
    if (result.status === 'success') {
      if (!amountMatches(online, result)) {
        await logActivity('Paiement en ligne', 'Alerte paiement', `Montant ${PROVIDER_NAME[provider]} différent sur ${online.invoiceNumber} : attendu ${online.amount} ${online.currency}, reçu ${result.amount} ${result.currency || ''} (commande ${online.orderNumber})`, online.company);
        return fail(online, `Montant reçu différent du montant demandé : l'entreprise va vérifier avec ${PROVIDER_NAME[provider]}.`);
      }
      // Environnement de test : la page montre la réussite, mais rien n'est encaissé
      if (online.mode === 'sandbox') return demoComplete(online, `Test ${PROVIDER_NAME[provider]} réussi : aucun argent réel, la facture n'a pas changé.`);
      return settle(online, result.providerReference);
    }
    if (result.status === 'failed') return fail(online, result.message);
  }
  if (age > EXPIRY_MS[online.channel]) return fail(online, 'Paiement non confirmé à temps.');
  return online;
};

module.exports = { checkoutConfig, startCheckout, refreshCheckout, CHECKOUT_METHODS, MOBILE_METHODS, CARD_METHOD };
