const express = require('express');
const Activity = require('../models/Activity');
const { paginate, dateRangeFilter, escapeRegex } = require('../lib/helpers');

const router = express.Router();

router.get('/', async (req, res) => {
  const filter = {};
  const range = dateRangeFilter(req.query.from, req.query.to);
  if (range) filter.date = range;
  if (req.query.action) filter.action = req.query.action;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ userEmail: rx }, { details: rx }, { action: rx }];
  }
  res.json(await paginate(Activity, filter, req.query, { date: -1 }, 25));
});

module.exports = router;
