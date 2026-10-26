const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { ROLES } = require('../models/User');
const { HttpError } = require('../lib/helpers');
const { requireRole } = require('../lib/auth');
const { logActivity } = require('../lib/activity');
const { validatePassword, normalizeEmail } = require('./auth');

const router = express.Router();
router.use(requireRole('admin'));

router.get('/', async (req, res) => {
  res.json(await User.find().sort({ createdAt: -1 }));
});

router.post('/', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password, displayName, role = 'user' } = req.body;
  if (!email.includes('@')) throw new HttpError(400, 'Adresse e-mail invalide.');
  if (!ROLES.includes(role)) throw new HttpError(400, 'Rôle invalide.');
  validatePassword(password);
  if (await User.exists({ email })) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail.');
  const user = await User.create({
    email, displayName: displayName || '', role, passwordHash: await bcrypt.hash(password, 12),
  });
  await logActivity(req.user, 'Équipe', `Création du compte ${email} (${role})`);
  res.status(201).json(user);
});

router.patch('/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'Utilisateur introuvable.');
  const isSelf = String(user._id) === String(req.user._id);
  const { role, isBlocked, displayName } = req.body;
  if (role !== undefined) {
    if (!ROLES.includes(role)) throw new HttpError(400, 'Rôle invalide.');
    if (isSelf && role !== 'admin') throw new HttpError(400, 'Vous ne pouvez pas retirer vos propres droits administrateur.');
    user.role = role;
  }
  if (isBlocked !== undefined) {
    if (isSelf && isBlocked) throw new HttpError(400, 'Vous ne pouvez pas bloquer votre propre compte.');
    user.isBlocked = Boolean(isBlocked);
  }
  if (typeof displayName === 'string') user.displayName = displayName.trim();
  await user.save();
  await logActivity(req.user, 'Équipe', `Modification du compte ${user.email}`
    + (role !== undefined ? ` — rôle : ${user.role}` : '')
    + (isBlocked !== undefined ? ` — ${user.isBlocked ? 'bloqué' : 'débloqué'}` : ''));
  res.json(user);
});

router.post('/:id/reset-password', async (req, res) => {
  validatePassword(req.body.password);
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'Utilisateur introuvable.');
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  await user.save();
  await logActivity(req.user, 'Équipe', `Réinitialisation du mot de passe de ${user.email}`);
  res.json({ success: true });
});

router.post('/:id/reset-2fa', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'Utilisateur introuvable.');
  user.twoFactorEnabled = false;
  user.twoFactorSecret = null;
  await user.save();
  await logActivity(req.user, 'Équipe', `Réinitialisation de la 2FA de ${user.email}`);
  res.json(user);
});

module.exports = router;
