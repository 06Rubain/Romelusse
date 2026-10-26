const { test, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { startDb, stopDb } = require('./helpers');
const { migrateLegacyData } = require('../lib/migrate');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Client = require('../models/Client');

before(startDb);
after(stopDb);

test('migration des données de l\'ancienne version', async () => {
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

  await migrateLegacyData();
  await migrateLegacyData(); // idempotente

  const a4 = await Product.findById(legacyProductId);
  assert.strictEqual(a4.unitPrice, 300);
  assert.strictEqual(a4.currency, 'FC');
  const rollup = await Product.findOne({ name: 'Roll-Up' });
  assert.strictEqual(rollup.priceOnQuote, true);

  const paid = await Invoice.findOne({ number: 'FAC-0001' });
  assert.strictEqual(paid.totalAmount, 2);
  assert.strictEqual(paid.currency, 'USD');
  assert.strictEqual(paid.amountPaid, 2);
  assert.strictEqual(paid.issueDate.toISOString().slice(0, 10), '2026-03-15');
  assert.strictEqual(String(paid.products[0].productId), String(legacyProductId));
  assert.strictEqual(paid.products[0].unitPrice, 0.13);

  const pro = await Invoice.findOne({ number: 'FAC-0002' });
  assert.strictEqual(pro.type, 'Proforma');
  assert.strictEqual(pro.products[0].productId, null);

  assert.strictEqual(await Payment.countDocuments(), 1);
  const clients = await Client.find();
  assert.strictEqual(clients.length, 1);
  assert.strictEqual(clients[0].activity, 'École');
  assert.strictEqual(String(paid.clientId), String(clients[0]._id));
});
