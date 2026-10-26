const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const { PERMISSIONS } = require('../models/Role');
const { HttpError } = require('./helpers');

// JWT_SECRET si défini ; sinon une clé dérivée de MONGODB_URI (déjà secrète), pour limiter la configuration
const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.MONGODB_URI) {
    return crypto.createHash('sha256').update(`omnicom-jwt:${process.env.MONGODB_URI}`).digest('hex');
  }
  throw new HttpError(500, 'JWT_SECRET non configuré (16 caractères minimum).');
};

const signSession = (user) => jwt.sign(
  { sub: String(user._id) },
  getSecret(),
  { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
);

// Jeton court utilisé entre la saisie du mot de passe et celle du code 2FA
const signTwoFactorChallenge = (user) => jwt.sign(
  { sub: String(user._id), purpose: '2fa' },
  getSecret(),
  { expiresIn: '5m' }
);

const verifyTwoFactorChallenge = (token) => {
  try {
    const payload = jwt.verify(token, getSecret());
    if (payload.purpose !== '2fa') throw new Error('purpose');
    return payload.sub;
  } catch {
    throw new HttpError(401, 'Session de vérification expirée. Reconnectez-vous.');
  }
};

const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Accès non autorisé. Jeton manquant.' });
  }
  let payload;
  try {
    payload = jwt.verify(header.slice(7), getSecret());
  } catch (err) {
    if (err instanceof HttpError) throw err;
    return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
  }
  if (payload.purpose) {
    return res.status(401).json({ error: 'Jeton invalide.' });
  }
  // Rôle, permissions et blocage sont relus en base : un changement prend effet immédiatement
  const user = await User.findById(payload.sub).populate('roleId').populate('company');
  if (!user) return res.status(401).json({ error: 'Utilisateur introuvable.' });
  if (user.isBlocked) return res.status(403).json({ error: 'Compte bloqué.', isBlocked: true });
  if (!user.isSuperAdmin) {
    if (!user.company) return res.status(403).json({ error: 'Aucune entreprise rattachée à ce compte.' });
    if (!user.company.isActive) return res.status(403).json({ error: 'L\'accès de votre entreprise est suspendu. Contactez OmniCom.', suspended: true });
  }
  req.user = user;
  req.company = user.company || null;
  req.permissions = new Set(user.roleId?.permissions || []);

  // Un super-admin OmniCom peut ouvrir la console d'une entreprise (en-tête X-Company-Id), avec tous les droits
  const actingId = req.headers['x-company-id'];
  if (user.isSuperAdmin && actingId) {
    const company = mongoose.isValidObjectId(actingId) ? await Company.findById(actingId) : null;
    if (!company) return res.status(404).json({ error: 'Entreprise introuvable.' });
    req.company = company;
    req.permissions = new Set(PERMISSIONS);
    req.actingAsSuperAdmin = true;
    // Les actions sont journalisées dans l'entreprise visitée (jamais enregistré sur le compte)
    user.$locals.actingCompany = company;
  }
  next();
};

const can = (req, permission) => req.permissions?.has(permission);

// Accès réservé aux utilisateurs d'une entreprise (les super-admins OmniCom n'ont pas de données métier)
const requireCompany = (req, res, next) => {
  if (!req.company) return res.status(403).json({ error: 'Cet espace est réservé aux comptes entreprise.' });
  next();
};

// Autorise si l'utilisateur possède au moins une des permissions
const requirePermission = (...permissions) => (req, res, next) => {
  if (!permissions.some((p) => can(req, p))) {
    return res.status(403).json({ error: 'Vous n\'avez pas les droits nécessaires pour cette action.' });
  }
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user?.isSuperAdmin) return res.status(403).json({ error: 'Réservé à l\'équipe OmniCom.' });
  next();
};

// Vue publique d'un utilisateur pour le frontend
const sessionUser = (user) => {
  const json = user.toJSON();
  const role = user.roleId && typeof user.roleId === 'object' ? user.roleId : null;
  return {
    ...json,
    company: user.company && typeof user.company === 'object' ? user.company._id : user.company,
    roleId: role ? role._id : user.roleId,
    roleName: user.isSuperAdmin ? 'Super-admin OmniCom' : role?.name || '',
    permissions: role?.permissions || [],
  };
};

module.exports = {
  signSession,
  signTwoFactorChallenge,
  verifyTwoFactorChallenge,
  requireAuth,
  requireCompany,
  requirePermission,
  requireSuperAdmin,
  can,
  sessionUser,
};
