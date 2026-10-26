const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HttpError } = require('./helpers');

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new HttpError(500, 'JWT_SECRET non configuré (16 caractères minimum).');
  }
  return secret;
};

const signSession = (user) => jwt.sign(
  { sub: String(user._id), role: user.role },
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
  // Le rôle et le blocage sont relus en base : un changement prend effet immédiatement
  const user = await User.findById(payload.sub);
  if (!user) return res.status(401).json({ error: 'Utilisateur introuvable.' });
  if (user.isBlocked) return res.status(403).json({ error: 'Compte bloqué.', isBlocked: true });
  req.user = user;
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Vous n\'avez pas les droits nécessaires pour cette action.' });
  }
  next();
};

const isManager = (user) => user && (user.role === 'admin' || user.role === 'manager');

module.exports = {
  signSession,
  signTwoFactorChallenge,
  verifyTwoFactorChallenge,
  requireAuth,
  requireRole,
  isManager,
};
