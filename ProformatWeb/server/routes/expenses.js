const express = require('express');
const Expense = require('../models/Expense');
const { CATEGORIES } = require('../models/Expense');
const {
  HttpError, pick, toNumber, parseDate, paginate, dateRangeFilter, escapeRegex, CURRENCIES,
} = require('../lib/helpers');
const { logActivity } = require('../lib/activity');

const router = express.Router();
const FIELDS = ['date', 'category', 'description', 'supplier', 'amount', 'currency', 'paymentMethod', 'reference'];

const sanitize = (body) => {
  const data = pick(body, FIELDS);
  if (data.amount !== undefined) data.amount = toNumber(data.amount);
  if (data.date !== undefined) data.date = parseDate(data.date) || new Date();
  if (data.currency !== undefined && !CURRENCIES.includes(data.currency)) data.currency = 'USD';
  return data;
};

router.get('/categories', (req, res) => res.json(CATEGORIES));

router.get('/', async (req, res) => {
  const filter = {};
  const range = dateRangeFilter(req.query.from, req.query.to);
  if (range) filter.date = range;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ description: rx }, { supplier: rx }, { reference: rx }];
  }
  const [page, totals] = await Promise.all([
    paginate(Expense, filter, req.query, { date: -1 }, 20),
    Expense.aggregate([{ $match: filter }, { $group: { _id: '$currency', total: { $sum: '$amount' } } }]),
  ]);
  res.json({ ...page, totals: Object.fromEntries(totals.map((t) => [t._id, t.total])) });
});

router.post('/', async (req, res) => {
  const data = sanitize(req.body);
  if (!data.description?.trim()) throw new HttpError(400, 'La description est obligatoire.');
  if (!(data.amount > 0)) throw new HttpError(400, 'Montant invalide.');
  const expense = await Expense.create({ ...data, createdBy: req.user.email });
  await logActivity(req.user, 'Dépense', `${expense.description} — ${expense.amount} ${expense.currency}`);
  res.status(201).json(expense);
});

router.put('/:id', async (req, res) => {
  const data = sanitize(req.body);
  if (data.amount !== undefined && !(data.amount > 0)) throw new HttpError(400, 'Montant invalide.');
  const expense = await Expense.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!expense) throw new HttpError(404, 'Dépense introuvable.');
  await logActivity(req.user, 'Dépense', `Modification : ${expense.description}`);
  res.json(expense);
});

router.delete('/:id', async (req, res) => {
  const expense = await Expense.findByIdAndDelete(req.params.id);
  if (!expense) throw new HttpError(404, 'Dépense introuvable.');
  await logActivity(req.user, 'Dépense', `Suppression : ${expense.description} — ${expense.amount} ${expense.currency}`);
  res.json({ success: true });
});

module.exports = router;
