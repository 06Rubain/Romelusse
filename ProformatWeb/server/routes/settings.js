const express = require('express');
const Setting = require('../models/Setting');
const { pick, toNumber, CURRENCIES } = require('../lib/helpers');
const { requireRole } = require('../lib/auth');
const { getSettings } = require('../lib/settings');
const { logActivity } = require('../lib/activity');

const router = express.Router();
const FIELDS = ['companyName', 'legalName', 'address', 'city', 'email', 'phone', 'taxNumber', 'nationalId', 'rccm', 'bankName', 'bankAccount', 'exchangeRate', 'reportingCurrency', 'paymentTermDays'];

router.get('/', async (req, res) => res.json(await getSettings()));

router.put('/', requireRole('admin'), async (req, res) => {
  await getSettings();
  const data = pick(req.body, FIELDS);
  if (data.exchangeRate !== undefined) data.exchangeRate = Math.max(0, toNumber(data.exchangeRate));
  if (data.paymentTermDays !== undefined) data.paymentTermDays = Math.max(0, Math.round(toNumber(data.paymentTermDays)));
  if (data.reportingCurrency !== undefined && !CURRENCIES.includes(data.reportingCurrency)) delete data.reportingCurrency;
  const settings = await Setting.findByIdAndUpdate('company', data, { new: true, runValidators: true });
  await logActivity(req.user, 'Paramètres', 'Mise à jour des paramètres de l\'entreprise');
  res.json(settings);
});

module.exports = router;
