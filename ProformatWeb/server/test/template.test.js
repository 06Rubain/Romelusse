const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startDb, stopDb, setupPlatform, createCompany, createUser, client } = require('./helpers');

let app;
let admin;
let adminToken;
let superToken;
const png = `data:image/png;base64,${Buffer.from('modele-importe').toString('base64')}`;

before(async () => {
  app = await startDb();
  superToken = await setupPlatform(app);
  ({ token: adminToken } = await createCompany(app, superToken, 'Mélanine Print', 'admin@melanine.cd'));
  admin = client(app, adminToken);
});
after(stopDb);

test('modèle par défaut : standard avec zones et libellés', async () => {
  const t = (await admin.get('/api/company/template').expect(200)).body;
  assert.strictEqual(t.mode, 'standard');
  assert.strictEqual(t.zones.items.visible, true);
  assert.strictEqual(t.labels.facture, 'FACTURE N°');
});

test('import d\'un modèle et adaptation des zones', async () => {
  await admin.put('/api/company/template', { mode: 'custom' }).expect(400);
  await admin.put('/api/company/template', { background: 'data:application/pdf;base64,AAAA' }).expect(400);
  const saved = (await admin.put('/api/company/template', {
    mode: 'custom',
    background: png,
    pageSize: 'A5',
    zones: { items: { x: 95, y: 30, w: 50, h: 40 }, stamp: { visible: false } },
    style: { fontSize: 99, headerBg: '#c92a2a', fontFamily: 'Georgia, serif' },
    labels: { facture: 'FACTURE D\'ACHAT N°', unitPrice: 'Prix' },
  }).expect(200)).body;
  assert.strictEqual(saved.mode, 'custom');
  assert.strictEqual(saved.pageSize, 'A5');
  // La zone est ramenée dans la page
  assert.deepStrictEqual([saved.zones.items.x, saved.zones.items.w], [50, 50]);
  assert.strictEqual(saved.zones.stamp.visible, false);
  assert.strictEqual(saved.zones.meta.visible, true);
  assert.strictEqual(saved.style.fontSize, 20);
  assert.strictEqual(saved.style.headerBg, '#c92a2a');
  assert.strictEqual(saved.labels.facture, 'FACTURE D\'ACHAT N°');
  assert.strictEqual(saved.labels.quantity, 'Qté');
  await admin.put('/api/company/template', { style: { textColor: 'noir' } }).expect(400);
  await admin.put('/api/company/template', { pageSize: 'A3' }).expect(400);
  // Retour au modèle standard sans perdre le modèle importé
  const back = (await admin.put('/api/company/template', { mode: 'standard' }).expect(200)).body;
  assert.strictEqual(back.background, png);
});

test('droits et isolation du modèle', async () => {
  const employee = client(app, await createUser(app, adminToken, 'Employé', 'employe@melanine.cd'));
  assert.strictEqual((await employee.get('/api/company/template').expect(200)).body.background, png);
  await employee.put('/api/company/template', { mode: 'standard' }).expect(403);
  const { token } = await createCompany(app, superToken, 'Autre Imprimerie', 'admin@autre.cd');
  const other = (await client(app, token).get('/api/company/template').expect(200)).body;
  assert.strictEqual(other.background, '');
  assert.strictEqual(other.mode, 'standard');
});
