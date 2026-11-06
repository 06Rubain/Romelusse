// Adresse publique de l'application, utilisée pour le retour après la page carte et pour les liens imprimés.
// Jamais une adresse choisie librement par la requête : un lien de paiement ne doit pas pouvoir renvoyer vers un faux site.
const isProduction = () => process.env.NODE_ENV === 'production';

const normalize = (value) => {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : '';
  } catch {
    return '';
  }
};

const hostOrigin = (req) => normalize(`${req.protocol}://${req.get('host')}`);

const allowedOrigins = (req) => new Set([
  normalize(process.env.PUBLIC_APP_URL),
  ...String(process.env.CORS_ORIGIN || '').split(',').map(normalize),
  hostOrigin(req),
].filter(Boolean));

const isLocal = (origin) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

// Adresse proposée (en-tête Origin ou paramètre) si elle est autorisée ; sinon l'adresse officielle
const appOrigin = (req, candidate = req.get('origin')) => {
  const official = normalize(process.env.PUBLIC_APP_URL);
  if (official) return official;
  const wanted = normalize(candidate);
  if (wanted && (allowedOrigins(req).has(wanted) || (!isProduction() && isLocal(wanted)))) return wanted;
  return hostOrigin(req);
};

const apiOrigin = (req) => normalize(process.env.PUBLIC_API_URL) || hostOrigin(req);

module.exports = { appOrigin, apiOrigin, isProduction };
