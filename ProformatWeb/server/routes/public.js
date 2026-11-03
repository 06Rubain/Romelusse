const express = require('express');
const Invoice = require('../models/Invoice');
const Company = require('../models/Company');
const InvoiceTemplate = require('../models/InvoiceTemplate');
const rateLimit = require('express-rate-limit');
const PaymentNotice = require('../models/PaymentNotice');
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
  const custom = template?.mode === 'custom' && template.background;

  res.set('Cache-Control', 'no-store');
  res.json({
    invoice: pickFields(invoice.toJSON(), INVOICE_FIELDS),
    company: pickFields(company.toJSON(), COMPANY_FIELDS),
    notices: invoice.type === 'Facture' ? await noticesOf(invoice) : [],
    template: custom ? pickFields(serializeTemplate(template), ['mode', 'background', 'pageSize', 'zones', 'style', 'labels']) : null,
  });
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
