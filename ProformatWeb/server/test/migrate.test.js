const { test, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { startDb, stopDb } = require('./helpers');
const { migrateLegacyData } = require('../lib/migrate');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Client = require('../models/Client');
const Company = require('../models/Company');
const User = require('../models/User');
const Role = require('../models/Role');

before(startDb);
after(stopDb);

test('migration des données existantes vers l\'entreprise Mélanine Print', async () => {
  const db = mongoose.connection.db;
  const legacyProductId = new mongoose.Types.ObjectId();
  await Product.collection.insertMany([
    { _id: legacyProductId, name: 'Papier ordinaire A4', price: '300 FC', description: '' },
    { name: 'Roll-Up', price: 'Sur devis', description: '' },
  ]);
  await Invoice.collection.insertMany([
    {
      number: 'FAC-0001', client: 'Client Historique', clientActivity: 'École', type: 'Facture', date: '15/03/2026',
      total: '2.00 USD', status: 'Payée', createdAt: new Date('2026-03-15'), updatedAt: new Date('2026-03-16'),
      products: [{ id: String(legacyProductId), name: 'Papier ordinaire A4', price: '300 FC', quantity: 15 }],
    },
    {
      number: 'FAC-0002', client: 'Client Historique', type: 'Proforma', date: '20/03/2026',
      total: '50.00 USD', status: 'En attente', products: [{ id: 'manual-1', name: 'Logo', price: '50 USD', quantity: 1 }],
    },
  ]);
  await User.collection.insertMany([
    { uid: 'a', email: 'patron@melanine.cd', role: 'admin' },
    { uid: 'b', email: 'caissier@melanine.cd', role: 'user' },
  ]);
  await db.collection('settings').insertOne({ _id: 'company', companyName: 'Mélanine Print', exchangeRate: 2300 });
  await db.collection('counters').insertOne({ _id: 'FAC-2026', seq: 7 });

  await migrateLegacyData();
  await migrateLegacyData(); // idempotente

  const companies = await Company.find();
  assert.strictEqual(companies.length, 1);
  const company = companies[0];
  assert.strictEqual(company.exchangeRate, 2300);
  assert.match(company.logo, /^data:image\/png;base64,/);
  assert.strictEqual(await Role.countDocuments({ company: company._id }), 3);

  const patron = await User.findOne({ email: 'patron@melanine.cd' }).populate('roleId');
  assert.strictEqual(String(patron.company), String(company._id));
  assert.strictEqual(patron.roleId.name, 'Administrateur');
  assert.strictEqual((await User.findOne({ email: 'caissier@melanine.cd' }).populate('roleId')).roleId.name, 'Employé');

  const a4 = await Product.findById(legacyProductId);
  assert.strictEqual(a4.unitPrice, 300);
  assert.strictEqual(a4.currency, 'FC');
  assert.strictEqual(String(a4.company), String(company._id));
  assert.strictEqual((await Product.findOne({ name: 'Roll-Up' })).priceOnQuote, true);

  const paid = await Invoice.findOne({ number: 'FAC-0001' });
  assert.strictEqual(String(paid.company), String(company._id));
  assert.strictEqual(paid.totalAmount, 2);
  assert.strictEqual(paid.amountPaid, 2);
  assert.strictEqual(paid.issueDate.toISOString().slice(0, 10), '2026-03-15');
  assert.strictEqual(paid.products[0].unitPrice, 0.13);
  assert.strictEqual((await Invoice.findOne({ number: 'FAC-0002' })).type, 'Proforma');

  const payments = await Payment.find();
  assert.strictEqual(payments.length, 1);
  assert.strictEqual(String(payments[0].company), String(company._id));
  const clients = await Client.find();
  assert.strictEqual(clients.length, 1);
  assert.strictEqual(String(clients[0].company), String(company._id));
  assert.strictEqual(String(paid.clientId), String(clients[0]._id));

  const counter = await db.collection('counters').findOne({ _id: `${company._id}:FAC-2026` });
  assert.strictEqual(counter.seq, 7);
  assert.strictEqual(await db.collection('counters').countDocuments({ _id: 'FAC-2026' }), 0);
});
