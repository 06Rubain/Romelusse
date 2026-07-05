const admin = require('../firebaseAdmin');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Accès non autorisé. Jeton manquant.' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    // On ajoute l'utilisateur vérifié à l'objet req
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Erreur de vérification du jeton:', error);
    return res.status(401).json({ error: 'Accès non autorisé. Jeton invalide ou expiré.' });
  }
};

module.exports = verifyToken;
