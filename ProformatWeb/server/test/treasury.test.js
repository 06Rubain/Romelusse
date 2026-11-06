const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startDb, stopDb, setupPlatform, createCompany, createUser, client } = require('./helpers');

let app;
let adminToken;
let otherToken;

before(async () => {
  app = await startDb();
  const superToken = await setupPlatform(app);
  ({ token: adminToken } = await createCompany(app, superToken, 'Entreprise Caisse', 'admin@caisse.cd'));
  ({ token: otherToken } = await createCompany(app, superToken, 'Autre entreprise', 'admin@autre.cd'));
});
after(stopDb);

test('trésorerie : soldes par compte et par devise, journal des entrées et sorties', async () => {
  const admin = client(app, adminToken);
  const inv = (await admin.post('/api/invoices', {
    type: 'Facture', client: 'Client A', currency: 'USD', products: [{ name: 'Bâche', quantity: 1, unitPrice: 100 }],
  }).expect(201)).body;
  await admin.post(`/api/invoices/${inv._id}/payments`, { amount: 60, method: 'Espèces' }).expect(201);
  await admin.post(`/api/invoices/${inv._id}/payments`, { amount: 40, method: 'Mobile Money' }).expect(201);
  await admin.post('/api/expenses', { description: 'Encre', amount: 15, currency: 'USD', paymentMethod: 'Espèces' }).expect(201);
  await admin.post('/api/treasury/movements', { type: 'opening', account: 'Banque', amount: 500, currency: 'USD' }).expect(201);
  await admin.post('/api/treasury/movements', { type: 'transfer', account: 'Caisse', toAccount: 'Banque', amount: 20, currency: 'USD', label: 'Dépôt' }).expect(201);
  await admin.post('/api/treasury/movements', { type: 'in', account: 'Caisse', amount: 10000, currency: 'FC', label: 'Apport du gérant' }).expect(201);

  const t = (await admin.get('/api/treasury').expect(200)).body;
  assert.deepStrictEqual(t.balances.Caisse, { USD: 25, FC: 10000 });
  assert.deepStrictEqual(t.balances['Mobile Money'], { USD: 40, FC: 0 });
  assert.deepStrictEqual(t.balances.Banque, { USD: 520, FC: 0 });
  // Le virement interne ne compte ni comme entrée ni comme sortie
  assert.deepStrictEqual(t.period.in, { USD: 600, FC: 10000 });
  assert.deepStrictEqual(t.period.out, { USD: 15, FC: 0 });
  assert.strictEqual(t.entries.length, 6);

  // Vue d'un seul compte : le virement sort de la caisse
  const caisse = (await admin.get('/api/treasury?account=Caisse').expect(200)).body;
  const transfer = caisse.entries.find((e) => e.kind === 'transfer');
  assert.strictEqual(transfer.amount, -20);
  assert.ok(caisse.entries.every((e) => e.account === 'Caisse' || e.toAccount === 'Caisse'));
});

test('trésorerie : validations, suppression et droits', async () => {
  const admin = client(app, adminToken);
  await admin.post('/api/treasury/movements', { type: 'transfer', account: 'Caisse', toAccount: 'Caisse', amount: 5, currency: 'USD' }).expect(400);
  await admin.post('/api/treasury/movements', { type: 'in', account: 'Caisse', amount: 5, currency: 'USD' }).expect(400);
  await admin.post('/api/treasury/movements', { type: 'in', account: 'Coffre', amount: 5, currency: 'USD', label: 'x' }).expect(400);
  await admin.post('/api/treasury/movements', { type: 'in', account: 'Caisse', amount: 0, currency: 'USD', label: 'x' }).expect(400);

  const m = (await admin.post('/api/treasury/movements', { type: 'in', account: 'Banque', amount: 7, currency: 'USD', label: 'Remboursement' }).expect(201)).body;
  await client(app, otherToken).del(`/api/treasury/movements/${m._id}`).expect(404);
  await admin.del(`/api/treasury/movements/${m._id}`).expect(200);

  // L'employé encaisse : il voit la caisse et peut y enregistrer de l'argent
  const employee = client(app, await createUser(app, adminToken, 'Employé', 'caissier@caisse.cd'));
  await employee.get('/api/treasury').expect(200);
  await employee.post('/api/treasury/movements', { type: 'in', account: 'Caisse', amount: 3, currency: 'USD', label: 'Vente comptoir' }).expect(201);

  // Un rôle sans encaissement, dépenses ni rapports n'y a pas accès
  await admin.post('/api/roles', { name: 'Magasinier', permissions: ['products.manage'] }).expect(201);
  const storekeeper = client(app, await createUser(app, adminToken, 'Magasinier', 'stock@caisse.cd'));
  await storekeeper.get('/api/treasury').expect(403);

  // Isolation : l'autre entreprise ne voit rien
  const other = (await client(app, otherToken).get('/api/treasury').expect(200)).body;
  assert.deepStrictEqual(other.balances.Caisse, { USD: 0, FC: 0 });
  assert.strictEqual(other.entries.length, 0);
});
