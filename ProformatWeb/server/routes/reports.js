const express = require('express');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Product = require('../models/Product');
const Client = require('../models/Client');
const { round2, dateRangeFilter } = require('../lib/helpers');
const { isManager } = require('../lib/auth');
const { getSettings } = require('../lib/settings');

const router = express.Router();

const ACTIVE_INVOICE = { type: 'Facture', status: { $in: ['En attente', 'Partiellement payée', 'Payée'] } };
const OPEN_INVOICE = { type: 'Facture', status: { $in: ['En attente', 'Partiellement payée'] } };

// Expression d'agrégation convertissant un montant vers la devise de reporting
const toReporting = (field, reporting, rate) => {
  if (!rate) return field;
  const other = reporting === 'USD' ? 'FC' : 'USD';
  const converted = reporting === 'USD' ? { $divide: [field, rate] } : { $multiply: [field, rate] };
  return { $cond: [{ $eq: ['$currency', other] }, converted, field] };
};

const sumByCurrency = async (model, match, field, reporting, rate) => {
  const rows = await model.aggregate([
    { $match: match },
    { $group: {
      _id: '$currency',
      amount: { $sum: field },
      converted: { $sum: toReporting(field, reporting, rate) },
      count: { $sum: 1 },
    } },
  ]);
  const byCurrency = {};
  let total = 0;
  let count = 0;
  for (const r of rows) {
    byCurrency[r._id] = round2(r.amount);
    total += r.converted;
    count += r.count;
  }
  return { byCurrency, total: round2(total), count };
};

const monthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const monthlySeries = async (model, match, dateField, valueField, reporting, rate, since) => {
  const rows = await model.aggregate([
    { $match: { ...match, [dateField]: { $gte: since } } },
    { $group: {
      _id: { $dateToString: { format: '%Y-%m', date: `$${dateField}` } },
      total: { $sum: toReporting(valueField, reporting, rate) },
    } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, round2(r.total)]));
};

router.get('/summary', async (req, res) => {
  const settings = await getSettings();
  const reporting = settings.reportingCurrency;
  const rate = settings.exchangeRate;
  const canSeeFinance = isManager(req.user);

  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const range = dateRangeFilter(req.query.from || defaultFrom, req.query.to || now);

  const months = Math.min(24, Math.max(3, parseInt(req.query.months, 10) || 12));
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const [invoiced, collected, expenses, receivables, overdue] = await Promise.all([
    sumByCurrency(Invoice, { ...ACTIVE_INVOICE, issueDate: range }, '$totalAmount', reporting, rate),
    sumByCurrency(Payment, { date: range }, '$amount', reporting, rate),
    canSeeFinance ? sumByCurrency(Expense, { date: range }, '$amount', reporting, rate) : null,
    sumByCurrency(Invoice, OPEN_INVOICE, { $subtract: ['$totalAmount', '$amountPaid'] }, reporting, rate),
    sumByCurrency(Invoice, { ...OPEN_INVOICE, dueDate: { $lt: now } }, { $subtract: ['$totalAmount', '$amountPaid'] }, reporting, rate),
  ]);

  const [monthlyInvoiced, monthlyCollected, monthlyExpenses] = await Promise.all([
    monthlySeries(Invoice, ACTIVE_INVOICE, 'issueDate', '$totalAmount', reporting, rate, since),
    monthlySeries(Payment, {}, 'date', '$amount', reporting, rate, since),
    canSeeFinance ? monthlySeries(Expense, {}, 'date', '$amount', reporting, rate, since) : {},
  ]);
  const monthly = [];
  for (let i = 0; i < months; i += 1) {
    const key = monthKey(new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1)));
    monthly.push({
      month: key,
      invoiced: monthlyInvoiced[key] || 0,
      collected: monthlyCollected[key] || 0,
      expenses: canSeeFinance ? (monthlyExpenses[key] || 0) : null,
    });
  }

  const [topClients, topProducts, lowStock, pendingProformas, clientCount, productCount] = await Promise.all([
    Invoice.aggregate([
      { $match: { ...ACTIVE_INVOICE, issueDate: range } },
      { $group: { _id: '$client', total: { $sum: toReporting('$totalAmount', reporting, rate) }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]),
    Invoice.aggregate([
      { $match: { ...ACTIVE_INVOICE, issueDate: range } },
      { $unwind: '$products' },
      { $group: {
        _id: '$products.name',
        quantity: { $sum: '$products.quantity' },
        total: { $sum: toReporting('$products.lineTotal', reporting, rate) },
      } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]),
    Product.find({ trackStock: true, isActive: { $ne: false }, $expr: { $lte: ['$stockQuantity', '$minStock'] } })
      .sort({ stockQuantity: 1 }).limit(20),
    Invoice.countDocuments({ type: 'Proforma', status: 'En attente' }),
    Client.countDocuments({ isArchived: { $ne: true } }),
    Product.countDocuments({ isActive: { $ne: false } }),
  ]);

  res.json({
    reportingCurrency: reporting,
    exchangeRate: rate,
    period: { from: range.$gte, to: range.$lte },
    invoiced,
    collected,
    expenses,
    profit: canSeeFinance ? round2(collected.total - expenses.total) : null,
    receivables,
    overdue,
    monthly,
    topClients: topClients.map((c) => ({ name: c._id, total: round2(c.total), count: c.count })),
    topProducts: topProducts.map((p) => ({ name: p._id, quantity: p.quantity, total: round2(p.total) })),
    lowStock,
    counts: { pendingProformas, clients: clientCount, products: productCount },
  });
});

module.exports = router;
