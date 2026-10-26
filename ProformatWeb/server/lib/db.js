const mongoose = require('mongoose');
const { migrateLegacyData } = require('./migrate');

let connecting = null;
let migrated = false;

// Connexion paresseuse et réutilisable (compatible serverless)
const connectDb = async () => {
  if (mongoose.connection.readyState !== 1) {
    if (!connecting) {
      const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/proformat';
      connecting = mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }).finally(() => { connecting = null; });
    }
    await connecting;
  }
  if (!migrated) {
    migrated = true;
    try {
      await migrateLegacyData();
    } catch (err) {
      migrated = false;
      console.error('Migration des anciennes données échouée :', err);
    }
  }
};

module.exports = { connectDb };
