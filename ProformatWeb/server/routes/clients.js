const express = require('express');
const mongoose = require('mongoose');
const Client = require('../models/Client');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const { HttpError, pick, escapeRegex } = require('../lib/helpers');
const { requirePermission } = require('../lib/auth');
const { logActivity } = require('../lib/activity');

const router = express.Router();
const FIELDS = ['name', 'activity', 'contactPerson', 'phone', 'email', 'address', 'taxNumber', 'notes', 'isArchived'];

// Solde dû par client et par devise (factures non annulées)
const balancesByClient = async (companyId, clientId) => {
  const match = { company: companyId, type: 'Facture', status: { $in: ['En attente', 'Partiellement payée', 'Payée'] }, clientId: clientId || { $ne: null } };
  const rows = await Invoice.aggregate([
    { $match: match },
    { $group: {
      _id: { client: '$clientId', currency: '$currency' },
      invoiced: { $sum: '$totalAmount' },
      paid: { $sum: '$amountPaid' },
      count: { $sum: 1 },
    } },
  ]);
  const map = {};
  for (const r of rows) {
    const key = String(r._id.client);
    map[key] = map[key] || { invoiceCount: 0, balances: {} };
    map[key].invoiceCount += r.count;
    map[key].balances[r._id.currency] = {
      invoiced: r.invoiced,
      paid: r.paid,
      due: Math.round((r.invoiced - r.paid) * 100) / 100,
    };
  }
  return map;
};

const findClient = async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Client introuvable.');
  const client = await Client.findOne({ _id: req.params.id, company: req.company._id });
  if (!client) throw new HttpError(404, 'Client introuvable.');
  return client;
};

router.get('/', async (req, res) => {
  const filter = { company: req.company._id };
  if (req.query.archived !== 'true') filter.isArchived = { $ne: true };
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ name: rx }, { activity: rx }, { phone: rx }, { email: rx }, { contactPerson: rx }];
  }
  const [clients, balances] = await Promise.all([
    Client.find(filter).sort({ name: 1 }).limit(1000),
    balancesByClient(req.company._id),
  ]);
  res.json(clients.map((c) => ({ ...c.toJSON(), ...(balances[String(c._id)] || { invoiceCount: 0, balances: {} }) })));
});

router.get('/:id', async (req, res) => {
  const client = await findClient(req);
  const invoices = await Invoice.find({ company: req.company._id, clientId: client._id }).sort({ issueDate: -1 }).limit(200);
  const [payments, balances] = await Promise.all([
    Payment.find({ company: req.company._id, invoice: { $in: invoices.map((i) => i._id) } }).sort({ date: -1 }).limit(200),
    balancesByClient(req.company._id, client._id),
  ]);
  res.json({ client, invoices, payments, ...(balances[String(client._id)] || { invoiceCount: 0, balances: {} }) });
});

router.post('/', requirePermission('clients.manage', 'invoices.create'), async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (!data.name?.trim()) throw new HttpError(400, 'Le nom du client est obligatoire.');
  const client = await Client.create({ ...data, company: req.company._id });
  await logActivity(req.user, 'Client', `Création du client ${client.name}`);
  res.status(201).json(client);
});

router.put('/:id', requirePermission('clients.manage'), async (req, res) => {
  const client = await findClient(req);
  client.set(pick(req.body, FIELDS));
  await client.save();
  // Seules les proformas en cours suivent la fiche ; une facture émise reste inchangée
  if (req.body.name) {
    await Invoice.updateMany({ company: req.company._id, clientId: client._id, type: 'Proforma', status: 'En attente' }, { $set: { client: client.name } });
  }
  await logActivity(req.user, 'Client', `Modification du client ${client.name}`);
  res.json(client);
});

router.delete('/:id', requirePermission('clients.delete'), async (req, res) => {
  const client = await findClient(req);
  if (await Invoice.exists({ company: req.company._id, clientId: client._id })) {
    // Un client ayant des factures est archivé, jamais supprimé
    client.isArchived = true;
    await client.save();
    await logActivity(req.user, 'Client', `Archivage du client ${client.name}`);
    return res.json({ archived: true, client });
  }
  await client.deleteOne();
  await logActivity(req.user, 'Client', `Suppression du client ${client.name}`);
  res.json({ success: true });
});

module.exports = router;
