const mongoose = require('mongoose');

// Réponses déjà envoyées pour une clé « Idempotency-Key » : une saisie hors ligne renvoyée deux fois
// (connexion coupée avant la réponse) n'est jamais enregistrée deux fois
const idempotencySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true },
  method: String,
  path: String,
  status: Number,
  body: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 14 },
});
idempotencySchema.index({ user: 1, key: 1 }, { unique: true });

const IdempotencyKey = mongoose.models.IdempotencyKey || mongoose.model('IdempotencyKey', idempotencySchema);

const KEY = /^[A-Za-z0-9_-]{8,80}$/;

const idempotency = async (req, res, next) => {
  const key = req.get('Idempotency-Key');
  if (!key || !['POST', 'PUT', 'PATCH'].includes(req.method) || !req.user) return next();
  if (!KEY.test(key)) return res.status(400).json({ error: 'Clé d\'idempotence invalide.' });

  const previous = await IdempotencyKey.findOne({ user: req.user._id, key }).lean();
  if (previous) {
    res.set('Idempotent-Replay', 'true');
    return res.status(previous.status).json(previous.body);
  }

  // Mémorise la réponse définitive (succès ou refus métier) ; une erreur serveur peut être retentée
  const send = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 500) {
      IdempotencyKey.create({ user: req.user._id, key, method: req.method, path: req.originalUrl, status: res.statusCode, body })
        .catch(() => { /* même clé reçue en parallèle : la première réponse fait foi */ });
    }
    return send(body);
  };
  next();
};

module.exports = { idempotency, IdempotencyKey };
