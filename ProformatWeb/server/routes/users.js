const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');
const { HttpError } = require('../lib/helpers');
const { requirePermission, sessionUser } = require('../lib/auth');
const { logActivity } = require('../lib/activity');
const { validatePassword, normalizeEmail } = require('./auth');

const router = express.Router();
router.use(requirePermission('users.manage'));

const companyRole = async (req, roleId) => {
  const role = roleId && await Role.findOne({ _id: roleId, company: req.company._id }).catch(() => null);
  if (!role) throw new HttpError(400, 'Rôle invalide.');
  return role;
};

const findUser = async (req) => {
  const user = await User.findOne({ _id: req.params.id, company: req.company._id }).populate('roleId');
  if (!user) throw new HttpError(404, 'Utilisateur introuvable.');
  return user;
};

// Empêche une entreprise de se retrouver sans administrateur actif
const ensureAnotherAdmin = async (req, user) => {
  if (!user.roleId?.isSystem) return;
  const others = await User.countDocuments({ company: req.company._id, roleId: user.roleId._id, isBlocked: false, _id: { $ne: user._id } });
  if (!others) throw new HttpError(400, 'L\'entreprise doit garder au moins un administrateur actif.');
};

router.get('/', async (req, res) => {
  const users = await User.find({ company: req.company._id }).populate('roleId').sort({ createdAt: -1 });
  res.json(users.map(sessionUser));
});

router.post('/', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password, displayName } = req.body;
  if (!email.includes('@')) throw new HttpError(400, 'Adresse e-mail invalide.');
  const role = await companyRole(req, req.body.roleId);
  validatePassword(password);
  if (await User.exists({ email })) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail.');
  const user = await User.create({
    email, displayName: displayName || '', company: req.company._id, roleId: role._id, passwordHash: await bcrypt.hash(password, 12),
  });
  await logActivity(req.user, 'Équipe', `Création du compte ${email} (${role.name})`);
  res.status(201).json(sessionUser(await user.populate('roleId')));
});

router.patch('/:id', async (req, res) => {
  const user = await findUser(req);
  const isSelf = String(user._id) === String(req.user._id);
  const { roleId, isBlocked, displayName } = req.body;
  const changes = [];
  if (roleId !== undefined && String(roleId) !== String(user.roleId?._id)) {
    if (isSelf) throw new HttpError(400, 'Vous ne pouvez pas changer votre propre rôle.');
    const role = await companyRole(req, roleId);
    await ensureAnotherAdmin(req, user);
    user.roleId = role;
    changes.push(`rôle : ${role.name}`);
  }
  if (isBlocked !== undefined) {
    if (isSelf && isBlocked) throw new HttpError(400, 'Vous ne pouvez pas bloquer votre propre compte.');
    if (isBlocked) await ensureAnotherAdmin(req, user);
    user.isBlocked = Boolean(isBlocked);
    changes.push(user.isBlocked ? 'bloqué' : 'débloqué');
  }
  if (typeof displayName === 'string') user.displayName = displayName.trim();
  await user.save();
  await logActivity(req.user, 'Équipe', `Modification du compte ${user.email}${changes.length ? ` — ${changes.join(', ')}` : ''}`);
  res.json(sessionUser(user));
});

router.post('/:id/reset-password', async (req, res) => {
  validatePassword(req.body.password);
  const user = await findUser(req);
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  await user.save();
  await logActivity(req.user, 'Équipe', `Réinitialisation du mot de passe de ${user.email}`);
  res.json({ success: true });
});

router.post('/:id/reset-2fa', async (req, res) => {
  const user = await findUser(req);
  user.twoFactorEnabled = false;
  user.twoFactorSecret = null;
  await user.save();
  await logActivity(req.user, 'Équipe', `Réinitialisation de la 2FA de ${user.email}`);
  res.json(sessionUser(user));
});

module.exports = router;
