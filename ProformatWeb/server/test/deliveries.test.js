const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startDb, stopDb, setupPlatform, createCompany, client } = require('./helpers');

let app;
let admin;

before(async () => {
  app = await startDb();
  const superToken = await setupPlatform(app);
  const { token } = await createCompany(app, superToken, 'Imprimerie Livraison', 'admin@livraison.cd');
  admin = client(app, token);
});
after(stopDb);

test('bon de livraison : depuis une facture, livraisons partielles, plafond et annulation', async () => {
  const year = new Date().getFullYear();
  const inv = (await admin.post('/api/invoices', {
    type: 'Facture', client: 'Hôtel du Fleuve', currency: 'USD',
    products: [{ name: 'Flyers A5', quantity: 500, unitPrice: 0.1 }, { name: 'Roll-up', quantity: 2, unitPrice: 60 }],
  }).expect(201)).body;

  const prep = (await admin.get(`/api/deliveries/prepare/${inv._id}`).expect(200)).body;
  assert.strictEqual(prep.nextNumber, `BL-${year}-0001`);
  assert.deepStrictEqual(prep.lines.map((l) => [l.name, l.ordered, l.remaining]), [['Flyers A5', 500, 500], ['Roll-up', 2, 2]]);

  // Première livraison partielle : 300 flyers, pas de roll-up
  const first = (await admin.post('/api/deliveries', {
    invoiceId: inv._id, receivedBy: 'M. Kabasele', lines: [{ source: 0, delivered: 300 }, { source: 1, delivered: 0 }],
  }).expect(201)).body;
  assert.strictEqual(first.number, `BL-${year}-0001`);
  assert.strictEqual(first.invoiceNumber, inv.number);
  assert.deepStrictEqual(first.lines.map((l) => [l.name, l.ordered, l.delivered]), [['Flyers A5', 500, 300]]);

  const after1 = (await admin.get(`/api/deliveries/prepare/${inv._id}`).expect(200)).body;
  assert.deepStrictEqual(after1.lines.map((l) => l.remaining), [200, 2]);
  // Plus que le reste à livrer : refusé
  await admin.post('/api/deliveries', { invoiceId: inv._id, lines: [{ source: 0, delivered: 250 }] }).expect(400);
  // Sans quantités précisées : tout le reste
  const second = (await admin.post('/api/deliveries', { invoiceId: inv._id }).expect(201)).body;
  assert.deepStrictEqual(second.lines.map((l) => l.delivered), [200, 2]);
  await admin.post('/api/deliveries', { invoiceId: inv._id }).expect(400);

  // Annulation : les quantités redeviennent à livrer
  await admin.post(`/api/deliveries/${second._id}/cancel`, { reason: 'erreur' }).expect(200);
  const after2 = (await admin.get(`/api/deliveries/prepare/${inv._id}`).expect(200)).body;
  assert.deepStrictEqual(after2.lines.map((l) => l.remaining), [200, 2]);

  const list = (await admin.get(`/api/deliveries?invoice=${inv._id}`).expect(200)).body;
  assert.strictEqual(list.total ?? list.items?.length ?? list.length, 2);
});

test('bon de livraison : bon de commande accepté, proforma refusée, livraison libre', async () => {
  const bc = (await admin.post('/api/invoices', { type: 'Bon de commande', client: 'Pharmacie', products: [{ name: 'Cartes', quantity: 100, unitPrice: 0.2 }] }).expect(201)).body;
  await admin.post('/api/deliveries', { invoiceId: bc._id }).expect(201);
  const pro = (await admin.post('/api/invoices', { type: 'Proforma', client: 'Ecole', products: [{ name: 'Bâche', quantity: 1, unitPrice: 20 }] }).expect(201)).body;
  await admin.post('/api/deliveries', { invoiceId: pro._id }).expect(400);

  await admin.post('/api/deliveries', { lines: [{ name: 'Colis', delivered: 1 }] }).expect(400); // client obligatoire
  const free = (await admin.post('/api/deliveries', { client: 'Client comptoir', lines: [{ name: 'Colis', ordered: 3, delivered: 3 }] }).expect(201)).body;
  assert.strictEqual(free.invoice, null);
  assert.strictEqual(free.lines[0].delivered, 3);
});
