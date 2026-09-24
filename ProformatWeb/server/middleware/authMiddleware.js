const jwt = require('jsonwebtoken');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Missing or invalid auth header:', authHeader);
    return res.status(401).json({ error: 'Accès non autorisé. Jeton manquant.' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
  // Attach verified user payload to request
  req.user = decoded;
  next();
  } catch (error) {
    console.error('Erreur de vérification du jeton:', error);
    return res.status(401).json({ error: 'Accès non autorisé. Jeton invalide ou expiré.' });
  }
};

module.exports = verifyToken;
