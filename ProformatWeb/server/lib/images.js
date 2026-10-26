const { HttpError } = require('./helpers');

const MAX_IMAGE_BYTES = 800 * 1024;

// Valide une image envoyée en data URL (logo, bandeau) ; '' supprime l'image
const validateImage = (value, label, maxBytes = MAX_IMAGE_BYTES) => {
  if (value === undefined) return undefined;
  if (value === '' || value === null) return '';
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(value));
  if (!match) throw new HttpError(400, `${label} : format accepté PNG, JPEG ou WebP.`);
  const bytes = Math.floor((match[2].length * 3) / 4);
  if (bytes > maxBytes) throw new HttpError(400, `${label} : ${Math.round(maxBytes / 1024)} Ko maximum.`);
  return value;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const validateColor = (value, label) => {
  if (value === undefined) return undefined;
  if (!HEX.test(String(value))) throw new HttpError(400, `${label} : couleur invalide (format #RRGGBB).`);
  return value;
};

module.exports = { validateImage, validateColor };
