const qrcode = require('qrcode');
const { pick, toNumber, CURRENCIES, HttpError } = require('./helpers');
const { validateImage, validateColor } = require('./images');

const BRANDING_FIELDS = ['name', 'legalName', 'address', 'city', 'email', 'phone', 'taxNumber', 'nationalId', 'rccm', 'bankName', 'bankAccount',
  'exchangeRate', 'reportingCurrency', 'paymentTermDays', 'logo', 'footerImage', 'primaryColor', 'secondaryColor', 'accentColor',
  'signature', 'paymentLink', 'paymentMethods'];

// Lien de paiement : https ajouté si absent, seuls http et https sont acceptés
const normalizeLink = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try { url = new URL(withScheme); } catch { throw new HttpError(400, 'Lien de paiement invalide.'); }
  if (!['http:', 'https:'].includes(url.protocol) || withScheme.length > 300) throw new HttpError(400, 'Lien de paiement invalide.');
  return url.toString();
};

// Nettoie les champs modifiables d'une entreprise (par son admin ou par OmniCom) ; calcule le QR code du lien de paiement
const sanitizeCompany = async (body) => {
  const data = pick(body, BRANDING_FIELDS);
  if (data.name !== undefined) data.name = String(data.name).trim();
  if (data.exchangeRate !== undefined) data.exchangeRate = Math.max(0, toNumber(data.exchangeRate));
  if (data.paymentTermDays !== undefined) data.paymentTermDays = Math.max(0, Math.round(toNumber(data.paymentTermDays)));
  if (data.reportingCurrency !== undefined && !CURRENCIES.includes(data.reportingCurrency)) delete data.reportingCurrency;
  data.logo = validateImage(data.logo, 'Logo');
  data.footerImage = validateImage(data.footerImage, 'Bandeau de bas de page');
  data.primaryColor = validateColor(data.primaryColor, 'Couleur principale');
  data.secondaryColor = validateColor(data.secondaryColor, 'Couleur secondaire');
  data.accentColor = validateColor(data.accentColor, 'Couleur d\'accent');
  data.signature = validateImage(data.signature, 'Signature');
  if (data.paymentMethods !== undefined) {
    data.paymentMethods = (Array.isArray(data.paymentMethods) ? data.paymentMethods : [])
      .map((m) => String(m).trim().slice(0, 40)).filter(Boolean).slice(0, 20);
  }
  if (data.paymentLink !== undefined) {
    data.paymentLink = normalizeLink(data.paymentLink);
    data.paymentQr = data.paymentLink ? await qrcode.toDataURL(data.paymentLink, { margin: 1, width: 240 }) : '';
  }
  for (const key of Object.keys(data)) if (data[key] === undefined) delete data[key];
  return data;
};

module.exports = { sanitizeCompany };
