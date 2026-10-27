const express = require('express');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const CashMovement = require('../models/CashMovement');
const { ACCOUNTS, accountForMethod } = require('../models/CashMovement');
const {
  HttpError, toNumber, parseDate, dateRangeFilter, round2, CURRENCIES,
} = require('../lib/helpers');
const { can } = require('../lib/auth');
const { logActivity } = require('../lib/activity');

const router = express.Router();

const JOURNAL_LIMIT = 300;

const canView = (req) => can(req, 'payments.create') || can(req, 'expenses.manage') || can(req, 'reports.view');
const canMove = (req) => can(req, 'payments.create') || can(req, 'expenses.manage');

router.use((req, res, next) => {
  if (!canView(req)) return next(new HttpError(403, 'Accès refusé : vous n\'avez pas accès à la trésorerie.'));
  next();
});

// Modes de paiement qui alimentent un compte donné
const methodsFor = (account) => {
  if (account === 'Caisse') return ['Espèces'];
  if (account === 'Mobile Money') return ['Mobile Money'];
  return { $nin: ['Espèces', 'Mobile Money'] };
};

const emptyBalances = () => Object.fromEntries(ACCOUNTS.map((a) => [a, { USD: 0, FC: 0 }]));

// Soldes de chaque compte, par devise, à une date donnée (incluse)
const balancesAt = async (company, until) => {
  const date = until ? { date: { $lte: until } } : {};
  const [payments, expenses, movements] = await Promise.all([
    Payment.aggregate([{ $match: { company, ...date } }, { $group: { _id: { method: '$method', currency: '$currency' }, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { company, ...date } }, { $group: { _id: { method: '$paymentMethod', currency: '$currency' }, total: { $sum: '$amount' } } }]),
    CashMovement.find({ company, ...date }).lean(),
  ]);
  const balances = emptyBalances();
  for (const p of payments) balances[accountForMethod(p._id.method)][p._id.currency] += p.total;
  for (const e of expenses) balances[accountForMethod(e._id.method)][e._id.currency] -= e.total;
  for (const m of movements) {
    if (m.type === 'transfer') {
      balances[m.account][m.currency] -= m.amount;
      balances[m.toAccount][m.currency] += m.amount;
    } else {
      balances[m.account][m.currency] += m.amount;
    }
  }
  for (const a of ACCOUNTS) for (const c of CURRENCIES) balances[a][c] = round2(balances[a][c]);
  return balances;
};

// Toutes les entrées et sorties d'argent d'une période, de la plus récente à la plus ancienne
const journal = async (company, range, account) => {
  const date = range ? { date: range } : {};
  const paymentFilter = { company, ...date, ...(account ? { method: methodsFor(account) } : {}) };
  const expenseFilter = { company, ...date, ...(account ? { paymentMethod: methodsFor(account) } : {}) };
  const movementFilter = { company, ...date, ...(account ? { $or: [{ account }, { toAccount: account }] } : {}) };
  const [payments, expenses, movements] = await Promise.all([
    Payment.find(paymentFilter).sort({ date: -1 }).limit(JOURNAL_LIMIT).lean(),
    Expense.find(expenseFilter).sort({ date: -1 }).limit(JOURNAL_LIMIT).lean(),
    CashMovement.find(movementFilter).sort({ date: -1 }).limit(JOURNAL_LIMIT).lean(),
  ]);
  const entries = [
    ...payments.map((p) => ({
      _id: p._id, kind: 'payment', date: p.date, amount: p.amount, currency: p.currency, account: accountForMethod(p.method),
      label: `Encaissement ${p.invoiceNumber}`, detail: [p.client, p.method, p.reference].filter(Boolean).join(' · '), invoice: p.invoice,
    })),
    ...expenses.map((e) => ({
      _id: e._id, kind: 'expense', date: e.date, amount: -e.amount, currency: e.currency, account: accountForMethod(e.paymentMethod),
      label: e.description, detail: [e.category, e.supplier].filter(Boolean).join(' · '),
    })),
    ...movements.map((m) => {
      if (m.type === 'transfer') {
        // Vu depuis un compte, un virement est une sortie (compte d'origine) ou une entrée (compte de destination)
        const incoming = account && m.toAccount === account;
        return {
          _id: m._id, kind: 'transfer', date: m.date, amount: account ? (incoming ? m.amount : -m.amount) : m.amount, currency: m.currency,
          account: m.account, toAccount: m.toAccount, label: m.label || `Virement ${m.account} → ${m.toAccount}`, detail: `${m.account} → ${m.toAccount}`,
          deletable: true,
        };
      }
      return {
        _id: m._id, kind: m.type, date: m.date, amount: m.amount, currency: m.currency, account: m.account,
        label: m.label || (m.type === 'opening' ? 'Solde de départ' : 'Entrée d\'argent'), detail: m.createdBy, deletable: true,
      };
    }),
  ];
  return entries.sort((a, b) => new Date(b.date) - new Date(a.date) || String(b._id).localeCompare(String(a._id))).slice(0, JOURNAL_LIMIT);
};

router.get('/', async (req, res) => {
  const company = req.company._id;
  const range = dateRangeFilter(req.query.from, req.query.to);
  const account = ACCOUNTS.includes(req.query.account) ? req.query.account : null;
  const [balances, entries] = await Promise.all([balancesAt(company, range?.$lte), journal(company, range, account)]);

  // Entrées et sorties de la période (les virements internes ne changent pas le total)
  const period = { in: { USD: 0, FC: 0 }, out: { USD: 0, FC: 0 } };
  for (const e of entries) {
    if (e.kind === 'transfer' && !account) continue;
    if (e.amount >= 0) period.in[e.currency] += e.amount;
    else period.out[e.currency] -= e.amount;
  }
  for (const k of ['in', 'out']) for (const c of CURRENCIES) period[k][c] = round2(period[k][c]);

  res.json({
    accounts: ACCOUNTS,
    balances,
    period,
    entries,
    truncated: entries.length >= JOURNAL_LIMIT,
    exchangeRate: req.company.exchangeRate,
    reportingCurrency: req.company.reportingCurrency || 'USD',
  });
});

router.post('/movements', async (req, res) => {
  if (!canMove(req)) throw new HttpError(403, 'Accès refusé : enregistrer des mouvements d\'argent n\'est pas autorisé pour votre rôle.');
  const type = ['opening', 'in', 'transfer'].includes(req.body.type) ? req.body.type : null;
  if (!type) throw new HttpError(400, 'Type de mouvement invalide.');
  const amount = toNumber(req.body.amount);
  if (!(amount > 0)) throw new HttpError(400, 'Le montant doit être supérieur à zéro.');
  const { account, toAccount, currency } = req.body;
  if (!ACCOUNTS.includes(account)) throw new HttpError(400, 'Compte invalide.');
  if (!CURRENCIES.includes(currency)) throw new HttpError(400, 'Devise invalide.');
  if (type === 'transfer' && (!ACCOUNTS.includes(toAccount) || toAccount === account)) {
    throw new HttpError(400, 'Choisissez deux comptes différents pour le virement.');
  }
  if (type === 'in' && !String(req.body.label || '').trim()) throw new HttpError(400, 'Indiquez l\'origine de cet argent.');
  const movement = await CashMovement.create({
    company: req.company._id, type, account, toAccount: type === 'transfer' ? toAccount : undefined, amount, currency,
    date: parseDate(req.body.date) || new Date(), label: String(req.body.label || '').trim(), createdBy: req.user.email,
  });
  const what = type === 'transfer' ? `Virement ${account} → ${toAccount}` : type === 'opening' ? `Solde de départ ${account}` : `Entrée d'argent (${account})`;
  await logActivity(req.user, 'Trésorerie', `${what} : ${amount} ${currency}${movement.label ? ` — ${movement.label}` : ''}`);
  res.status(201).json(movement);
});

router.delete('/movements/:id', async (req, res) => {
  if (!canMove(req)) throw new HttpError(403, 'Accès refusé.');
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Mouvement introuvable.');
  const movement = await CashMovement.findOneAndDelete({ _id: req.params.id, company: req.company._id });
  if (!movement) throw new HttpError(404, 'Mouvement introuvable.');
  await logActivity(req.user, 'Trésorerie', `Suppression d'un mouvement de ${movement.amount} ${movement.currency} (${movement.account})`);
  res.json({ success: true });
});

module.exports = router;
