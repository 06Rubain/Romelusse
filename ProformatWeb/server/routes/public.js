const express = require('express');
const Invoice = require('../models/Invoice');
const Company = require('../models/Company');
const InvoiceTemplate = require('../models/InvoiceTemplate');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const PaymentNotice = require('../models/PaymentNotice');
const OnlinePayment = require('../models/OnlinePayment');
const {
  checkoutConfig, startCheckout, refreshCheckout,
} = require('../lib/checkout');
const { ACCOUNT_PROVIDERS } = require('../lib/company');
const { HttpError, toNumber, round2 } = require('../lib/helpers');
const { serialize: serializeTemplate } = require('./template');

// Pages publiques, sans compte : un client ouvre sa facture avec le lien secret reçu (WhatsApp, e-mail…)
const router = express.Router();

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

const COMPANY_FIELDS = ['name', 'logo', 'footerImage', 'primaryColor', 'secondaryColor', 'accentColor', 'legalName', 'address', 'city',
  'email', 'phone', 'taxNumber', 'nationalId', 'rccm', 'bankName', 'bankAccount', 'signature', 'paymentLink', 'paymentQr', 'paymentMethods', 'paymentAccounts'];

const INVOICE_FIELDS = ['number', 'type', 'client', 'clientActivity', 'issueDate', 'dueDate', 'currency', 'products', 'subtotal', 'discount',
  'totalAmount', 'amountPaid', 'balance', 'status', 'notes'];

const pickFields = (doc, fields) => Object.fromEntries(fields.map((f) => [f, doc[f]]));

const MAX_PENDING_NOTICES = 3;
const NOTICE_CLIENT_FIELDS = ['provider', 'amount', 'currency', 'reference', 'status', 'createdAt'];

// Facture et entreprise d'un lien secret
const loadByToken = async (token) => {
  const notFound = new HttpError(404, 'Ce lien de facture n\'est pas valide ou a été retiré.');
  if (!TOKEN.test(token)) throw notFound;
  const invoice = await Invoice.findOne({ publicToken: token });
  if (!invoice) throw notFound;
  const company = await Company.findById(invoice.company);
  if (!company || !company.isActive) throw notFound;
  return { invoice, company };
};

const noticesOf = async (invoice) => (await PaymentNotice.find({ invoice: invoice._id }).sort({ createdAt: -1 }).limit(10).lean())
  .map((n) => pickFields(n, NOTICE_CLIENT_FIELDS));

router.get('/invoices/:token', async (req, res) => {
  const { invoice, company } = await loadByToken(req.params.token);
  const template = await InvoiceTemplate.findOne({ company: company._id });
  const checkout = invoice.type === 'Facture' ? await checkoutConfig(company._id) : null;
  const custom = template?.mode === 'custom' && template.background;

  res.set('Cache-Control', 'no-store');
  res.json({
    invoice: pickFields(invoice.toJSON(), INVOICE_FIELDS),
    company: pickFields(company.toJSON(), COMPANY_FIELDS),
    notices: invoice.type === 'Facture' ? await noticesOf(invoice) : [],
    checkout: checkout ? { mode: checkout.mode, provider: checkout.provider, methods: checkout.methods } : null,
    template: custom ? pickFields(serializeTemplate(template), ['mode', 'background', 'pageSize', 'zones', 'style', 'labels']) : null,
  });
});

// ---- Paiement en ligne sur la page du client ----
const checkoutLimit = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Trop de tentatives de paiement. Réessayez plus tard ou appelez l\'entreprise.' },
});

const { appOrigin, apiOrigin } = require('../lib/origin');

const onlineView = (online, invoice) => ({
  id: online._id, status: online.status, message: online.message, method: online.method, channel: online.channel,
  amount: online.amount, currency: online.currency, mode: online.mode, phone: online.phone ? `+${online.phone.slice(0, 3)} ${online.phone.slice(3, 5)}•••${online.phone.slice(-3)}` : '',
  invoice: invoice ? { status: invoice.status, amountPaid: invoice.amountPaid, balance: invoice.balance } : undefined,
});

router.post('/invoices/:token/checkout', checkoutLimit, async (req, res) => {
  const { invoice, company } = await loadByToken(req.params.token);
  const { online, redirectUrl } = await startCheckout({
    invoice, company, method: String(req.body.method || ''), phone: req.body.phone,
    origin: appOrigin(req), apiOrigin: apiOrigin(req), token: req.params.token,
  });
  res.status(201).json({ ...onlineView(online), redirectUrl });
});

router.get('/invoices/:token/checkout/:id', async (req, res) => {
  const { invoice } = await loadByToken(req.params.token);
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Paiement introuvable.');
  let online = await OnlinePayment.findOne({ _id: req.params.id, invoice: invoice._id });
  if (!online) throw new HttpError(404, 'Paiement introuvable.');
  online = await refreshCheckout(online);
  const fresh = await Invoice.findById(invoice._id);
  res.set('Cache-Control', 'no-store');
  res.json(onlineView(online, fresh.toJSON()));
});

// Notification de FlexPaie : on ne croit pas le contenu, on redemande l'état à FlexPaie
router.post('/flexpay/callback/:id/:key', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.json({ received: true });
  const online = await OnlinePayment.findOne({ _id: req.params.id, callbackKey: String(req.params.key) });
  if (online) {
    const orderNumber = req.body?.orderNumber || req.body?.order_number;
    if (!online.orderNumber && orderNumber && (req.body?.reference === online.reference)) {
      online.orderNumber = String(orderNumber).slice(0, 80);
      await online.save();
    }
    await refreshCheckout(online, { force: true });
  }
  res.json({ received: true });
});

// Notification de pawaPay (adresse à saisir dans le tableau de bord pawaPay) : on ne croit pas le contenu,
// on redemande l'état du paiement à pawaPay avec la clé de l'entreprise
router.post('/pawapay/callback', async (req, res) => {
  const depositId = String(req.body?.depositId || req.body?.data?.depositId || '');
  if (/^[0-9a-f-]{36}$/i.test(depositId)) {
    const online = await OnlinePayment.findOne({ orderNumber: depositId, provider: 'pawapay' });
    if (online) await refreshCheckout(online, { force: true });
  }
  res.json({ received: true });
});

// « J'ai payé » : le client annonce un paiement fait sur un compte de l'entreprise ; rien n'est encaissé avant confirmation
router.post('/invoices/:token/notices', rateLimit({
  windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Trop de tentatives. Réessayez dans une heure ou appelez l\'entreprise.' },
}), async (req, res) => {
  const { invoice, company } = await loadByToken(req.params.token);
  if (invoice.type !== 'Facture') throw new HttpError(400, 'Un paiement s\'annonce sur une facture.');
  if (['Annulée', 'Convertie', 'Payée'].includes(invoice.status)) throw new HttpError(400, 'Cette facture n\'attend plus de paiement.');
  const provider = String(req.body.provider || '').trim();
  const known = company.paymentAccounts.some((a) => a.provider === provider) || (company.paymentLink && provider === 'Paiement en ligne');
  if (!known || !(ACCOUNT_PROVIDERS.includes(provider) || provider === 'Paiement en ligne')) throw new HttpError(400, 'Choisissez le moyen utilisé pour payer.');
  const amount = round2(toNumber(req.body.amount));
  const balance = round2(invoice.totalAmount - invoice.amountPaid);
  if (!(amount > 0)) throw new HttpError(400, 'Indiquez le montant payé.');
  if (amount > balance + 0.005) throw new HttpError(400, 'Le montant dépasse le reste à payer.');
  const reference = String(req.body.reference || '').trim().slice(0, 80);
  if (reference.length < 3) throw new HttpError(400, 'Indiquez la référence de la transaction (reçue par SMS).');
  const pending = await PaymentNotice.countDocuments({ invoice: invoice._id, status: 'En attente' });
  if (pending >= MAX_PENDING_NOTICES) throw new HttpError(429, 'Des paiements annoncés attendent déjà la vérification de l\'entreprise.');
  await PaymentNotice.create({
    company: company._id, invoice: invoice._id, invoiceNumber: invoice.number, client: invoice.client,
    provider, amount, currency: invoice.currency, reference,
    payerName: String(req.body.payerName || '').trim().slice(0, 80), payerPhone: String(req.body.payerPhone || '').trim().slice(0, 30),
  });
  res.status(201).json({ notices: await noticesOf(invoice) });
});

module.exports = router;
