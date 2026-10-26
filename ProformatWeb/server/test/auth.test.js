const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const otp = require('otplib');
const { startDb, stopDb, setupPlatform, createCompany, createUser, login, client, SUPER } = require('./helpers');

let app;
let superToken;
let admin;
let adminToken;

before(async () => { app = await startDb(); });
after(stopDb);

test('installation : le super-admin OmniCom exige la clé SETUP_KEY', async () => {
  const status = await request(app).get('/api/auth/status').expect(200);
  assert.strictEqual(status.body.needsSetup, true);
  await request(app).post('/api/auth/setup').send({ ...SUPER, setupKey: 'mauvaise' }).expect(403);
  superToken = await setupPlatform(app);
  await request(app).post('/api/auth/setup').send({ ...SUPER, email: 'autre@omnicom.cd' }).expect(409);
  const me = await client(app, superToken).get('/api/auth/me').expect(200);
  assert.strictEqual(me.body.isSuperAdmin, true);
});

test('seul OmniCom crée les entreprises', async () => {
  ({ token: adminToken } = await createCompany(app, superToken, 'Mélanine Print', 'admin@melanine.cd'));
  admin = client(app, adminToken);
  await admin.post('/api/platform/companies', { name: 'Pirate', admin: { email: 'x@x.cd', password: 'motdepasse-x' } }).expect(403);
  await admin.get('/api/platform/companies').expect(403);
  // Le super-admin n'a pas accès aux données métier d'une entreprise
  await client(app, superToken).get('/api/invoices').expect(403);
  const me = await admin.get('/api/auth/me').expect(200);
  assert.strictEqual(me.body.roleName, 'Administrateur');
  assert.ok(me.body.permissions.includes('roles.manage'));
});

test('connexion et accès protégés', async () => {
  await request(app).get('/api/invoices').expect(401);
  await request(app).post('/api/auth/login').send({ email: 'admin@melanine.cd', password: 'mauvais' }).expect(401);
  const token = await login(app, 'ADMIN@melanine.cd', 'motdepasse-admin');
  const me = await client(app, token).get('/api/auth/me').expect(200);
  assert.strictEqual(me.body.passwordHash, undefined);
});

test('rôles par défaut : un employé ne gère ni l\'équipe ni les dépenses', async () => {
  const api = client(app, await createUser(app, adminToken, 'Employé', 'employe@melanine.cd'));
  await api.get('/api/users').expect(403);
  await api.get('/api/roles').expect(403);
  await api.get('/api/expenses').expect(403);
  await api.post('/api/products', { name: 'X', unitPrice: 1 }).expect(403);
  await api.put('/api/company', { name: 'Piratage' }).expect(403);
  await api.get('/api/products').expect(200);
  const summary = await api.get('/api/reports/summary').expect(200);
  assert.strictEqual(summary.body.expenses, null);
});

test('l\'admin crée un rôle sur mesure et ses permissions s\'appliquent', async () => {
  await admin.post('/api/roles', { name: 'Magasinier', permissions: ['products.manage', 'stock.manage', 'inconnue'] }).expect(201);
  await admin.post('/api/roles', { name: 'Magasinier' }).expect(409);
  const roles = (await admin.get('/api/roles').expect(200)).body;
  const magasinier = roles.find((r) => r.name === 'Magasinier');
  assert.deepStrictEqual(magasinier.permissions, ['products.manage', 'stock.manage']);
  const system = roles.find((r) => r.isSystem);
  await admin.put(`/api/roles/${system._id}`, { name: 'Admin', permissions: [] }).expect(400);
  await admin.del(`/api/roles/${system._id}`).expect(400);

  const api = client(app, await createUser(app, adminToken, 'Magasinier', 'stock@melanine.cd'));
  await api.post('/api/products', { name: 'Encre', unitPrice: 10 }).expect(201);
  await api.post('/api/invoices', { client: 'A', products: [{ name: 'x', quantity: 1, unitPrice: 1 }] }).expect(403);

  // Le changement de permissions prend effet immédiatement
  await admin.put(`/api/roles/${magasinier._id}`, { name: 'Magasinier', permissions: ['stock.manage'] }).expect(200);
  await api.post('/api/products', { name: 'Papier', unitPrice: 1 }).expect(403);
  // Un rôle utilisé ne peut pas être supprimé
  await admin.del(`/api/roles/${magasinier._id}`).expect(400);
});

test('un compte bloqué perd immédiatement l\'accès ; l\'entreprise garde un admin', async () => {
  const token = await createUser(app, adminToken, 'Gestionnaire', 'bloque@melanine.cd');
  const users = (await admin.get('/api/users').expect(200)).body;
  const target = users.find((u) => u.email === 'bloque@melanine.cd');
  await admin.patch(`/api/users/${target._id}`, { isBlocked: true }).expect(200);
  await client(app, token).get('/api/invoices').expect(403);
  await request(app).post('/api/auth/login').send({ email: 'bloque@melanine.cd', password: 'motdepasse-user' }).expect(403);
  const me = users.find((u) => u.email === 'admin@melanine.cd');
  await admin.patch(`/api/users/${me._id}`, { isBlocked: true }).expect(400);
  await admin.patch(`/api/users/${me._id}`, { roleId: target.roleId }).expect(400);
});

test('suspension d\'une entreprise par OmniCom', async () => {
  const { company, token } = await createCompany(app, superToken, 'Société Suspendue', 'admin@suspendue.cd');
  const omni = client(app, superToken);
  await omni.put(`/api/platform/companies/${company._id}`, { isActive: false }).expect(200);
  await client(app, token).get('/api/invoices').expect(403);
  await request(app).post('/api/auth/login').send({ email: 'admin@suspendue.cd', password: 'motdepasse-admin' }).expect(403);
  await omni.put(`/api/platform/companies/${company._id}`, { isActive: true }).expect(200);
  await client(app, token).get('/api/invoices').expect(200);
  const list = (await omni.get('/api/platform/companies').expect(200)).body;
  assert.strictEqual(list.length, 2);
});

test('personnalisation : logo et couleurs validés', async () => {
  const png = `data:image/png;base64,${Buffer.from('fake-png').toString('base64')}`;
  const updated = await admin.put('/api/company', { logo: png, primaryColor: '#112233', address: 'Kinshasa' }).expect(200);
  assert.strictEqual(updated.body.logo, png);
  await admin.put('/api/company', { logo: 'data:image/svg+xml;base64,PHN2Zz4=' }).expect(400);
  await admin.put('/api/company', { primaryColor: 'rouge' }).expect(400);
  await admin.put('/api/company', { logo: `data:image/png;base64,${'A'.repeat(1200000)}` }).expect(400);
});

test('double authentification', async () => {
  const setup = await admin.post('/api/auth/2fa/setup').expect(200);
  await admin.post('/api/auth/2fa/enable', { code: '000000' }).expect(400);
  await admin.post('/api/auth/2fa/enable', { code: otp.generateSync({ secret: setup.body.secret }) }).expect(200);

  const res = await request(app).post('/api/auth/login').send({ email: 'admin@melanine.cd', password: 'motdepasse-admin' }).expect(200);
  assert.strictEqual(res.body.requires2fa, true);
  assert.strictEqual(res.body.token, undefined);
  await client(app, res.body.challenge).get('/api/invoices').expect(401);
  const done = await request(app).post('/api/auth/login/2fa')
    .send({ challenge: res.body.challenge, code: otp.generateSync({ secret: setup.body.secret }) }).expect(200);
  assert.ok(done.body.token);
  await client(app, done.body.token).post('/api/auth/2fa/disable', { password: 'motdepasse-admin' }).expect(200);
});
