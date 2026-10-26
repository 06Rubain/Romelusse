const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const otp = require('otplib');
const { startDb, stopDb, setupAdmin, createUser, client, ADMIN } = require('./helpers');

let app;
let adminToken;

before(async () => { app = await startDb(); });
after(stopDb);

test('premier démarrage : configuration de l\'administrateur', async () => {
  const status = await request(app).get('/api/auth/status').expect(200);
  assert.strictEqual(status.body.needsSetup, true);
  adminToken = await setupAdmin(app);
  const again = await request(app).get('/api/auth/status').expect(200);
  assert.strictEqual(again.body.needsSetup, false);
  await request(app).post('/api/auth/setup').send({ ...ADMIN, email: 'autre@example.com' }).expect(409);
});

test('connexion et accès protégés', async () => {
  await request(app).get('/api/invoices').expect(401);
  await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: 'mauvais' }).expect(401);
  const res = await request(app).post('/api/auth/login').send({ email: 'ADMIN@example.com', password: ADMIN.password }).expect(200);
  assert.ok(res.body.token);
  assert.strictEqual(res.body.user.passwordHash, undefined);
  const me = await client(app, res.body.token).get('/api/auth/me').expect(200);
  assert.strictEqual(me.body.role, 'admin');
});

test('rôles : un employé ne gère ni l\'équipe ni les dépenses', async () => {
  const userToken = await createUser(app, adminToken, 'user');
  const api = client(app, userToken);
  await api.get('/api/users').expect(403);
  await api.get('/api/expenses').expect(403);
  await api.post('/api/products', { name: 'X', unitPrice: 1 }).expect(403);
  await api.get('/api/products').expect(200);
  const summary = await api.get('/api/reports/summary').expect(200);
  assert.strictEqual(summary.body.expenses, null);
});

test('un compte bloqué perd immédiatement l\'accès', async () => {
  const token = await createUser(app, adminToken, 'manager', 'bloque@example.com');
  const admin = client(app, adminToken);
  const users = await admin.get('/api/users').expect(200);
  const target = users.body.find((u) => u.email === 'bloque@example.com');
  await admin.patch(`/api/users/${target._id}`, { isBlocked: true }).expect(200);
  await client(app, token).get('/api/invoices').expect(403);
  await request(app).post('/api/auth/login').send({ email: 'bloque@example.com', password: 'motdepasse-user' }).expect(403);
  // Un administrateur ne peut pas se bloquer lui-même
  const me = users.body.find((u) => u.email === ADMIN.email);
  await admin.patch(`/api/users/${me._id}`, { isBlocked: true }).expect(400);
});

test('double authentification', async () => {
  const admin = client(app, adminToken);
  const setup = await admin.post('/api/auth/2fa/setup').expect(200);
  await admin.post('/api/auth/2fa/enable', { code: '000000' }).expect(400);
  await admin.post('/api/auth/2fa/enable', { code: otp.generateSync({ secret: setup.body.secret }) }).expect(200);

  const login = await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password }).expect(200);
  assert.strictEqual(login.body.requires2fa, true);
  assert.strictEqual(login.body.token, undefined);
  // Le jeton intermédiaire ne donne pas accès à l'API
  await client(app, login.body.challenge).get('/api/invoices').expect(401);
  const done = await request(app).post('/api/auth/login/2fa')
    .send({ challenge: login.body.challenge, code: otp.generateSync({ secret: setup.body.secret }) }).expect(200);
  assert.ok(done.body.token);

  await client(app, done.body.token).post('/api/auth/2fa/disable', { password: ADMIN.password }).expect(200);
});
