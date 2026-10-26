const { pick, toNumber, CURRENCIES } = require('./helpers');
const { validateImage, validateColor } = require('./images');

const BRANDING_FIELDS = ['name', 'legalName', 'address', 'city', 'email', 'phone', 'taxNumber', 'nationalId', 'rccm', 'bankName', 'bankAccount',
  'exchangeRate', 'reportingCurrency', 'paymentTermDays', 'logo', 'footerImage', 'primaryColor', 'secondaryColor', 'accentColor'];

// Nettoie les champs modifiables d'une entreprise (par son admin ou par OmniCom)
const sanitizeCompany = (body) => {
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
  for (const key of Object.keys(data)) if (data[key] === undefined) delete data[key];
  return data;
};

module.exports = { sanitizeCompany };
