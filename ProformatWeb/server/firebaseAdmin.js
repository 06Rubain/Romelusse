const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Chercher le fichier de service account
const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Pour le déploiement sur Vercel (via variable d'environnement)
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized from ENV securely');
} else if (fs.existsSync(serviceAccountPath)) {
  // Pour le développement local (via fichier)
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized from FILE securely');
} else {
  console.warn('WARNING: firebase-service-account.json not found! Using projectId only for token verification.');
  // On initialise avec le projectId pour que la vérification de jeton fonctionne
  admin.initializeApp({ projectId: 'mlanine-print' });
}

module.exports = admin;
