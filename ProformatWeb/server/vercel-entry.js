// Point d'entrée Vercel : si l'API ne peut pas se charger, la cause s'affiche en clair
// au lieu d'une erreur 500 vide (FUNCTION_INVOCATION_FAILED)
let handler;
try {
  handler = require('./index');
} catch (err) {
  console.error('Démarrage de l\'API impossible :', err);
  const message = `Le serveur ne démarre pas (Node ${process.version}) : ${err.message.split('\n')[0]}`
    + ' — vérifiez la version de Node du projet Vercel (22.x recommandée).';
  handler = (req, res) => {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: message }));
  };
}

module.exports = handler;
