const express = require('express');
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const { newPublicToken, TYPES } = require('../models/Invoice');
const Client = require('../models/Client');
const Payment = require('../models/Payment');
const { METHODS } = require('../models/Payment');
const PaymentNotice = require('../models/PaymentNotice');
const {
  HttpError, toNumber, round2, parseDate, escapeRegex, paginate, dateRangeFilter, CURRENCIES,
} = require('../lib/helpers');
const { requirePermission } = require('../lib/auth');
const { logActivity } = require('../lib/activity');
const { nextInvoiceNumber, peekInvoiceNumber } = require('../lib/counter');
const { applyInvoiceStock } = require('../lib/stock');

const router = express.Router();

const fmt = (amount, currency) => `${round2(amount).toFixed(2)} ${currency}`;

const resolveClient = async (companyId, body) => {
  if (body.clientId && mongoose.isValidObjectId(body.clientId)) {
    const client = await Client.findOne({ _id: body.clientId, company: companyId });
    if (client) return client;
  }
  const name = String(body.client || '').trim();
  if (!name) throw new HttpError(400, 'Le client est obligatoire.');
  // Crée automatiquement la fiche client si elle n'existe pas encore
  return (await Client.findOne({ company: companyId, name, isArchived: { $ne: true } }))
    || Client.create({ company: companyId, name, activity: body.clientActivity || '' });
};

const buildLines = (products) => {
  if (!Array.isArray(products) || products.length === 0) {
    throw new HttpError(400, 'Ajoutez au moins un article.');
  }
  return products.map((item) => {
    const name = String(item.name || '').trim();
    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    if (!name) throw new HttpError(400, 'Chaque article doit avoir une désignation.');
    if (quantity <= 0) throw new HttpError(400, `Quantité invalide pour « ${name} ».`);
    if (unitPrice < 0) throw new HttpError(400, `Prix invalide pour « ${name} ».`);
    return {
      productId: item.productId && mongoose.isValidObjectId(item.productId) ? item.productId : null,
      name,
      quantity,
      unitPrice: round2(unitPrice),
      lineTotal: round2(quantity * unitPrice),
    };
  });
};

// Construit les champs modifiables d'une facture ; les totaux sont toujours recalculés côté serveur
const buildInvoiceFields = async (body, settings) => {
  const client = await resolveClient(settings._id, body);
  const currency = CURRENCIES.includes(body.currency) ? body.currency : 'USD';
  const products = buildLines(body.products);
  const subtotal = round2(products.reduce((sum, l) => sum + l.lineTotal, 0));
  const discount = Math.min(subtotal, Math.max(0, round2(toNumber(body.discount))));
  const totalAmount = round2(subtotal - discount);
  const issueDate = parseDate(body.issueDate) || new Date();
  let dueDate = parseDate(body.dueDate);
  if (!dueDate && body.type === 'Facture' && settings.paymentTermDays) {
    dueDate = new Date(issueDate.getTime() + settings.paymentTermDays * 86400000);
  }
  return {
    clientId: client._id,
    client: client.name,
    clientActivity: body.clientActivity ?? client.activity ?? '',
    currency,
    exchangeRate: toNumber(body.exchangeRate) || settings.exchangeRate,
    products,
    subtotal,
    discount,
    totalAmount,
    issueDate,
    dueDate,
    notes: String(body.notes || ''),
    date: issueDate.toLocaleDateString('fr-FR'),
    total: fmt(totalAmount, currency),
  };
};

const refreshPaymentStatus = async (invoice) => {
  const [agg] = await Payment.aggregate([
    { $match: { invoice: invoice._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  invoice.amountPaid = round2(agg?.total || 0);
  if (!['Annulée', 'Convertie'].includes(invoice.status)) {
    if (invoice.amountPaid <= 0) invoice.status = 'En attente';
    else if (invoice.amountPaid + 0.005 >= invoice.totalAmount) invoice.status = 'Payée';
    else invoice.status = 'Partiellement payée';
  }
  await invoice.save();
  return invoice;
};

// Type de document demandé (facture par défaut)
const docType = (value) => (TYPES.includes(value) ? value : 'Facture');

const findInvoice = async (req) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Facture introuvable.');
  const invoice = await Invoice.findOne({ _id: id, company: req.company._id });
  if (!invoice) throw new HttpError(404, 'Facture introuvable.');
  return invoice;
};

router.get('/', async (req, res) => {
  const filter = { company: req.company._id };
  const { search, type, status, clientId, from, to, unpaid, overdue } = req.query;
  if (type) filter.type = String(type);
  if (status) filter.status = String(status);
  if (clientId && mongoose.isValidObjectId(clientId)) filter.clientId = clientId;
  const range = dateRangeFilter(from, to);
  if (range) filter.issueDate = range;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ number: rx }, { client: rx }, { clientActivity: rx }];
  }
  if (unpaid === 'true' || overdue === 'true') {
    filter.type = 'Facture';
    filter.status = { $in: ['En attente', 'Partiellement payée'] };
  }
  if (overdue === 'true') filter.dueDate = { $lt: new Date() };
  res.json(await paginate(Invoice, filter, req.query, { issueDate: -1, createdAt: -1 }, 15));
});

router.get('/next-number', async (req, res) => {
  res.json({ nextNumber: await peekInvoiceNumber(req.company._id, docType(req.query.type)) });
});

router.get('/:id', async (req, res) => {
  const invoice = await findInvoice(req);
  // Les factures créées avant la page client reçoivent leur lien à la première ouverture
  if (!invoice.publicToken) {
    invoice.publicToken = newPublicToken();
    await invoice.save();
  }
  const payments = await Payment.find({ invoice: invoice._id }).sort({ date: 1 });
  res.json({ ...invoice.toJSON(), payments });
});

router.post('/', requirePermission('invoices.create'), async (req, res) => {
  const settings = req.company;
  const type = docType(req.body.type);
  const fields = await buildInvoiceFields({ ...req.body, type }, settings);
  let number = String(req.body.number || '').trim();
  if (number) {
    if (await Invoice.exists({ company: req.company._id, number })) throw new HttpError(409, `Le numéro ${number} est déjà utilisé.`);
  } else {
    number = await nextInvoiceNumber(req.company._id, type, fields.issueDate);
  }
  const invoice = await Invoice.create({ ...fields, company: req.company._id, type, number, createdBy: req.user.email });
  if (type === 'Facture') {
    await applyInvoiceStock(invoice, req.user, -1);
    invoice.stockApplied = true;
    await invoice.save();
  }
  await logActivity(req.user, `Création ${type === 'Facture' ? 'de facture' : type === 'Proforma' ? 'de proforma' : 'de bon de commande'}`,
    `${type} N° ${number} pour ${invoice.client} — ${fmt(invoice.totalAmount, invoice.currency)}`);
  res.status(201).json(invoice);
});

// Seuls les proformas et bons de commande en attente sont modifiables ; une facture se corrige par annulation puis réémission
router.put('/:id', requirePermission('invoices.create'), async (req, res) => {
  const invoice = await findInvoice(req);
  if (invoice.type === 'Facture' || invoice.status !== 'En attente') {
    if (req.body.notes !== undefined || req.body.dueDate !== undefined) {
      if (req.body.notes !== undefined) invoice.notes = String(req.body.notes);
      if (req.body.dueDate !== undefined) invoice.dueDate = parseDate(req.body.dueDate);
      await invoice.save();
      return res.json(invoice);
    }
    throw new HttpError(400, 'Une facture émise ne peut plus être modifiée. Annulez-la puis créez-en une nouvelle.');
  }
  invoice.set(await buildInvoiceFields({ ...req.body, type: invoice.type }, req.company));
  await invoice.save();
  await logActivity(req.user, `Modification : ${invoice.type.toLowerCase()}`, `${invoice.type} N° ${invoice.number}`);
  res.json(invoice);
});

// Transforme une proforma acceptée ou un bon de commande en facture
router.post('/:id/convert', requirePermission('invoices.create'), async (req, res) => {
  const proforma = await findInvoice(req);
  if (proforma.type === 'Facture') throw new HttpError(400, 'Seuls une proforma ou un bon de commande peuvent être transformés en facture.');
  if (proforma.status !== 'En attente') throw new HttpError(400, `Ce document (${proforma.type.toLowerCase()}) a déjà été transformé ou annulé.`);
  const settings = req.company;
  const issueDate = new Date();
  const number = await nextInvoiceNumber(req.company._id, 'Facture', issueDate);
  const invoice = await Invoice.create({
    company: req.company._id,
    number,
    type: 'Facture',
    clientId: proforma.clientId,
    client: proforma.client,
    clientActivity: proforma.clientActivity,
    currency: proforma.currency,
    exchangeRate: proforma.exchangeRate,
    products: proforma.products,
    subtotal: proforma.subtotal,
    discount: proforma.discount,
    totalAmount: proforma.totalAmount,
    issueDate,
    dueDate: settings.paymentTermDays ? new Date(issueDate.getTime() + settings.paymentTermDays * 86400000) : null,
    notes: proforma.notes,
    sourceProforma: proforma._id,
    createdBy: req.user.email,
    date: issueDate.toLocaleDateString('fr-FR'),
    total: proforma.total,
  });
  await applyInvoiceStock(invoice, req.user, -1);
  invoice.stockApplied = true;
  await invoice.save();
  proforma.status = 'Convertie';
  proforma.convertedTo = invoice._id;
  await proforma.save();
  await logActivity(req.user, 'Transformation en facture', `${proforma.type} N° ${proforma.number} → Facture N° ${number}`);
  res.status(201).json(invoice);
});

router.post('/:id/cancel', requirePermission('invoices.cancel'), async (req, res) => {
  const invoice = await findInvoice(req);
  if (invoice.status === 'Annulée') throw new HttpError(400, 'Cette facture est déjà annulée.');
  if (invoice.amountPaid > 0) throw new HttpError(400, 'Supprimez d\'abord les paiements enregistrés sur cette facture.');
  if (invoice.stockApplied) {
    await applyInvoiceStock(invoice, req.user, 1);
    invoice.stockApplied = false;
  }
  invoice.status = 'Annulée';
  if (req.body.reason) invoice.notes = `${invoice.notes ? `${invoice.notes}\n` : ''}Annulation : ${req.body.reason}`;
  await invoice.save();
  await logActivity(req.user, 'Annulation', `${invoice.type} N° ${invoice.number}${req.body.reason ? ` — ${req.body.reason}` : ''}`);
  res.json(invoice);
});

// ---- Paiements ----
// Enregistre un encaissement sur une facture (saisi au bureau ou paiement annoncé par le client puis confirmé)
const recordPayment = async (req, invoice, body) => {
  if (invoice.type !== 'Facture') throw new HttpError(400, 'Les paiements ne s\'enregistrent que sur une facture.');
  if (['Annulée', 'Convertie'].includes(invoice.status)) throw new HttpError(400, 'Cette facture est annulée.');
  const amount = round2(toNumber(body.amount));
  if (amount <= 0) throw new HttpError(400, 'Montant invalide.');
  const balance = round2(invoice.totalAmount - invoice.amountPaid);
  if (amount > balance + 0.005) throw new HttpError(400, `Le montant dépasse le solde restant (${fmt(balance, invoice.currency)}).`);
  const payment = await Payment.create({
    company: req.company._id,
    invoice: invoice._id,
    invoiceNumber: invoice.number,
    client: invoice.client,
    amount,
    currency: invoice.currency,
    method: METHODS.includes(body.method) ? body.method : 'Espèces',
    date: parseDate(body.date) || new Date(),
    reference: String(body.reference || ''),
    note: String(body.note || ''),
    createdBy: req.user.email,
  });
  await refreshPaymentStatus(invoice);
  await logActivity(req.user, 'Encaissement', `${fmt(amount, invoice.currency)} sur la facture N° ${invoice.number} (${payment.method})`);
  return payment;
};

router.post('/:id/payments', requirePermission('payments.create'), async (req, res) => {
  const invoice = await findInvoice(req);
  const payment = await recordPayment(req, invoice, req.body);
  res.status(201).json({ invoice, payment });
});

// ---- Paiements annoncés par le client (« J'ai payé » sur sa page) ----
const MOBILE_PROVIDERS = ['M-Pesa', 'Orange Money', 'Airtel Money', 'Africell Money'];
const methodForProvider = (provider) => {
  if (MOBILE_PROVIDERS.includes(provider)) return 'Mobile Money';
  if (provider === 'Paiement en ligne') return 'Carte';
  return 'Virement';
};

const findNotice = async (req, invoice) => {
  if (!mongoose.isValidObjectId(req.params.noticeId)) throw new HttpError(404, 'Paiement annoncé introuvable.');
  const notice = await PaymentNotice.findOne({ _id: req.params.noticeId, invoice: invoice._id, company: req.company._id });
  if (!notice) throw new HttpError(404, 'Paiement annoncé introuvable.');
  if (notice.status !== 'En attente') throw new HttpError(400, `Ce paiement a déjà été ${notice.status === 'Confirmé' ? 'confirmé' : 'refusé'}.`);
  return notice;
};

router.get('/:id/notices', async (req, res) => {
  const invoice = await findInvoice(req);
  res.json(await PaymentNotice.find({ invoice: invoice._id, company: req.company._id }).sort({ createdAt: -1 }).lean());
});

router.post('/:id/notices/:noticeId/confirm', requirePermission('payments.create'), async (req, res) => {
  const invoice = await findInvoice(req);
  const notice = await findNotice(req, invoice);
  // Réservé d'abord : deux confirmations simultanées n'encaissent jamais deux fois
  const claimed = await PaymentNotice.findOneAndUpdate(
    { _id: notice._id, status: 'En attente' },
    { status: 'Confirmé', handledBy: req.user.email, handledAt: new Date() },
    { new: true },
  );
  if (!claimed) throw new HttpError(400, 'Ce paiement a déjà été traité.');
  let payment;
  try {
    payment = await recordPayment(req, invoice, {
      amount: req.body.amount !== undefined ? req.body.amount : notice.amount,
      method: methodForProvider(notice.provider), reference: notice.reference,
      note: [`Annoncé par le client (${notice.provider})`, notice.payerName, notice.payerPhone].filter(Boolean).join(' · '),
    });
  } catch (err) {
    await PaymentNotice.updateOne({ _id: notice._id }, { status: 'En attente', handledBy: '', $unset: { handledAt: 1 } });
    throw err;
  }
  claimed.payment = payment._id;
  await claimed.save();
  res.json({ invoice, payment, notice: claimed });
});

router.post('/:id/notices/:noticeId/reject', requirePermission('payments.create'), async (req, res) => {
  const invoice = await findInvoice(req);
  const notice = await findNotice(req, invoice);
  Object.assign(notice, { status: 'Refusé', handledBy: req.user.email, handledAt: new Date() });
  await notice.save();
  await logActivity(req.user, 'Paiement refusé', `${fmt(notice.amount, notice.currency)} annoncé sur la facture N° ${invoice.number} (réf. ${notice.reference})`);
  res.json({ notice });
});

router.delete('/:id/payments/:paymentId', requirePermission('payments.delete'), async (req, res) => {
  const invoice = await findInvoice(req);
  const payment = await Payment.findOneAndDelete({ _id: req.params.paymentId, invoice: invoice._id });
  if (!payment) throw new HttpError(404, 'Paiement introuvable.');
  await refreshPaymentStatus(invoice);
  await logActivity(req.user, 'Suppression d\'encaissement', `${fmt(payment.amount, payment.currency)} sur la facture N° ${invoice.number}`);
  res.json(invoice);
});

module.exports = router;
module.exports.refreshPaymentStatus = refreshPaymentStatus;
