const express = require('express');
const bcrypt = require('bcryptjs');
const qrcode = require('qrcode');
const otp = require('otplib');
const User = require('../models/User');
const { HttpError } = require('../lib/helpers');
const { logActivity } = require('../lib/activity');
const {
  signSession, signTwoFactorChallenge, verifyTwoFactorChallenge, requireAuth,
} = require('../lib/auth');

const router = express.Router();

const MIN_PASSWORD = 8;

const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    throw new HttpError(400, `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`);
  }
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const needsSetup = async () => !(await User.exists({ role: 'admin', passwordHash: { $exists: true, $ne: null } }));

const sessionResponse = async (user) => {
  user.lastLoginAt = new Date();
  await user.save();
  await logActivity(user, 'Connexion', 'Connexion à l\'application');
  return { token: signSession(user), user };
};

const verifyCode = (secret, code) => {
  if (!secret || !/^\d{6}$/.test(String(code || ''))) return false;
  return otp.verifySync({ secret, token: String(code), epochTolerance: 30 }).valid;
};

router.get('/status', async (req, res) => {
  res.json({ needsSetup: await needsSetup() });
});

// Création du premier administrateur (uniquement si aucun n'existe)
router.post('/setup', async (req, res) => {
  if (!(await needsSetup())) throw new HttpError(409, 'L\'application est déjà configurée.');
  const email = normalizeEmail(req.body.email);
  const { password, displayName } = req.body;
  if (!email.includes('@')) throw new HttpError(400, 'Adresse e-mail invalide.');
  validatePassword(password);
  const passwordHash = await bcrypt.hash(password, 12);
  let user = await User.findOne({ email });
  if (user) {
    user.passwordHash = passwordHash;
    user.role = 'admin';
    user.isBlocked = false;
    if (displayName) user.displayName = displayName;
  } else {
    user = new User({ email, passwordHash, displayName: displayName || '', role: 'admin' });
  }
  await user.save();
  res.status(201).json(await sessionResponse(user));
});

router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  if (!email || !password) throw new HttpError(400, 'E-mail et mot de passe requis.');
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = user?.passwordHash && await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) throw new HttpError(401, 'E-mail ou mot de passe incorrect.');
  if (user.isBlocked) throw new HttpError(403, 'Compte bloqué. Contactez un administrateur.');
  if (user.twoFactorEnabled) {
    return res.json({ requires2fa: true, challenge: signTwoFactorChallenge(user) });
  }
  res.json(await sessionResponse(user));
});

router.post('/login/2fa', async (req, res) => {
  const userId = verifyTwoFactorChallenge(req.body.challenge);
  const user = await User.findById(userId).select('+twoFactorSecret');
  if (!user || user.isBlocked) throw new HttpError(403, 'Accès refusé.');
  if (!verifyCode(user.twoFactorSecret, req.body.code)) throw new HttpError(400, 'Code invalide.');
  res.json(await sessionResponse(user));
});

// ---- Routes nécessitant une session ----
router.use(requireAuth);

router.get('/me', (req, res) => res.json(req.user));

router.patch('/me', async (req, res) => {
  if (typeof req.body.displayName === 'string') req.user.displayName = req.body.displayName.trim();
  await req.user.save();
  res.json(req.user);
});

router.post('/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  validatePassword(newPassword);
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!user.passwordHash || !(await bcrypt.compare(String(currentPassword || ''), user.passwordHash))) {
    throw new HttpError(400, 'Mot de passe actuel incorrect.');
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  await logActivity(user, 'Sécurité', 'Changement de mot de passe');
  res.json({ success: true });
});

router.post('/2fa/setup', async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecret');
  if (user.twoFactorEnabled) throw new HttpError(409, 'La 2FA est déjà activée.');
  const secret = otp.generateSecret();
  user.twoFactorSecret = secret;
  await user.save();
  const uri = otp.generateURI({ issuer: 'Melanine Print', label: user.email, secret });
  res.json({ secret, qrCodeImage: await qrcode.toDataURL(uri) });
});

router.post('/2fa/enable', async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecret');
  if (!verifyCode(user.twoFactorSecret, req.body.code)) throw new HttpError(400, 'Code invalide.');
  user.twoFactorEnabled = true;
  await user.save();
  await logActivity(user, 'Sécurité', 'Activation de la double authentification');
  res.json({ success: true, user });
});

router.post('/2fa/disable', async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecret +passwordHash');
  if (!user.passwordHash || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) {
    throw new HttpError(400, 'Mot de passe incorrect.');
  }
  user.twoFactorEnabled = false;
  user.twoFactorSecret = null;
  await user.save();
  await logActivity(user, 'Sécurité', 'Désactivation de la double authentification');
  res.json({ success: true, user });
});

module.exports = router;
module.exports.validatePassword = validatePassword;
module.exports.normalizeEmail = normalizeEmail;
