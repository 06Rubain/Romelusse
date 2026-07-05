const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Chercher le fichier de service account
const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized securely');
} else {
  console.warn('WARNING: firebase-service-account.json not found! API security might fail.');
  // On initialise sans cert pour éviter de crash si pas de fichier local, mais les vérifications de token vont échouer si on n'a pas accès au projet
  admin.initializeApp();
}

module.exports = admin;
