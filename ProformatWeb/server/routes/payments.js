const express = require('express');
const Payment = require('../models/Payment');
const PaymentNotice = require('../models/PaymentNotice');
const { paginate, dateRangeFilter, escapeRegex } = require('../lib/helpers');

const router = express.Router();

// Journal des encaissements
router.get('/', async (req, res) => {
  const filter = { company: req.company._id };
  const range = dateRangeFilter(req.query.from, req.query.to);
  if (range) filter.date = range;
  if (req.query.method) filter.method = String(req.query.method);
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ invoiceNumber: rx }, { client: rx }, { reference: rx }];
  }
  res.json(await paginate(Payment, filter, req.query, { date: -1 }, 20));
});

// Paiements annoncés par les clients et pas encore vérifiés
router.get('/notices', async (req, res) => {
  res.json(await PaymentNotice.find({ company: req.company._id, status: 'En attente' }).sort({ createdAt: -1 }).limit(50).lean());
});

module.exports = router;
