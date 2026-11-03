const crypto = require('crypto');
const Company = require('../models/Company');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const OnlinePayment = require('../models/OnlinePayment');
const flexpay = require('./flexpay');
const { HttpError, round2 } = require('./helpers');
const { logActivity } = require('./activity');

// Moyens proposés sur la page de paiement du client
const MOBILE_METHODS = ['M-Pesa', 'Orange Money', 'Airtel Money', 'Africell Money'];
const CARD_METHOD = 'Carte bancaire';
const CHECKOUT_METHODS = [...MOBILE_METHODS, CARD_METHOD];

const CHECK_INTERVAL_MS = 3000;
const EXPIRY_MS = { mobile: 10 * 60 * 1000, card: 60 * 60 * 1000 };
// Mode essai : le paiement réussit après quelques secondes (numéro finissant par 000 : refusé)
const DEMO_DELAY_MS = Number(process.env.CHECKOUT_DEMO_DELAY_MS || 5000);

// Paiement en ligne disponible pour cette entreprise ? (mode réel : identifiants FlexPaie enregistrés)
const checkoutConfig = async (companyId) => {
  const company = await Company.findById(companyId).select('+flexpayToken checkoutMode flexpayMerchant').lean();
  if (!company || company.checkoutMode === 'off' || !company.checkoutMode) return null;
  if (company.checkoutMode === 'live' && !(company.flexpayMerchant && company.flexpayToken)) return null;
  return { mode: company.checkoutMode, merchant: company.flexpayMerchant, token: company.flexpayToken };
};

const balanceOf = (invoice) => round2(invoice.totalAmount - invoice.amountPaid);

// Enregistre l'encaissement d'un paiement en ligne réussi (une seule fois, même si le résultat arrive deux fois)
const settle = async (online, providerReference = '') => {
  const claimed = await OnlinePayment.findOneAndUpdate(
    { _id: online._id, status: 'En cours' },
    { status: 'Réussi', message: 'Paiement reçu.' },
    { new: true },
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

const fail = async (online, message) => (await OnlinePayment.findOneAndUpdate(
  { _id: online._id, status: 'En cours' }, { status: 'Échoué', message }, { new: true },
)) || OnlinePayment.findById(online._id);

// Démarre un paiement depuis la page du client
const startCheckout = async ({ invoice, company, method, phone, origin, apiOrigin, token }) => {
  const config = await checkoutConfig(company._id);
  if (!config) throw new HttpError(400, 'Le paiement en ligne n\'est pas activé pour cette entreprise.');
  if (invoice.type !== 'Facture') throw new HttpError(400, 'Seule une facture se paie en ligne.');
  if (['Annulée', 'Convertie', 'Payée'].includes(invoice.status)) throw new HttpError(400, 'Cette facture n\'attend plus de paiement.');
  if (!CHECKOUT_METHODS.includes(method)) throw new HttpError(400, 'Choisissez un moyen de paiement.');
  const amount = balanceOf(invoice);
  if (!(amount > 0)) throw new HttpError(400, 'Cette facture est déjà réglée.');
  const channel = method === CARD_METHOD ? 'card' : 'mobile';
  const msisdn = channel === 'mobile' ? flexpay.normalizePhone(phone) : '';
  if (channel === 'mobile' && !msisdn) throw new HttpError(400, 'Numéro invalide : saisissez votre numéro Mobile Money (ex. 0991234567).');

  const recent = await OnlinePayment.findOne({ invoice: invoice._id, status: 'En cours', channel: 'mobile', createdAt: { $gt: new Date(Date.now() - 90 * 1000) } });
  if (recent && channel === 'mobile') throw new HttpError(409, 'Un paiement est déjà en attente de confirmation sur un téléphone. Patientez une minute.');

  const online = await OnlinePayment.create({
    company: company._id, invoice: invoice._id, invoiceNumber: invoice.number, client: invoice.client, mode: config.mode,
    method, channel, phone: msisdn, amount, currency: invoice.currency,
    reference: `${invoice.number}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    callbackKey: crypto.randomBytes(18).toString('base64url'),
  });
  const returnUrl = `${origin}/p/${token}?paiement=${online._id}`;

  if (config.mode === 'demo') {
    online.orderNumber = `ESSAI-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    await online.save();
    return { online, redirectUrl: channel === 'card' ? returnUrl : null };
  }

  const fpCurrency = invoice.currency === 'FC' ? 'CDF' : 'USD';
  const callbackUrl = `${apiOrigin}/api/public/flexpay/callback/${online._id}/${online.callbackKey}`;
  const result = channel === 'card'
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
    return settle(online, online.orderNumber);
  }

  const config = await checkoutConfig(online.company);
  if (config?.mode === 'live') {
    const result = await flexpay.check({ token: config.token, orderNumber: online.orderNumber });
    if (result.status === 'success') return settle(online, result.providerReference);
    if (result.status === 'failed') return fail(online, result.message);
  }
  if (age > EXPIRY_MS[online.channel]) return fail(online, 'Paiement non confirmé à temps.');
  return online;
};

module.exports = { checkoutConfig, startCheckout, refreshCheckout, CHECKOUT_METHODS, MOBILE_METHODS, CARD_METHOD };
