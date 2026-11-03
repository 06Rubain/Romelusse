const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const Invoice = require('../models/Invoice');
const { startDb, stopDb, setupPlatform, createCompany, client } = require('./helpers');

let app;
let superToken;
let adminToken;
let company;

before(async () => {
  app = await startDb();
  superToken = await setupPlatform(app);
  ({ company, token: adminToken } = await createCompany(app, superToken, 'Imprimerie Lien', 'admin@lien.cd'));
  await client(app, adminToken).put('/api/company', { paymentLink: 'vpos.flexpaie.com/pay/FPG_DRC', paymentMethods: ['M-Pesa', 'Visa'] }).expect(200);
});
after(stopDb);

test('page client : la facture s\'ouvre sans compte avec son lien secret', async () => {
  const admin = client(app, adminToken);
  const created = (await admin.post('/api/invoices', {
    type: 'Facture', client: 'Client Lien', currency: 'USD', products: [{ name: 'Flyers', quantity: 2, unitPrice: 15 }],
  }).expect(201)).body;
  await admin.post(`/api/invoices/${created._id}/payments`, { amount: 10 }).expect(201);
  const { publicToken } = (await admin.get(`/api/invoices/${created._id}`).expect(200)).body;
  assert.ok(/^[A-Za-z0-9_-]{24}$/.test(publicToken));

  const res = await request(app).get(`/api/public/invoices/${publicToken}`).expect(200);
  assert.strictEqual(res.body.invoice.number, created.number);
  assert.strictEqual(res.body.invoice.balance, 20);
  assert.strictEqual(res.body.company.name, 'Imprimerie Lien');
  assert.strictEqual(res.body.company.paymentLink, 'https://vpos.flexpaie.com/pay/FPG_DRC');
  assert.ok(res.body.company.paymentQr.startsWith('data:image/png'));
  // Rien d'interne : ni identifiants, ni auteur, ni lien secret
  assert.strictEqual(res.body.invoice.createdBy, undefined);
  assert.strictEqual(res.body.invoice._id, undefined);
  assert.strictEqual(res.body.company._id, undefined);
  assert.strictEqual(res.body.company.exchangeRate, undefined);
  assert.ok(!JSON.stringify(res.body).includes(publicToken));

  // Le lien est stable d'une ouverture à l'autre
  assert.strictEqual((await admin.get(`/api/invoices/${created._id}`).expect(200)).body.publicToken, publicToken);

  await request(app).get('/api/public/invoices/inconnu-mais-assez-long-pour-le-format').expect(404);
  await request(app).get('/api/public/invoices/court').expect(404);

  // Entreprise suspendue : la page n'est plus accessible
  await client(app, superToken).put(`/api/platform/companies/${company._id}`, { isActive: false }).expect(200);
  await request(app).get(`/api/public/invoices/${publicToken}`).expect(404);
  await client(app, superToken).put(`/api/platform/companies/${company._id}`, { isActive: true }).expect(200);
});

test('page client : une facture créée avant cette fonction reçoit un lien stable', async () => {
  const admin = client(app, adminToken);
  const created = (await admin.post('/api/invoices', { client: 'Ancien client', products: [{ name: 'Bâche', quantity: 1, unitPrice: 50 }] }).expect(201)).body;
  await Invoice.collection.updateOne({ _id: Invoice.castObject({ _id: created._id })._id }, { $unset: { publicToken: '' } });

  const first = (await admin.get(`/api/invoices/${created._id}`).expect(200)).body.publicToken;
  const second = (await admin.get(`/api/invoices/${created._id}`).expect(200)).body.publicToken;
  assert.ok(first);
  assert.strictEqual(first, second);
  await request(app).get(`/api/public/invoices/${first}`).expect(200);
});

test('comptes de paiement et « J\'ai payé » : annoncé par le client, confirmé ou refusé par l\'entreprise', async () => {
  const admin = client(app, adminToken);
  const saved = (await admin.put('/api/company', { paymentAccounts: [
    { provider: 'Airtel Money', number: ' 0990000001 ', holder: 'Imprimerie Lien' },
    { provider: 'Inconnu', number: '0810000002' },
    { provider: 'Orange Money', number: '' },
  ] }).expect(200)).body;
  assert.deepStrictEqual(saved.paymentAccounts.map((a) => [a.provider, a.number]), [['Airtel Money', '0990000001'], ['Autre', '0810000002']]);

  const created = (await admin.post('/api/invoices', {
    type: 'Facture', client: 'Client Mobile', currency: 'USD', products: [{ name: 'Bâche', quantity: 1, unitPrice: 50 }],
  }).expect(201)).body;
  const { publicToken } = (await admin.get(`/api/invoices/${created._id}`).expect(200)).body;
  const page = (await request(app).get(`/api/public/invoices/${publicToken}`).expect(200)).body;
  assert.strictEqual(page.company.paymentAccounts[0].number, '0990000001');
  assert.deepStrictEqual(page.notices, []);

  const notice = (body) => request(app).post(`/api/public/invoices/${publicToken}/notices`).send(body);
  await notice({ provider: 'M-Pesa', amount: 50, reference: 'ABC123' }).expect(400); // pas de compte M-Pesa
  await notice({ provider: 'Airtel Money', amount: 80, reference: 'ABC123' }).expect(400); // plus que le reste
  await notice({ provider: 'Airtel Money', amount: 50, reference: '' }).expect(400);
  const sent = (await notice({ provider: 'Airtel Money', amount: 30, reference: 'MP2611.1234', payerPhone: '0991112233' }).expect(201)).body;
  assert.strictEqual(sent.notices[0].status, 'En attente');
  assert.strictEqual(sent.notices[0].payerPhone, undefined);
  await notice({ provider: 'Paiement en ligne', amount: 20, reference: 'FLEX-99' }).expect(201);

  const pending = (await admin.get('/api/payments/notices').expect(200)).body;
  assert.strictEqual(pending.length, 2);
  const list = (await admin.get(`/api/invoices/${created._id}/notices`).expect(200)).body;
  const airtel = list.find((n) => n.provider === 'Airtel Money');
  const flex = list.find((n) => n.provider === 'Paiement en ligne');

  const confirmed = (await admin.post(`/api/invoices/${created._id}/notices/${airtel._id}/confirm`).expect(200)).body;
  assert.strictEqual(confirmed.payment.method, 'Mobile Money');
  assert.strictEqual(confirmed.payment.reference, 'MP2611.1234');
  assert.strictEqual(confirmed.invoice.balance, 20);
  await admin.post(`/api/invoices/${created._id}/notices/${airtel._id}/confirm`).expect(400);
  await admin.post(`/api/invoices/${created._id}/notices/${flex._id}/reject`).expect(200);
  assert.strictEqual((await admin.get('/api/payments/notices').expect(200)).body.length, 0);
  const after = (await request(app).get(`/api/public/invoices/${publicToken}`).expect(200)).body;
  assert.deepStrictEqual(after.notices.map((n) => n.status).sort(), ['Confirmé', 'Refusé']);
  assert.strictEqual(after.invoice.balance, 20);
});
