const express = require('express');
const Client = require('../models/Client');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const { HttpError, pick, escapeRegex } = require('../lib/helpers');
const { requireRole } = require('../lib/auth');
const { logActivity } = require('../lib/activity');

const router = express.Router();
const FIELDS = ['name', 'activity', 'contactPerson', 'phone', 'email', 'address', 'taxNumber', 'notes', 'isArchived'];

// Solde dû par client et par devise (factures non annulées)
const balancesByClient = async () => {
  const rows = await Invoice.aggregate([
    { $match: { type: 'Facture', status: { $in: ['En attente', 'Partiellement payée', 'Payée'] }, clientId: { $ne: null } } },
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

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.archived !== 'true') filter.isArchived = { $ne: true };
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ name: rx }, { activity: rx }, { phone: rx }, { email: rx }, { contactPerson: rx }];
  }
  const [clients, balances] = await Promise.all([Client.find(filter).sort({ name: 1 }).limit(1000), balancesByClient()]);
  res.json(clients.map((c) => ({ ...c.toJSON(), ...(balances[String(c._id)] || { invoiceCount: 0, balances: {} }) })));
});

router.get('/:id', async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) throw new HttpError(404, 'Client introuvable.');
  const [invoices, payments, balances] = await Promise.all([
    Invoice.find({ clientId: client._id }).sort({ issueDate: -1 }).limit(200),
    Payment.find({ invoice: { $in: await Invoice.find({ clientId: client._id }).distinct('_id') } }).sort({ date: -1 }).limit(200),
    balancesByClient(),
  ]);
  res.json({ client, invoices, payments, ...(balances[String(client._id)] || { invoiceCount: 0, balances: {} }) });
});

router.post('/', async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (!data.name?.trim()) throw new HttpError(400, 'Le nom du client est obligatoire.');
  const client = await Client.create(data);
  await logActivity(req.user, 'Client', `Création du client ${client.name}`);
  res.status(201).json(client);
});

router.put('/:id', async (req, res) => {
  const client = await Client.findByIdAndUpdate(req.params.id, pick(req.body, FIELDS), { returnDocument: 'after', runValidators: true });
  if (!client) throw new HttpError(404, 'Client introuvable.');
  // Seules les proformas en cours suivent la fiche ; une facture émise reste inchangée
  if (req.body.name) await Invoice.updateMany({ clientId: client._id, type: 'Proforma', status: 'En attente' }, { $set: { client: client.name } });
  await logActivity(req.user, 'Client', `Modification du client ${client.name}`);
  res.json(client);
});

router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) throw new HttpError(404, 'Client introuvable.');
  if (await Invoice.exists({ clientId: client._id })) {
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
