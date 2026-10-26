const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { startDb, stopDb, setupPlatform, createCompany, client } = require('./helpers');

let app;
let superToken;
let companyA;
let adminA;
let companyB;

const as = (token, companyId) => {
  const auth = (r) => {
    r.set('Authorization', `Bearer ${token}`);
    if (companyId) r.set('X-Company-Id', String(companyId));
    return r;
  };
  return {
    get: (url) => auth(request(app).get(url)),
    post: (url, body = {}) => auth(request(app).post(url)).send(body),
  };
};

before(async () => {
  app = await startDb();
  superToken = await setupPlatform(app);
  ({ company: companyA, token: adminA } = await createCompany(app, superToken, 'Entreprise A', 'admin@a.cd'));
  ({ company: companyB } = await createCompany(app, superToken, 'Entreprise B', 'admin@b.cd'));
  await client(app, adminA).post('/api/invoices', { client: 'Client de A', products: [{ name: 'x', quantity: 1, unitPrice: 10 }] }).expect(201);
});
after(stopDb);

test('le super-admin ouvre la console d\'une entreprise avec tous les droits', async () => {
  // Sans entreprise choisie : pas d'accès aux données métier
  await as(superToken).get('/api/invoices').expect(403);

  const omniA = as(superToken, companyA._id);
  const invoices = (await omniA.get('/api/invoices').expect(200)).body;
  assert.strictEqual(invoices.total, 1);
  assert.strictEqual((await omniA.get('/api/company').expect(200)).body.name, 'Entreprise A');
  await omniA.get('/api/users').expect(200);
  await omniA.get('/api/expenses').expect(200);
  const created = (await omniA.post('/api/invoices', { client: 'Dépannage', products: [{ name: 'y', quantity: 2, unitPrice: 5 }] }).expect(201)).body;
  assert.strictEqual(created.createdBy, 'equipe@omnicom.cd');

  // L'action est tracée dans le journal de l'entreprise, identifiée comme OmniCom
  const journal = (await client(app, adminA).get('/api/activities').expect(200)).body.items;
  assert.ok(journal.some((a) => a.userEmail === 'equipe@omnicom.cd (OmniCom)' && a.details.includes('Dépannage')));

  // Les données des autres entreprises restent séparées
  assert.strictEqual((await as(superToken, companyB._id).get('/api/invoices').expect(200)).body.total, 0);
  // Le compte super-admin n'est pas rattaché à l'entreprise visitée
  const me = (await as(superToken).get('/api/auth/me').expect(200)).body;
  assert.strictEqual(me.company, null);
});

test('un utilisateur d\'entreprise ne peut pas changer d\'entreprise', async () => {
  const fromA = as(adminA, companyB._id);
  const invoices = (await fromA.get('/api/invoices').expect(200)).body;
  // L'en-tête est ignoré : l'admin de A ne voit que les factures de A
  assert.deepStrictEqual(invoices.items.map((i) => i.client).sort(), ['Client de A', 'Dépannage']);
  assert.strictEqual((await fromA.get('/api/company').expect(200)).body.name, 'Entreprise A');
});

test('entreprise inconnue', async () => {
  await as(superToken, '64b000000000000000000000').get('/api/invoices').expect(404);
  await as(superToken, 'pas-un-id').get('/api/invoices').expect(404);
});
