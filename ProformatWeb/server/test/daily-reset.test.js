const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startDb, stopDb, setupPlatform, createCompany, createUser, client } = require('./helpers');

let app;
let superToken;
let adminToken;
let company;
let otherToken;

const today = new Date().toISOString().slice(0, 10);

before(async () => {
  app = await startDb();
  superToken = await setupPlatform(app);
  ({ company, token: adminToken } = await createCompany(app, superToken, 'Kin Express', 'admin@kinexpress.cd'));
  ({ token: otherToken } = await createCompany(app, superToken, 'Voisin SARL', 'admin@voisin.cd'));
});
after(stopDb);

const seed = async (token) => {
  const admin = client(app, token);
  await admin.post('/api/treasury/movements', { type: 'opening', account: 'Caisse', amount: 100, currency: 'USD', date: '2020-01-01' }).expect(201);
  const inv = (await admin.post('/api/invoices', {
    type: 'Facture', client: 'Client du jour', currency: 'USD', products: [{ name: 'Flyers', quantity: 3, unitPrice: 10 }],
  }).expect(201)).body;
  await admin.post('/api/invoices', { type: 'Proforma', client: 'Prospect', currency: 'USD', products: [{ name: 'Bâche', quantity: 1, unitPrice: 50 }] }).expect(201);
  await admin.post(`/api/invoices/${inv._id}/payments`, { amount: 30, method: 'Espèces' }).expect(201);
  await admin.post('/api/expenses', { description: 'Taxi', amount: 4, currency: 'USD', paymentMethod: 'Espèces' }).expect(201);
  await admin.post('/api/clients', { name: 'Client fidèle' }).expect(201);
  return inv;
};

test('rapport journalier : documents, entrées, sorties et soldes de la journée', async () => {
  await seed(adminToken);
  const r = (await client(app, adminToken).get(`/api/treasury/daily?date=${today}`).expect(200)).body;
  assert.strictEqual(r.date, today);
  assert.strictEqual(r.invoices.length, 2);
  assert.deepStrictEqual(r.totals.invoiced, { USD: 30, FC: 0 });
  assert.deepStrictEqual(r.totals.proforma, { USD: 50, FC: 0 });
  assert.deepStrictEqual(r.totals.in, { USD: 30, FC: 0 });
  assert.deepStrictEqual(r.totals.out, { USD: 4, FC: 0 });
  assert.deepStrictEqual(r.opening.Caisse, { USD: 100, FC: 0 });
  assert.deepStrictEqual(r.closing.Caisse, { USD: 126, FC: 0 });
  assert.strictEqual(r.topProducts[0].name, 'Flyers');
  assert.strictEqual(r.topProducts[0].quantity, 3);
  // Le solde de départ daté de 2020 n'apparaît pas dans les mouvements du jour
  assert.strictEqual(r.entries.length, 2);

  // Un autre jour : rien de la journée, mais les soldes sont reportés
  const old = (await client(app, adminToken).get('/api/treasury/daily?date=2021-06-01').expect(200)).body;
  assert.strictEqual(old.invoices.length, 0);
  assert.deepStrictEqual(old.closing.Caisse, { USD: 100, FC: 0 });

  // L'employé (encaissements) y a accès ; isolation entre entreprises
  const employee = client(app, await createUser(app, adminToken, 'Employé', 'vendeur@kinexpress.cd'));
  await employee.get(`/api/treasury/daily?date=${today}`).expect(200);
  const other = (await client(app, otherToken).get(`/api/treasury/daily?date=${today}`).expect(200)).body;
  assert.strictEqual(other.invoices.length, 0);
});

test('effacement des données de test : confirmation, choix et isolation', async () => {
  const admin = client(app, adminToken);
  await seed(otherToken);

  // Sans le nom exact de l'entreprise, rien n'est effacé
  await admin.post('/api/company/reset', { scopes: ['sales'], confirm: 'mauvais nom' }).expect(400);
  await admin.post('/api/company/reset', { scopes: [], confirm: 'Kin Express' }).expect(400);
  assert.strictEqual((await admin.get('/api/invoices').expect(200)).body.total, 2);

  // Un employé ne peut pas effacer
  const employee = client(app, await createUser(app, adminToken, 'Employé', 'aide@kinexpress.cd'));
  await employee.post('/api/company/reset', { scopes: ['sales'], confirm: 'Kin Express' }).expect(403);

  // Ventes et argent effacés, clients conservés ; la numérotation repart à 0001
  const clientsBefore = (await admin.get('/api/clients').expect(200)).body.length;
  assert.ok(clientsBefore > 0);
  const res = (await admin.post('/api/company/reset', { scopes: ['sales', 'money'], confirm: ' kin express ' }).expect(200)).body;
  assert.strictEqual(res.deleted.invoices, 2);
  assert.strictEqual((await admin.get('/api/invoices').expect(200)).body.total, 0);
  assert.strictEqual((await admin.get('/api/clients').expect(200)).body.length, clientsBefore);
  const t = (await admin.get('/api/treasury').expect(200)).body;
  assert.deepStrictEqual(t.balances.Caisse, { USD: 0, FC: 0 });
  const year = new Date().getFullYear();
  const next = (await admin.get('/api/invoices/next-number?type=Facture').expect(200)).body.nextNumber;
  assert.strictEqual(next, `FAC-${year}-0001`);

  // Les comptes et l'entreprise restent ; l'autre entreprise n'est pas touchée
  await admin.get('/api/company').expect(200);
  assert.strictEqual((await client(app, otherToken).get('/api/invoices').expect(200)).body.total, 2);

  // OmniCom peut aussi effacer depuis sa console
  await client(app, superToken).post(`/api/platform/companies/${company._id}/reset`, { scopes: ['clients'], confirm: 'Kin Express' }).expect(200);
  assert.strictEqual((await admin.get('/api/clients').expect(200)).body.length, 0);
  await client(app, adminToken).post(`/api/platform/companies/${company._id}/reset`, { scopes: ['clients'], confirm: 'Kin Express' }).expect(403);
});
