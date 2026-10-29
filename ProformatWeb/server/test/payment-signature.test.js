const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startDb, stopDb, setupPlatform, createCompany, createUser, client } = require('./helpers');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let app;
let adminToken;

before(async () => {
  app = await startDb();
  const superToken = await setupPlatform(app);
  ({ token: adminToken } = await createCompany(app, superToken, 'Imprimerie Test', 'admin@imprimerie.cd'));
});
after(stopDb);

test('signature et lien de paiement en ligne avec QR code', async () => {
  const admin = client(app, adminToken);
  const methods = ['M-Pesa', 'Orange Money', 'Airtel Money', 'Visa'];
  const c = (await admin.put('/api/company', { signature: PNG, paymentLink: 'vpos.flexpaie.com/pay/FPG_DRC', paymentMethods: methods }).expect(200)).body;
  assert.strictEqual(c.signature, PNG);
  assert.strictEqual(c.paymentLink, 'https://vpos.flexpaie.com/pay/FPG_DRC');
  assert.ok(c.paymentQr.startsWith('data:image/png;base64,'));
  assert.deepStrictEqual(c.paymentMethods, methods);

  // Les autres réglages ne touchent ni au lien ni au QR code
  const same = (await admin.put('/api/company', { phone: '+243 800 000 000' }).expect(200)).body;
  assert.strictEqual(same.paymentQr, c.paymentQr);

  await admin.put('/api/company', { paymentLink: 'javascript:alert(1)' }).expect(400);
  await admin.put('/api/company', { signature: 'https://exemple.com/signature.png' }).expect(400);

  const cleared = (await admin.put('/api/company', { paymentLink: '', signature: '' }).expect(200)).body;
  assert.strictEqual(cleared.paymentLink, '');
  assert.strictEqual(cleared.paymentQr, '');
  assert.strictEqual(cleared.signature, '');

  // Un employé ne modifie pas ces réglages
  const employee = client(app, await createUser(app, adminToken, 'Employé', 'vendeur@imprimerie.cd'));
  await employee.put('/api/company', { paymentLink: 'https://pirate.example' }).expect(403);
});

test('modèle importé : zones signature et paiement disponibles, y compris pour un modèle existant', async () => {
  const t = (await client(app, adminToken).get('/api/company/template').expect(200)).body;
  assert.ok(t.zones.signature && t.zones.payment);
  assert.strictEqual(t.zones.signature.visible, true);
});
