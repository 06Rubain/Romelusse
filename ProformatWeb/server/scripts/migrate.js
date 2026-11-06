// Migration manuelle des données de l'ancienne version : `npm run migrate`
// (elle s'exécute aussi automatiquement à la première requête de l'API)
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDb } = require('../lib/db');

connectDb()
  .then(() => console.log('Migration terminée.'))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
