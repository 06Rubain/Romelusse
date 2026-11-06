const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startDb, stopDb, setupPlatform, createCompany, createUser, client } = require('./helpers');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let app;
let adminToken;

before(async () => {
  app = await startDb();
  const superToken = await setupPlatform(app);
  ({ token: adminToken } = await createCompany(app, superToken, 'Entreprise Photo', 'admin@photo.cd'));
});
after(stopDb);

test('chacun ajoute, remplace et retire sa photo de profil', async () => {
  const me = (await client(app, adminToken).patch('/api/auth/me', { photoURL: PNG }).expect(200)).body;
  assert.strictEqual(me.photoURL, PNG);
  assert.strictEqual((await client(app, adminToken).get('/api/auth/me').expect(200)).body.photoURL, PNG);
  const cleared = (await client(app, adminToken).patch('/api/auth/me', { photoURL: '' }).expect(200)).body;
  assert.strictEqual(cleared.photoURL, '');
});

test('une photo invalide ou trop lourde est refusée', async () => {
  await client(app, adminToken).patch('/api/auth/me', { photoURL: 'https://exemple.com/photo.png' }).expect(400);
  await client(app, adminToken).patch('/api/auth/me', { photoURL: 'data:image/svg+xml;base64,PHN2Zz4=' }).expect(400);
  const huge = `data:image/jpeg;base64,${'A'.repeat(500 * 1024)}`;
  await client(app, adminToken).patch('/api/auth/me', { photoURL: huge }).expect(400);
});

test('l\'administrateur met la photo d\'un collaborateur, pas un employé', async () => {
  const employeeToken = await createUser(app, adminToken, 'Employé', 'employe@photo.cd');
  const employee = (await client(app, adminToken).get('/api/users').expect(200)).body.find((u) => u.email === 'employe@photo.cd');
  const updated = (await client(app, adminToken).patch(`/api/users/${employee._id}`, { photoURL: PNG }).expect(200)).body;
  assert.strictEqual(updated.photoURL, PNG);
  const list = (await client(app, adminToken).get('/api/users').expect(200)).body;
  assert.strictEqual(list.find((u) => u.email === 'employe@photo.cd').photoURL, PNG);

  await client(app, employeeToken).patch(`/api/users/${employee._id}`, { photoURL: '' }).expect(403);
});
