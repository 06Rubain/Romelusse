process.env.CHECKOUT_DEMO_DELAY_MS = '0';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { startDb, stopDb, setupPlatform, createCompany, client } = require('./helpers');
const OnlinePayment = require('../models/OnlinePayment');

let app;
let admin;

before(async () => {
  app = await startDb();
  const superToken = await setupPlatform(app);
  const { token } = await createCompany(app, superToken, 'Imprimerie Caisse', 'admin@caisse.cd');
  admin = client(app, token);
});
after(stopDb);

const newInvoice = async (amount = 40) => {
  const inv = (await admin.post('/api/invoices', {
    type: 'Facture', client: 'Client En Ligne', currency: 'USD', products: [{ name: 'Flyers', quantity: 1, unitPrice: amount }],
  }).expect(201)).body;
  return (await admin.get(`/api/invoices/${inv._id}`).expect(200)).body;
};

test('paiement en ligne désactivé par défaut', async () => {
  const inv = await newInvoice();
  const page = (await request(app).get(`/api/public/invoices/${inv.publicToken}`).expect(200)).body;
  assert.strictEqual(page.checkout, null);
  await request(app).post(`/api/public/invoices/${inv.publicToken}/checkout`).send({ method: 'M-Pesa', phone: '0812345678' }).expect(400);
});

test('mode essai : Mobile Money encaissé automatiquement, numéro en 000 refusé', async () => {
  const company = (await admin.put('/api/company', { checkoutMode: 'demo' }).expect(200)).body;
  assert.strictEqual(company.checkoutMode, 'demo');
  const inv = await newInvoice(40);
  const page = (await request(app).get(`/api/public/invoices/${inv.publicToken}`).expect(200)).body;
  assert.strictEqual(page.checkout.mode, 'demo');
  assert.ok(page.checkout.methods.includes('Orange Money'));

  await request(app).post(`/api/public/invoices/${inv.publicToken}/checkout`).send({ method: 'M-Pesa', phone: '12' }).expect(400);
  const refused = (await request(app).post(`/api/public/invoices/${inv.publicToken}/checkout`).send({ method: 'Airtel Money', phone: '0991234000' }).expect(201)).body;
  const refusedState = (await request(app).get(`/api/public/invoices/${inv.publicToken}/checkout/${refused.id}`).expect(200)).body;
  assert.strictEqual(refusedState.status, 'Échoué');

  const started = (await request(app).post(`/api/public/invoices/${inv.publicToken}/checkout`).send({ method: 'Orange Money', phone: '+243 898 765 432' }).expect(201)).body;
  assert.strictEqual(started.status, 'En cours');
  assert.strictEqual(started.amount, 40);
  assert.ok(!JSON.stringify(started).includes('898765432'));
  const done = (await request(app).get(`/api/public/invoices/${inv.publicToken}/checkout/${started.id}`).expect(200)).body;
  assert.strictEqual(done.status, 'Réussi');
  assert.strictEqual(done.invoice.status, 'Payée');
  // Un deuxième passage n'encaisse pas deux fois
  await request(app).get(`/api/public/invoices/${inv.publicToken}/checkout/${started.id}`).expect(200);
  const after = (await admin.get(`/api/invoices/${inv._id}`).expect(200)).body;
  assert.strictEqual(after.payments.length, 1);
  assert.strictEqual(after.payments[0].method, 'Mobile Money');
  assert.strictEqual(after.amountPaid, 40);
  await request(app).post(`/api/public/invoices/${inv.publicToken}/checkout`).send({ method: 'M-Pesa', phone: '0812345678' }).expect(400);
});

test('mode réel : appels FlexPaie (Mobile Money et carte), clé jamais renvoyée', async () => {
  const saved = (await admin.put('/api/company', { checkoutMode: 'live', flexpayMerchant: 'FPG_DRC', flexpayToken: 'secret-token-123' }).expect(200)).body;
  assert.strictEqual(saved.flexpayToken, undefined);
  assert.strictEqual(saved.flexpayTokenSet, true);
  const again = (await admin.put('/api/company', { flexpayToken: '' }).expect(200)).body;
  assert.strictEqual(again.flexpayTokenSet, true);
  assert.ok(!JSON.stringify((await admin.get('/api/company').expect(200)).body).includes('secret-token-123'));

  const calls = [];
  const realFetch = global.fetch;
  let txStatus = '2';
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const body = options.body ? JSON.parse(options.body) : null;
    const reply = (json) => ({ status: 200, text: async () => JSON.stringify(json) });
    if (body?.type === '1') return reply({ code: '0', message: 'Transaction envoyée', orderNumber: 'ORD-1' });
    if (body?.type === '2') return reply({ code: '0', message: 'ok', orderNumber: 'ORD-2', url: 'https://cardpayment.flexpay.cd/checkout/abc' });
    if (String(url).endsWith('/check/ORD-1')) return reply({ code: '0', transaction: { status: txStatus, reference: 'x' } });
    return reply({ code: '1', message: 'inconnu' });
  };
  try {
    const inv = await newInvoice(25);
    const started = (await request(app).post(`/api/public/invoices/${inv.publicToken}/checkout`)
      .set('Origin', 'https://app.example.cd').send({ method: 'M-Pesa', phone: '0812345678' }).expect(201)).body;
    const pay = calls.find((c) => c.options.body);
    const sent = JSON.parse(pay.options.body);
    assert.strictEqual(pay.options.headers.Authorization, 'Bearer secret-token-123');
    assert.deepStrictEqual([sent.merchant, sent.type, sent.phone, sent.amount, sent.currency], ['FPG_DRC', '1', '243812345678', '25', 'USD']);
    assert.ok(sent.callback_url.includes('/api/public/flexpay/callback/'));

    const pending = (await request(app).get(`/api/public/invoices/${inv.publicToken}/checkout/${started.id}`).expect(200)).body;
    assert.strictEqual(pending.status, 'En cours');
    txStatus = '0';
    // FlexPaie prévient : l'état est revérifié auprès de FlexPaie, puis la facture est réglée
    const online = await OnlinePayment.findById(started.id);
    await request(app).post(`/api/public/flexpay/callback/${online._id}/mauvaise-cle`).send({ code: '0' }).expect(200);
    assert.strictEqual((await OnlinePayment.findById(started.id)).status, 'En cours');
    await request(app).post(`/api/public/flexpay/callback/${online._id}/${online.callbackKey}`).send({ code: '0' }).expect(200);
    assert.strictEqual((await OnlinePayment.findById(started.id)).status, 'Réussi');
    assert.strictEqual((await admin.get(`/api/invoices/${inv._id}`).expect(200)).body.status, 'Payée');

    const inv2 = await newInvoice(10);
    const card = (await request(app).post(`/api/public/invoices/${inv2.publicToken}/checkout`)
      .set('Origin', 'https://app.example.cd').send({ method: 'Carte bancaire' }).expect(201)).body;
    assert.strictEqual(card.redirectUrl, 'https://cardpayment.flexpay.cd/checkout/abc');
    const cardBody = JSON.parse(calls.filter((c) => c.options.body).pop().options.body);
    assert.strictEqual(cardBody.approve_url, `https://app.example.cd/p/${inv2.publicToken}?paiement=${card.id}`);
  } finally {
    global.fetch = realFetch;
  }
});
