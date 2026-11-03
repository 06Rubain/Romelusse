const crypto = require('crypto');

// Chiffrement des secrets enregistrés en base (clé API FlexPaie) : AES-256-GCM.
// Clé : PAYMENT_SECRET_KEY si défini, sinon dérivée de la clé de session du serveur.
// Une copie de la base seule ne suffit donc pas à lire les clés des entreprises.
const PREFIX = 'enc:v1:';

const key = () => {
  const { getSecret } = require('./auth');
  const base = process.env.PAYMENT_SECRET_KEY || getSecret();
  return crypto.createHash('sha256').update(`omnicom-payment-secret:${base}`).digest();
};

const encryptSecret = (plain) => {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `${PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')}`;
};

// Renvoie '' si la valeur ne peut pas être déchiffrée (clé du serveur changée) : la clé doit alors être ressaisie
const decryptSecret = (stored) => {
  if (!stored) return '';
  if (!stored.startsWith(PREFIX)) return stored; // ancienne valeur en clair, rechiffrée au prochain enregistrement
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
};

module.exports = { encryptSecret, decryptSecret };
