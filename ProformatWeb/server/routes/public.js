const express = require('express');
const Invoice = require('../models/Invoice');
const Company = require('../models/Company');
const InvoiceTemplate = require('../models/InvoiceTemplate');
const { HttpError } = require('../lib/helpers');
const { serialize: serializeTemplate } = require('./template');

// Pages publiques, sans compte : un client ouvre sa facture avec le lien secret reçu (WhatsApp, e-mail…)
const router = express.Router();

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

const COMPANY_FIELDS = ['name', 'logo', 'footerImage', 'primaryColor', 'secondaryColor', 'accentColor', 'legalName', 'address', 'city',
  'email', 'phone', 'taxNumber', 'nationalId', 'rccm', 'bankName', 'bankAccount', 'signature', 'paymentLink', 'paymentQr', 'paymentMethods'];

const INVOICE_FIELDS = ['number', 'type', 'client', 'clientActivity', 'issueDate', 'dueDate', 'currency', 'products', 'subtotal', 'discount',
  'totalAmount', 'amountPaid', 'balance', 'status', 'notes'];

const pickFields = (doc, fields) => Object.fromEntries(fields.map((f) => [f, doc[f]]));

router.get('/invoices/:token', async (req, res) => {
  const notFound = new HttpError(404, 'Ce lien de facture n\'est pas valide ou a été retiré.');
  if (!TOKEN.test(req.params.token)) throw notFound;
  const invoice = await Invoice.findOne({ publicToken: req.params.token });
  if (!invoice) throw notFound;
  const company = await Company.findById(invoice.company);
  if (!company || !company.isActive) throw notFound;
  const template = await InvoiceTemplate.findOne({ company: company._id });
  const custom = template?.mode === 'custom' && template.background;

  res.set('Cache-Control', 'no-store');
  res.json({
    invoice: pickFields(invoice.toJSON(), INVOICE_FIELDS),
    company: pickFields(company.toJSON(), COMPANY_FIELDS),
    template: custom ? pickFields(serializeTemplate(template), ['mode', 'background', 'pageSize', 'zones', 'style', 'labels']) : null,
  });
});

module.exports = router;
