const mongoose = require('mongoose');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-with-enough-length';

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

const ADMIN = { email: 'admin@example.com', password: 'motdepasse-admin', displayName: 'Admin' };

const setupAdmin = async (app) => {
  const res = await request(app).post('/api/auth/setup').send(ADMIN).expect(201);
  return res.body.token;
};

const createUser = async (app, adminToken, role, email = `${role}@example.com`) => {
  await request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`)
    .send({ email, password: 'motdepasse-user', role }).expect(201);
  const res = await request(app).post('/api/auth/login').send({ email, password: 'motdepasse-user' }).expect(200);
  return res.body.token;
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

module.exports = { startDb, stopDb, setupAdmin, createUser, client, ADMIN };
