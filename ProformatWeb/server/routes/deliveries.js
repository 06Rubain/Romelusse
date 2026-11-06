const express = require('express');
const mongoose = require('mongoose');
const DeliveryNote = require('../models/DeliveryNote');
const Invoice = require('../models/Invoice');
const {
  HttpError, toNumber, parseDate, escapeRegex, paginate, dateRangeFilter,
} = require('../lib/helpers');
const { requirePermission } = require('../lib/auth');
const { logActivity } = require('../lib/activity');
const { nextDeliveryNumber, peekDeliveryNumber } = require('../lib/counter');

const router = express.Router();

const findInvoice = async (req, id) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Document d\'origine introuvable.');
  const invoice = await Invoice.findOne({ _id: id, company: req.company._id });
  if (!invoice) throw new HttpError(404, 'Document d\'origine introuvable.');
  return invoice;
};

// Quantités déjà livrées, ligne par ligne, pour un document d'origine (bons de livraison non annulés)
const deliveredSoFar = async (companyId, invoiceId, exceptId = null) => {
  const notes = await DeliveryNote.find({ company: companyId, invoice: invoiceId, status: 'Livré', ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).lean();
  const totals = {};
  for (const n of notes) for (const l of n.lines) if (l.source !== null && l.source !== undefined) totals[l.source] = (totals[l.source] || 0) + l.delivered;
  return { totals, count: notes.length };
};

// Lignes proposées pour un nouveau bon de livraison : commandé, déjà livré, reste à livrer
const linesFor = async (companyId, invoice) => {
  const { totals, count } = await deliveredSoFar(companyId, invoice._id);
  return {
    previousDeliveries: count,
    lines: invoice.products.map((p, i) => {
      const already = totals[i] || 0;
      return { source: i, name: p.name, ordered: p.quantity, already, remaining: Math.max(0, p.quantity - already) };
    }),
  };
};

router.get('/', async (req, res) => {
  const filter = { company: req.company._id };
  const range = dateRangeFilter(req.query.from, req.query.to);
  if (range) filter.date = range;
  if (req.query.invoice && mongoose.isValidObjectId(req.query.invoice)) filter.invoice = req.query.invoice;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ number: rx }, { client: rx }, { invoiceNumber: rx }];
  }
  res.json(await paginate(DeliveryNote, filter, req.query, { date: -1, createdAt: -1 }, 20));
});

router.get('/next-number', async (req, res) => {
  res.json({ nextNumber: await peekDeliveryNumber(req.company._id) });
});

// Préparation d'un bon de livraison depuis une facture ou un bon de commande
router.get('/prepare/:invoiceId', async (req, res) => {
  const invoice = await findInvoice(req, req.params.invoiceId);
  res.json({
    invoice: { _id: invoice._id, number: invoice.number, type: invoice.type, client: invoice.client, clientActivity: invoice.clientActivity, status: invoice.status },
    ...(await linesFor(req.company._id, invoice)),
    nextNumber: await peekDeliveryNumber(req.company._id),
  });
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Bon de livraison introuvable.');
  const note = await DeliveryNote.findOne({ _id: req.params.id, company: req.company._id });
  if (!note) throw new HttpError(404, 'Bon de livraison introuvable.');
  res.json(note);
});

router.post('/', requirePermission('invoices.create'), async (req, res) => {
  const body = req.body || {};
  let invoice = null;
  let lines;
  if (body.invoiceId) {
    invoice = await findInvoice(req, body.invoiceId);
    if (invoice.type === 'Proforma') throw new HttpError(400, 'Une proforma ne se livre pas : transformez-la d\'abord en facture ou en bon de commande.');
    if (invoice.status === 'Annulée') throw new HttpError(400, 'Ce document est annulé.');
    const { lines: base } = await linesFor(req.company._id, invoice);
    const wanted = new Map((Array.isArray(body.lines) ? body.lines : []).map((l) => [Number(l.source), toNumber(l.delivered)]));
    lines = base.map((l) => {
      const delivered = wanted.has(l.source) ? wanted.get(l.source) : l.remaining;
      if (!(delivered >= 0)) throw new HttpError(400, `Quantité livrée invalide pour « ${l.name} ».`);
      if (delivered > l.remaining + 1e-9) throw new HttpError(400, `« ${l.name} » : ${delivered} livré(s) alors qu'il ne reste que ${l.remaining} à livrer.`);
      return { source: l.source, name: l.name, ordered: l.ordered, delivered };
    }).filter((l) => l.delivered > 0);
    if (!lines.length) throw new HttpError(400, 'Rien à livrer : indiquez au moins une quantité livrée.');
  } else {
    // Livraison libre (sans document d'origine)
    lines = (Array.isArray(body.lines) ? body.lines : []).map((l) => ({
      name: String(l.name || '').trim(), ordered: Math.max(0, toNumber(l.ordered)), delivered: toNumber(l.delivered), source: null,
    })).filter((l) => l.name);
    if (!lines.length) throw new HttpError(400, 'Ajoutez au moins un article.');
    for (const l of lines) if (!(l.delivered >= 0)) throw new HttpError(400, `Quantité livrée invalide pour « ${l.name} ».`);
  }
  const client = String(invoice ? invoice.client : body.client || '').trim();
  if (!client) throw new HttpError(400, 'Le client est obligatoire.');
  const date = parseDate(body.date) || new Date();
  const note = await DeliveryNote.create({
    company: req.company._id,
    number: await nextDeliveryNumber(req.company._id, date),
    invoice: invoice?._id || null,
    invoiceNumber: invoice?.number || '',
    client,
    clientActivity: invoice ? invoice.clientActivity : String(body.clientActivity || ''),
    deliveryAddress: String(body.deliveryAddress || '').trim().slice(0, 300),
    date,
    lines,
    deliveredBy: String(body.deliveredBy || '').trim().slice(0, 120),
    receivedBy: String(body.receivedBy || '').trim().slice(0, 120),
    notes: String(body.notes || '').slice(0, 2000),
    createdBy: req.user.email,
  });
  await logActivity(req.user, 'Livraison', `Bon de livraison N° ${note.number}${invoice ? ` (${invoice.type} ${invoice.number})` : ''} pour ${client}`);
  res.status(201).json(note);
});

router.post('/:id/cancel', requirePermission('invoices.cancel'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Bon de livraison introuvable.');
  const note = await DeliveryNote.findOne({ _id: req.params.id, company: req.company._id });
  if (!note) throw new HttpError(404, 'Bon de livraison introuvable.');
  if (note.status === 'Annulé') throw new HttpError(400, 'Ce bon de livraison est déjà annulé.');
  note.status = 'Annulé';
  if (req.body?.reason) note.notes = `${note.notes ? `${note.notes}\n` : ''}Annulation : ${String(req.body.reason).slice(0, 300)}`;
  await note.save();
  await logActivity(req.user, 'Annulation', `Bon de livraison N° ${note.number}`);
  res.json(note);
});

module.exports = router;
module.exports.deliveredSoFar = deliveredSoFar;
