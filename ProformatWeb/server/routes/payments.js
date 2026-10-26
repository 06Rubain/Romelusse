const express = require('express');
const Payment = require('../models/Payment');
const { paginate, dateRangeFilter, escapeRegex } = require('../lib/helpers');

const router = express.Router();

// Journal des encaissements
router.get('/', async (req, res) => {
  const filter = {};
  const range = dateRangeFilter(req.query.from, req.query.to);
  if (range) filter.date = range;
  if (req.query.method) filter.method = req.query.method;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ invoiceNumber: rx }, { client: rx }, { reference: rx }];
  }
  res.json(await paginate(Payment, filter, req.query, { date: -1 }, 20));
});

module.exports = router;
