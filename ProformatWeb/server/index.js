const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

require('dotenv').config();

const { connectDb } = require('./lib/db');
const { requireAuth, requireCompany, requirePermission } = require('./lib/auth');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : true }));
// Limite relevée pour les logos et modèles importés envoyés en data URL
app.use(express.json({ limit: '6mb' }));

const isTest = process.env.NODE_ENV === 'test';
// En local, MongoDB par défaut sur 127.0.0.1 ; en production (Vercel) MONGODB_URI est obligatoire
const isLocal = process.env.NODE_ENV !== 'production';

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  skip: () => isTest,
  message: { error: 'Trop de requêtes depuis cette adresse IP, veuillez réessayer plus tard.' },
}));

// Limite stricte contre les attaques par force brute sur la connexion
app.use(['/api/auth/login', '/api/auth/setup'], rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skip: () => isTest,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
}));

// Variables manquantes sur le serveur (noms seulement, jamais les valeurs)
const missingConfig = () => [
  !process.env.MONGODB_URI && !isLocal && 'MONGODB_URI',
  // Sans JWT_SECRET, la clé de session est dérivée de MONGODB_URI
  !(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) && !process.env.MONGODB_URI && 'JWT_SECRET',
].filter(Boolean);

app.get('/api/health', (req, res) => res.json({
  ok: missingConfig().length === 0,
  missing: missingConfig(),
  setupKey: Boolean(process.env.SETUP_KEY),
  adminFromEnv: Boolean(process.env.OMNICOM_ADMIN_PASSWORD),
}));

// Connexion à la base avant chaque requête (compatible serverless)
app.use('/api', async (req, res, next) => {
  const missing = missingConfig();
  if (missing.length) {
    return res.status(503).json({ error: `Serveur non configuré : définissez ${missing.join(' et ')} (Vercel → Settings → Environment Variables), puis redéployez.`, missing });
  }
  try {
    await connectDb();
    next();
  } catch (err) {
    console.error('Erreur de connexion MongoDB :', err.message);
    res.status(503).json({ error: 'Base de données injoignable : vérifiez MONGODB_URI (mot de passe Atlas) et l\'accès réseau du cluster (Network Access : 0.0.0.0/0 pour Vercel).' });
  }
});

app.use('/api/auth', require('./routes/auth'));

app.use('/api', requireAuth);
app.use('/api/platform', require('./routes/platform'));

// Espace entreprise : toutes les données sont filtrées par l'entreprise de l'utilisateur
app.use('/api', requireCompany);
app.use('/api/company/template', require('./routes/template'));
app.use('/api/company', require('./routes/company'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/products', require('./routes/products'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/expenses', requirePermission('expenses.manage'), require('./routes/expenses'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/activities', requirePermission('activities.view'), require('./routes/activities'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Route introuvable.' }));

// Gestionnaire d'erreurs centralisé (Express 5 transmet les erreurs async)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide.' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Identifiant invalide.' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !err.status ? 'Erreur interne du serveur.' : err.message });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
}

module.exports = app;
