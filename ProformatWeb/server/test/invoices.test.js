const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startDb, stopDb, setupPlatform, createCompany, createUser, client } = require('./helpers');

let app;
let admin;
let adminToken;
let superToken;
let product;

before(async () => {
  app = await startDb();
  superToken = await setupPlatform(app);
  ({ token: adminToken } = await createCompany(app, superToken, 'Mélanine Print', 'admin@melanine.cd'));
  admin = client(app, adminToken);
  await admin.put('/api/company', { exchangeRate: 2000, paymentTermDays: 15 }).expect(200);
  product = (await admin.post('/api/products', {
    name: 'Bâche 1x1 m', unitPrice: 8, currency: 'USD', trackStock: true, minStock: 5, initialStock: 10,
  }).expect(201)).body;
});
after(stopDb);

test('le produit est créé avec son stock initial', async () => {
  assert.strictEqual(product.stockQuantity, 10);
  assert.strictEqual(product.price, '8 USD');
});

test('cycle complet d\'une facture : stock, paiements, annulation', async () => {
  const year = new Date().getFullYear();
  const created = await admin.post('/api/invoices', {
    type: 'Facture',
    client: 'Société Alpha',
    currency: 'USD',
    discount: 4,
    products: [
      { productId: product._id, name: product.name, quantity: 3, unitPrice: 8 },
      { name: 'Pose', quantity: 1, unitPrice: 10 },
    ],
  }).expect(201);
  const inv = created.body;
  assert.strictEqual(inv.number, `FAC-${year}-0001`);
  assert.strictEqual(inv.subtotal, 34);
  assert.strictEqual(inv.totalAmount, 30);
  assert.ok(inv.clientId, 'la fiche client est créée automatiquement');
  assert.ok(inv.dueDate, 'l\'échéance suit le délai de paiement');

  let prod = (await admin.get('/api/products?search=Bâche').expect(200)).body[0];
  assert.strictEqual(prod.stockQuantity, 7);

  await admin.post(`/api/invoices/${inv._id}/payments`, { amount: 50 }).expect(400);
  const partial = await admin.post(`/api/invoices/${inv._id}/payments`, { amount: 10, method: 'Mobile Money' }).expect(201);
  assert.strictEqual(partial.body.invoice.status, 'Partiellement payée');
  assert.strictEqual(partial.body.invoice.balance, 20);

  const full = await admin.post(`/api/invoices/${inv._id}/payments`, { amount: 20 }).expect(201);
  assert.strictEqual(full.body.invoice.status, 'Payée');

  // Une facture émise n'est plus modifiable ni annulable tant qu'elle a des paiements
  await admin.put(`/api/invoices/${inv._id}`, { client: 'Autre', products: [{ name: 'x', quantity: 1, unitPrice: 1 }] }).expect(400);
  await admin.post(`/api/invoices/${inv._id}/cancel`).expect(400);

  const detail = await admin.get(`/api/invoices/${inv._id}`).expect(200);
  assert.strictEqual(detail.body.payments.length, 2);
  for (const p of detail.body.payments) {
    await admin.del(`/api/invoices/${inv._id}/payments/${p._id}`).expect(200);
  }
  const cancelled = await admin.post(`/api/invoices/${inv._id}/cancel`, { reason: 'Erreur de saisie' }).expect(200);
  assert.strictEqual(cancelled.body.status, 'Annulée');
  prod = (await admin.get('/api/products?search=Bâche').expect(200)).body[0];
  assert.strictEqual(prod.stockQuantity, 10);

  const movements = await admin.get(`/api/products/movements?product=${product._id}`).expect(200);
  assert.strictEqual(movements.body.total, 3);
});

test('proforma : modification puis conversion en facture', async () => {
  const pro = (await admin.post('/api/invoices', {
    type: 'Proforma', client: 'Société Beta', currency: 'FC',
    products: [{ productId: product._id, name: product.name, quantity: 2, unitPrice: 16000 }],
  }).expect(201)).body;
  assert.match(pro.number, /^PRO-\d{4}-0001$/);
  assert.strictEqual(pro.stockApplied, false);

  const edited = await admin.put(`/api/invoices/${pro._id}`, {
    client: 'Société Beta', currency: 'FC',
    products: [{ productId: product._id, name: product.name, quantity: 4, unitPrice: 16000 }],
  }).expect(200);
  assert.strictEqual(edited.body.totalAmount, 64000);

  const facture = (await admin.post(`/api/invoices/${pro._id}/convert`).expect(201)).body;
  assert.strictEqual(facture.type, 'Facture');
  assert.strictEqual(facture.totalAmount, 64000);
  assert.strictEqual(String(facture.sourceProforma), pro._id);
  await admin.post(`/api/invoices/${pro._id}/convert`).expect(400);

  const prod = (await admin.get('/api/products?search=Bâche').expect(200)).body[0];
  assert.strictEqual(prod.stockQuantity, 6);
  const low = await admin.get('/api/products?lowStock=true').expect(200);
  assert.strictEqual(low.body.length, 0);
});

test('numéro saisi manuellement : unicité', async () => {
  const body = { client: 'Gamma', number: 'MANUEL-1', products: [{ name: 'A', quantity: 1, unitPrice: 1 }] };
  await admin.post('/api/invoices', body).expect(201);
  await admin.post('/api/invoices', body).expect(409);
});

test('validation des lignes', async () => {
  await admin.post('/api/invoices', { client: 'X', products: [] }).expect(400);
  await admin.post('/api/invoices', { client: 'X', products: [{ name: 'A', quantity: 0, unitPrice: 1 }] }).expect(400);
  await admin.post('/api/invoices', { products: [{ name: 'A', quantity: 1, unitPrice: 1 }] }).expect(400);
});

test('rapports : conversion vers la devise de reporting', async () => {
  const summary = (await admin.get('/api/reports/summary').expect(200)).body;
  assert.strictEqual(summary.reportingCurrency, 'USD');
  // Facture FC de 64 000 FC (taux 2000) = 32 USD, + facture manuelle de 1 USD ; la facture annulée est exclue
  assert.strictEqual(summary.invoiced.total, 33);
  assert.strictEqual(summary.invoiced.byCurrency.FC, 64000);
  assert.strictEqual(summary.receivables.total, 33);
  assert.strictEqual(summary.monthly.length, 12);
  assert.strictEqual(summary.counts.pendingProformas, 0);
  assert.strictEqual(summary.topProducts[0].name, 'Bâche 1x1 m');
});

test('dépenses et résultat', async () => {
  await admin.post('/api/expenses', { description: 'Encre', amount: 5, currency: 'USD', category: 'Matières premières' }).expect(201);
  await admin.post('/api/expenses', { description: 'Sans montant', amount: 0 }).expect(400);
  const list = (await admin.get('/api/expenses').expect(200)).body;
  assert.strictEqual(list.total, 1);
  assert.strictEqual(list.totals.USD, 5);
  const summary = (await admin.get('/api/reports/summary').expect(200)).body;
  assert.strictEqual(summary.expenses.total, 5);
  assert.strictEqual(summary.profit, -5);
});

test('un employé peut facturer mais pas annuler', async () => {
  const user = client(app, await createUser(app, adminToken, 'Employé', 'employe@melanine.cd'));
  const inv = (await user.post('/api/invoices', {
    client: 'Delta', products: [{ name: 'Flyers', quantity: 100, unitPrice: 0.5 }],
  }).expect(201)).body;
  await user.post(`/api/invoices/${inv._id}/payments`, { amount: 10 }).expect(201);
  await user.post(`/api/invoices/${inv._id}/cancel`).expect(403);
  await user.del(`/api/invoices/${inv._id}/payments/x`).expect(403);
});

test('isolation : une entreprise ne voit jamais les données d\'une autre', async () => {
  const { token } = await createCompany(app, superToken, 'Imprimerie Concurrente', 'admin@concurrent.cd');
  const other = client(app, token);
  const year = new Date().getFullYear();

  // Numérotation indépendante
  const inv = (await other.post('/api/invoices', { client: 'Société Alpha', products: [{ name: 'A', quantity: 1, unitPrice: 5 }] }).expect(201)).body;
  assert.strictEqual(inv.number, `FAC-${year}-0001`);
  // Même nom de client : fiche distincte
  const mine = (await admin.get('/api/clients?search=Alpha').expect(200)).body[0];
  assert.notStrictEqual(String(inv.clientId), String(mine._id));

  for (const url of ['/api/invoices', '/api/payments', '/api/expenses', '/api/products/movements', '/api/activities']) {
    const body = (await other.get(url).expect(200)).body;
    const items = body.items || body;
    assert.ok(items.every((x) => !x.client || x.client === 'Société Alpha'), url);
  }
  assert.strictEqual((await other.get('/api/products').expect(200)).body.length, 0);
  assert.strictEqual((await other.get('/api/invoices').expect(200)).body.total, 1);
  assert.strictEqual((await other.get('/api/expenses').expect(200)).body.total, 0);

  // Accès direct aux identifiants de l'autre entreprise
  const foreign = (await admin.get('/api/invoices').expect(200)).body.items[0];
  await other.get(`/api/invoices/${foreign._id}`).expect(404);
  await other.post(`/api/invoices/${foreign._id}/payments`, { amount: 1 }).expect(404);
  await other.post(`/api/invoices/${foreign._id}/cancel`).expect(404);
  await other.put(`/api/products/${product._id}`, { name: 'Volé' }).expect(404);
  await other.post(`/api/products/${product._id}/stock`, { type: 'in', quantity: 5 }).expect(404);
  await other.get(`/api/clients/${mine._id}`).expect(404);
  // Une ligne pointant vers le produit d'une autre entreprise ne touche pas son stock
  const before = (await admin.get('/api/products?search=Bâche').expect(200)).body[0].stockQuantity;
  await other.post('/api/invoices', { type: 'Facture', client: 'X', products: [{ productId: product._id, name: 'x', quantity: 2, unitPrice: 1 }] }).expect(201);
  assert.strictEqual((await admin.get('/api/products?search=Bâche').expect(200)).body[0].stockQuantity, before);

  const summary = (await other.get('/api/reports/summary').expect(200)).body;
  assert.strictEqual(summary.invoiced.count, 2);
  assert.strictEqual(summary.counts.clients, 2);
});
