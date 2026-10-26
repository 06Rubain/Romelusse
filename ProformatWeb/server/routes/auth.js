const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const qrcode = require('qrcode');
// otplib n'est chargé qu'à l'usage : un souci de la 2FA ne peut pas empêcher l'API de démarrer
const otp = () => require('otplib');
const User = require('../models/User');
const Company = require('../models/Company');
const { HttpError } = require('../lib/helpers');
const { logActivity } = require('../lib/activity');
const {
  signSession, signTwoFactorChallenge, verifyTwoFactorChallenge, requireAuth, sessionUser,
} = require('../lib/auth');

const router = express.Router();

const MIN_PASSWORD = 8;

const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    throw new HttpError(400, `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`);
  }
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const needsSetup = async () => !(await User.exists({ isSuperAdmin: true }));

const loadSessionUser = (id) => User.findById(id).populate('roleId').populate('company');

const sessionResponse = async (user) => {
  user.lastLoginAt = new Date();
  await user.save();
  await logActivity(user, 'Connexion', 'Connexion à l\'application');
  return { token: signSession(user), user: sessionUser(await loadSessionUser(user._id)) };
};

const ensureCanLogIn = async (user) => {
  if (user.isBlocked) throw new HttpError(403, 'Compte bloqué. Contactez votre administrateur.');
  if (!user.isSuperAdmin) {
    const company = await Company.findById(user.company);
    if (!company) throw new HttpError(403, 'Aucune entreprise rattachée à ce compte.');
    if (!company.isActive) throw new HttpError(403, 'L\'accès de votre entreprise est suspendu. Contactez OmniCom.');
  }
};

const verifyCode = (secret, code) => {
  if (!secret || !/^\d{6}$/.test(String(code || ''))) return false;
  return otp().verifySync({ secret, token: String(code), epochTolerance: 30 }).valid;
};

router.get('/status', async (req, res) => {
  res.json({ needsSetup: await needsSetup() });
});

// Création du premier super-admin OmniCom, protégée par la clé SETUP_KEY du serveur
router.post('/setup', async (req, res) => {
  if (!(await needsSetup())) throw new HttpError(409, 'La plateforme est déjà configurée.');
  const setupKey = process.env.SETUP_KEY;
  if (!setupKey) {
    throw new HttpError(503, 'Aucun compte OmniCom : définissez OMNICOM_ADMIN_PASSWORD (Vercel → Settings → Environment Variables) puis redéployez ; le compte est créé automatiquement.');
  }
  const given = Buffer.from(String(req.body.setupKey || ''));
  const expected = Buffer.from(setupKey);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    throw new HttpError(403, 'Clé d\'installation invalide.');
  }
  const email = normalizeEmail(req.body.email);
  const { password, displayName } = req.body;
  if (!email.includes('@')) throw new HttpError(400, 'Adresse e-mail invalide.');
  validatePassword(password);
  if (await User.exists({ email })) throw new HttpError(409, 'Cet e-mail est déjà utilisé par un compte entreprise.');
  const user = await User.create({
    email, displayName: displayName || '', isSuperAdmin: true, passwordHash: await bcrypt.hash(password, 12),
  });
  res.status(201).json(await sessionResponse(user));
});

router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  if (!email || !password) throw new HttpError(400, 'E-mail et mot de passe requis.');
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = user?.passwordHash && await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) throw new HttpError(401, 'E-mail ou mot de passe incorrect.');
  await ensureCanLogIn(user);
  if (user.twoFactorEnabled) {
    return res.json({ requires2fa: true, challenge: signTwoFactorChallenge(user) });
  }
  res.json(await sessionResponse(user));
});

router.post('/login/2fa', async (req, res) => {
  const userId = verifyTwoFactorChallenge(req.body.challenge);
  const user = await User.findById(userId).select('+twoFactorSecret');
  if (!user) throw new HttpError(403, 'Accès refusé.');
  await ensureCanLogIn(user);
  if (!verifyCode(user.twoFactorSecret, req.body.code)) throw new HttpError(400, 'Code invalide.');
  res.json(await sessionResponse(user));
});

// ---- Routes nécessitant une session ----
router.use(requireAuth);

router.get('/me', (req, res) => res.json(sessionUser(req.user)));

router.patch('/me', async (req, res) => {
  if (typeof req.body.displayName === 'string') req.user.displayName = req.body.displayName.trim();
  await req.user.save();
  res.json(sessionUser(req.user));
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
  const secret = otp().generateSecret();
  user.twoFactorSecret = secret;
  await user.save();
  const uri = otp().generateURI({ issuer: 'OmniCom Facturation', label: user.email, secret });
  res.json({ secret, qrCodeImage: await qrcode.toDataURL(uri) });
});

router.post('/2fa/enable', async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecret');
  if (!verifyCode(user.twoFactorSecret, req.body.code)) throw new HttpError(400, 'Code invalide.');
  user.twoFactorEnabled = true;
  await user.save();
  await logActivity(user, 'Sécurité', 'Activation de la double authentification');
  res.json({ success: true });
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
  res.json({ success: true });
});

module.exports = router;
module.exports.validatePassword = validatePassword;
module.exports.normalizeEmail = normalizeEmail;
