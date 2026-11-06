const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const User = require('../models/User');

process.env.OMNICOM_ADMIN_PASSWORD = 'omnicom-depuis-env';
process.env.OMNICOM_ADMIN_EMAIL = 'Rubain@OmniCom.cd';
delete process.env.SETUP_KEY;

const { startDb, stopDb, client } = require('./helpers');

let app;
before(async () => {
  app = await startDb();
  delete process.env.SETUP_KEY;
  // Compte de l'ancienne version portant le même e-mail
  await User.collection.insertOne({ uid: 'legacy', email: 'rubain@omnicom.cd', role: 'admin' });
});
after(stopDb);

test('le compte OmniCom est créé automatiquement depuis les variables d\'environnement', async () => {
  const status = await request(app).get('/api/auth/status').expect(200);
  assert.strictEqual(status.body.needsSetup, false);
  const login = await request(app).post('/api/auth/login').send({ email: 'rubain@omnicom.cd', password: 'omnicom-depuis-env' }).expect(200);
  assert.strictEqual(login.body.user.isSuperAdmin, true);
  // L'ancien compte a été promu, pas dupliqué
  assert.strictEqual(await User.countDocuments({ email: 'rubain@omnicom.cd' }), 1);

  const omni = client(app, login.body.token);
  await omni.post('/api/platform/companies', {
    name: 'Première Entreprise', admin: { email: 'admin@premiere.cd', password: 'motdepasse-admin' },
  }).expect(201);
  const health = (await request(app).get('/api/health').expect(200)).body;
  assert.strictEqual(health.adminFromEnv, true);
  assert.deepStrictEqual(health.missing, []);
});

test('le mot de passe changé dans l\'application n\'est pas écrasé', async () => {
  const { ensureSuperAdmin } = require('../lib/bootstrap');
  const token = (await request(app).post('/api/auth/login').send({ email: 'rubain@omnicom.cd', password: 'omnicom-depuis-env' })).body.token;
  await client(app, token).post('/api/auth/change-password', { currentPassword: 'omnicom-depuis-env', newPassword: 'nouveau-mot-de-passe' }).expect(200);
  assert.strictEqual(await ensureSuperAdmin(), null);
  await request(app).post('/api/auth/login').send({ email: 'rubain@omnicom.cd', password: 'nouveau-mot-de-passe' }).expect(200);
});

test('sans JWT_SECRET, la session repose sur une clé dérivée de MONGODB_URI', async () => {
  const saved = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try {
    const res = await request(app).post('/api/auth/login').send({ email: 'rubain@omnicom.cd', password: 'nouveau-mot-de-passe' }).expect(200);
    await client(app, res.body.token).get('/api/auth/me').expect(200);
  } finally {
    process.env.JWT_SECRET = saved;
  }
});
