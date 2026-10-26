const express = require('express');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { HttpError, pick, toNumber, escapeRegex, paginate } = require('../lib/helpers');
const { requireRole } = require('../lib/auth');
const { logActivity } = require('../lib/activity');
const { moveStock } = require('../lib/stock');

const router = express.Router();
const FIELDS = ['name', 'description', 'category', 'sku', 'unit', 'unitPrice', 'currency', 'priceOnQuote', 'trackStock', 'minStock', 'isActive'];

const sanitize = (body) => {
  const data = pick(body, FIELDS);
  if (data.unitPrice !== undefined) data.unitPrice = Math.max(0, toNumber(data.unitPrice));
  if (data.minStock !== undefined) data.minStock = Math.max(0, toNumber(data.minStock));
  return data;
};

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.active === 'true') filter.isActive = { $ne: false };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.lowStock === 'true') {
    filter.trackStock = true;
    filter.$expr = { $lte: ['$stockQuantity', '$minStock'] };
  }
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ name: rx }, { description: rx }, { sku: rx }, { category: rx }];
  }
  res.json(await Product.find(filter).sort({ category: 1, name: 1 }).limit(2000));
});

router.get('/categories', async (req, res) => {
  res.json((await Product.distinct('category')).filter(Boolean).sort());
});

router.get('/movements', async (req, res) => {
  const filter = {};
  if (req.query.product) filter.product = req.query.product;
  res.json(await paginate(StockMovement, filter, req.query, { createdAt: -1 }, 30));
});

router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const data = sanitize(req.body);
  if (!data.name?.trim()) throw new HttpError(400, 'Le nom du produit est obligatoire.');
  const product = new Product(data);
  await product.save();
  const initialStock = toNumber(req.body.initialStock);
  if (product.trackStock && initialStock) {
    await moveStock({ productId: product._id, delta: initialStock, type: 'adjust', reason: 'Stock initial', user: req.user });
  }
  await logActivity(req.user, 'Produit', `Création du produit ${product.name}`);
  res.status(201).json(await Product.findById(product._id));
});

// Import en masse (grille tarifaire) ; ignore les produits déjà présents
router.post('/bulk', requireRole('admin', 'manager'), async (req, res) => {
  const items = Array.isArray(req.body.products) ? req.body.products : [];
  let created = 0;
  for (const item of items) {
    const data = sanitize(item);
    if (!data.name?.trim()) continue;
    if (await Product.exists({ name: data.name.trim() })) continue;
    await new Product(data).save();
    created += 1;
  }
  await logActivity(req.user, 'Produit', `Import de ${created} produit(s)`);
  res.status(201).json({ created, skipped: items.length - created });
});

router.put('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new HttpError(404, 'Produit introuvable.');
  product.set(sanitize(req.body));
  await product.save();
  await logActivity(req.user, 'Produit', `Modification du produit ${product.name}`);
  res.json(product);
});

// Mouvement de stock manuel : entrée, sortie ou inventaire (quantité absolue)
router.post('/:id/stock', requireRole('admin', 'manager'), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new HttpError(404, 'Produit introuvable.');
  if (!product.trackStock) throw new HttpError(400, 'Le suivi de stock n\'est pas activé pour ce produit.');
  const { type, reason = '', reference = '' } = req.body;
  const quantity = toNumber(req.body.quantity, NaN);
  if (!Number.isFinite(quantity)) throw new HttpError(400, 'Quantité invalide.');
  let delta;
  if (type === 'in') delta = Math.abs(quantity);
  else if (type === 'out') delta = -Math.abs(quantity);
  else if (type === 'adjust') delta = quantity - product.stockQuantity;
  else throw new HttpError(400, 'Type de mouvement invalide.');
  if (delta === 0) return res.json(product);
  const updated = await moveStock({ productId: product._id, delta, type, reason, reference, user: req.user });
  await logActivity(req.user, 'Stock', `${product.name} : ${delta > 0 ? '+' : ''}${delta} (${reason || type})`);
  res.json(updated);
});

router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new HttpError(404, 'Produit introuvable.');
  await logActivity(req.user, 'Produit', `Suppression du produit ${product.name}`);
  res.json({ success: true });
});

module.exports = router;
