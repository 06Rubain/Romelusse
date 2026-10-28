const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Company = require('../models/Company');
const User = require('../models/User');
const Role = require('../models/Role');
const Invoice = require('../models/Invoice');
const { createDefaultRoles } = require('../models/Role');
const Activity = require('../models/Activity');
const { HttpError, paginate } = require('../lib/helpers');
const { requireSuperAdmin, sessionUser } = require('../lib/auth');
const { sanitizeCompany } = require('../lib/company');
const { logActivity } = require('../lib/activity');
const { resetCompanyData } = require('../lib/reset');
const { validatePassword, normalizeEmail } = require('./auth');

// Console OmniCom : seule l'équipe OmniCom crée les entreprises et leurs administrateurs
const router = express.Router();
router.use(requireSuperAdmin);

const findCompany = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Entreprise introuvable.');
  const company = await Company.findById(id);
  if (!company) throw new HttpError(404, 'Entreprise introuvable.');
  return company;
};

const createAccount = async ({ email, displayName, password }, extra) => {
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) throw new HttpError(400, 'Adresse e-mail de l\'administrateur invalide.');
  validatePassword(password);
  if (await User.exists({ email: normalized })) throw new HttpError(409, `Un compte existe déjà avec l'e-mail ${normalized}.`);
  return User.create({ email: normalized, displayName: displayName || '', passwordHash: await bcrypt.hash(password, 12), ...extra });
};

const adminRole = (companyId) => Role.findOne({ company: companyId, isSystem: true });

router.get('/companies', async (req, res) => {
  const [companies, users, invoices] = await Promise.all([
    Company.find().select('-footerImage').sort({ name: 1 }),
    User.aggregate([{ $match: { company: { $ne: null } } }, { $group: { _id: '$company', count: { $sum: 1 } } }]),
    Invoice.aggregate([{ $group: { _id: '$company', count: { $sum: 1 }, last: { $max: '$createdAt' } } }]),
  ]);
  const userCount = Object.fromEntries(users.map((u) => [String(u._id), u.count]));
  const invoiceStats = Object.fromEntries(invoices.map((i) => [String(i._id), i]));
  res.json(companies.map((c) => ({
    ...c.toJSON(),
    userCount: userCount[String(c._id)] || 0,
    invoiceCount: invoiceStats[String(c._id)]?.count || 0,
    lastInvoiceAt: invoiceStats[String(c._id)]?.last || null,
  })));
});

router.get('/companies/:id', async (req, res) => {
  const company = await findCompany(req.params.id);
  const users = await User.find({ company: company._id }).populate('roleId').sort({ createdAt: 1 });
  res.json({ company, users: users.map(sessionUser) });
});

// Création d'une entreprise avec ses rôles par défaut et son premier administrateur
router.post('/companies', async (req, res) => {
  const data = sanitizeCompany(req.body);
  if (!data.name) throw new HttpError(400, 'Le nom de l\'entreprise est obligatoire.');
  if (await Company.exists({ name: data.name })) throw new HttpError(409, 'Une entreprise porte déjà ce nom.');
  const admin = req.body.admin || {};
  // Validation de l'administrateur avant toute écriture
  const email = normalizeEmail(admin.email);
  if (!email.includes('@')) throw new HttpError(400, 'Adresse e-mail de l\'administrateur invalide.');
  validatePassword(admin.password);
  if (await User.exists({ email })) throw new HttpError(409, `Un compte existe déjà avec l'e-mail ${email}.`);

  const company = await Company.create({ ...data, legalName: data.legalName || data.name, createdBy: req.user.email });
  await createDefaultRoles(company._id);
  const user = await createAccount(admin, { company: company._id, roleId: (await adminRole(company._id))._id });
  await logActivity(req.user, 'Plateforme', `Création de l'entreprise ${company.name} (admin : ${user.email})`, null);
  res.status(201).json({ company, admin: sessionUser(await user.populate('roleId')) });
});

router.put('/companies/:id', async (req, res) => {
  const company = await findCompany(req.params.id);
  const data = sanitizeCompany(req.body);
  if (data.name === '') throw new HttpError(400, 'Le nom de l\'entreprise est obligatoire.');
  if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
  company.set(data);
  await company.save();
  const what = req.body.isActive === undefined ? 'Modification' : company.isActive ? 'Réactivation' : 'Suspension';
  await logActivity(req.user, 'Plateforme', `${what} de l'entreprise ${company.name}`, null);
  res.json(company);
});

// Effacement des données de test d'une entreprise par OmniCom
router.post('/companies/:id/reset', async (req, res) => {
  const company = await findCompany(req.params.id);
  const result = await resetCompanyData(company, req.body);
  const summary = Object.entries(result.deleted).map(([k, n]) => `${n} ${k}`).join(', ') || 'rien';
  await logActivity(req.user, 'Plateforme', `Effacement des données de test de ${company.name} : ${summary}`, null);
  await logActivity(req.user, 'Paramètres', `Effacement des données de test par OmniCom : ${summary}`, company._id);
  res.json(result);
});

router.post('/companies/:id/admins', async (req, res) => {
  const company = await findCompany(req.params.id);
  const user = await createAccount(req.body, { company: company._id, roleId: (await adminRole(company._id))._id });
  await logActivity(req.user, 'Plateforme', `Ajout de l'administrateur ${user.email} à ${company.name}`, null);
  res.status(201).json(sessionUser(await user.populate('roleId')));
});

router.post('/companies/:id/users/:userId/reset-password', async (req, res) => {
  const company = await findCompany(req.params.id);
  validatePassword(req.body.password);
  const user = await User.findOne({ _id: req.params.userId, company: company._id });
  if (!user) throw new HttpError(404, 'Utilisateur introuvable.');
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.isBlocked = false;
  await user.save();
  await logActivity(req.user, 'Plateforme', `Réinitialisation du mot de passe de ${user.email} (${company.name})`, null);
  res.json({ success: true });
});

// Équipe OmniCom
router.get('/admins', async (req, res) => {
  res.json((await User.find({ isSuperAdmin: true }).sort({ createdAt: 1 })).map(sessionUser));
});

router.post('/admins', async (req, res) => {
  const user = await createAccount(req.body, { isSuperAdmin: true });
  await logActivity(req.user, 'Plateforme', `Ajout du super-admin ${user.email}`, null);
  res.status(201).json(sessionUser(user));
});

router.get('/activities', async (req, res) => {
  res.json(await paginate(Activity, { company: null }, req.query, { date: -1 }, 25));
});

module.exports = router;
