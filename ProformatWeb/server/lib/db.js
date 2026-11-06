const mongoose = require('mongoose');
const { migrateIfNeeded } = require('./migrate');
const { ensureSuperAdmin } = require('./bootstrap');

let connecting = null;

// Base utilisée quand l'adresse ne précise pas de nom (adresse copiée telle quelle depuis Atlas → « Connect »).
// Sans cela, MongoDB ouvrirait une base vide nommée « test » au lieu des données de l'application.
const DEFAULT_DB_NAME = process.env.MONGODB_DB || 'proformat';
const hasDbName = (uri) => {
  const afterHost = uri.replace(/^mongodb(\+srv)?:\/\/[^/]*/, '');
  const name = afterHost.replace(/^\//, '').split('?')[0];
  return Boolean(name);
};
let migrated = false;

// Connexion paresseuse et réutilisable (compatible serverless)
const connectDb = async () => {
  if (mongoose.connection.readyState !== 1) {
    if (!connecting) {
      const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/proformat';
      connecting = mongoose.connect(uri, {
        ...(hasDbName(uri) && !process.env.MONGODB_DB ? {} : { dbName: DEFAULT_DB_NAME }),
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }).finally(() => { connecting = null; });
    }
    await connecting;
  }
  if (!migrated) {
    migrated = true;
    try {
      await migrateIfNeeded();
      await ensureSuperAdmin();
    } catch (err) {
      migrated = false;
      console.error('Initialisation des données échouée :', err);
    }
  }
};

module.exports = { connectDb, hasDbName };
