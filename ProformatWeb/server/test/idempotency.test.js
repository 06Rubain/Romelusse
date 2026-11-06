const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startDb, stopDb, setupPlatform, createCompany, client } = require('./helpers');

let app;
let adminToken;
let otherToken;

before(async () => {
  app = await startDb();
  const superToken = await setupPlatform(app);
  ({ token: adminToken } = await createCompany(app, superToken, 'Entreprise Hors Ligne', 'admin@horsligne.cd'));
  ({ token: otherToken } = await createCompany(app, superToken, 'Autre Hors Ligne', 'admin@autre-hl.cd'));
});
after(stopDb);

test('une saisie renvoyée avec la même clé n\'est enregistrée qu\'une fois', async () => {
  const admin = client(app, adminToken);
  const send = () => admin.post('/api/invoices', { client: 'Client hors ligne', products: [{ name: 'Flyers', quantity: 1, unitPrice: 10 }] })
    .set('Idempotency-Key', 'facture-hors-ligne-0001');
  const first = await send().expect(201);
  const second = await send().expect(201);
  assert.strictEqual(second.headers['idempotent-replay'], 'true');
  assert.strictEqual(second.body._id, first.body._id);
  assert.strictEqual((await admin.get('/api/invoices').expect(200)).body.total, 1);

  // Sans clé, ou avec une autre clé : nouvelle facture
  await admin.post('/api/invoices', { client: 'Client hors ligne', products: [{ name: 'Flyers', quantity: 1, unitPrice: 10 }] })
    .set('Idempotency-Key', 'facture-hors-ligne-0002').expect(201);
  assert.strictEqual((await admin.get('/api/invoices').expect(200)).body.total, 2);

  // La même clé chez un autre utilisateur ne renvoie pas sa facture
  const other = await client(app, otherToken).post('/api/invoices', { client: 'Autre', products: [{ name: 'X', quantity: 1, unitPrice: 5 }] })
    .set('Idempotency-Key', 'facture-hors-ligne-0001').expect(201);
  assert.notStrictEqual(other.body._id, first.body._id);
});

test('un refus est rejoué tel quel ; une clé invalide est refusée', async () => {
  const admin = client(app, adminToken);
  const bad = () => admin.post('/api/expenses', { description: '', amount: 5 }).set('Idempotency-Key', 'depense-invalide-01');
  const r1 = await bad();
  const r2 = await bad();
  assert.ok(r1.status >= 400 && r1.status < 500);
  assert.strictEqual(r2.status, r1.status);
  await admin.post('/api/expenses', { description: 'Taxi', amount: 5 }).set('Idempotency-Key', 'pas bon !').expect(400);
});
