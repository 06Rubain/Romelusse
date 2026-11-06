const mongoose = require('mongoose');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-with-enough-length';
process.env.SETUP_KEY = 'cle-installation-test';

let memoryServer = null;

// Utilise MONGODB_TEST_URI si fourni, sinon une instance MongoDB en mémoire
const startDb = async () => {
  let uri = process.env.MONGODB_TEST_URI;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('proformat_test');
  }
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  return require('../index');
};

const stopDb = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
};

const SUPER = { email: 'equipe@omnicom.cd', password: 'motdepasse-omnicom', displayName: 'OmniCom', setupKey: 'cle-installation-test' };

// Crée le super-admin OmniCom et renvoie son jeton
const setupPlatform = async (app) => {
  const res = await request(app).post('/api/auth/setup').send(SUPER).expect(201);
  return res.body.token;
};

const login = async (app, email, password) => {
  const res = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
  return res.body.token;
};

// OmniCom crée une entreprise et son administrateur ; renvoie le jeton de l'admin
const createCompany = async (app, superToken, name, adminEmail) => {
  const res = await request(app).post('/api/platform/companies').set('Authorization', `Bearer ${superToken}`)
    .send({ name, exchangeRate: 2000, admin: { email: adminEmail, password: 'motdepasse-admin', displayName: `Admin ${name}` } })
    .expect(201);
  return { company: res.body.company, token: await login(app, adminEmail, 'motdepasse-admin') };
};

// L'admin d'une entreprise crée un utilisateur avec le rôle donné (par nom)
const createUser = async (app, adminToken, roleName, email) => {
  const roles = await request(app).get('/api/roles').set('Authorization', `Bearer ${adminToken}`).expect(200);
  const role = roles.body.find((r) => r.name === roleName);
  if (!role) throw new Error(`Rôle ${roleName} introuvable`);
  await request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`)
    .send({ email, password: 'motdepasse-user', roleId: role._id }).expect(201);
  return login(app, email, 'motdepasse-user');
};

const client = (app, token) => {
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  return {
    get: (url) => auth(request(app).get(url)),
    post: (url, body = {}) => auth(request(app).post(url)).send(body),
    put: (url, body = {}) => auth(request(app).put(url)).send(body),
    patch: (url, body = {}) => auth(request(app).patch(url)).send(body),
    del: (url) => auth(request(app).delete(url)),
  };
};

module.exports = { startDb, stopDb, setupPlatform, createCompany, createUser, login, client, SUPER };
