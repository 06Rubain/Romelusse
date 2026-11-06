const CURRENCIES = ['USD', 'FC'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Ne garde que les champs autorisés (protège contre l'assignation de masse)
const pick = (obj, keys) => {
  const out = {};
  for (const key of keys) {
    if (obj && obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
};

const toNumber = (value, fallback = 0) => {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

const round2 = (n) => Math.round(n * 100) / 100;

// Analyse les anciens prix texte : "300 FC", "50 USD", "Sur devis"
const parseLegacyPrice = (price) => {
  const str = String(price ?? '').trim();
  const match = str.replace(/\s/g, '').replace(',', '.').match(/[\d.]+/);
  const amount = match ? parseFloat(match[0]) : NaN;
  if (!Number.isFinite(amount)) return { unitPrice: 0, currency: 'USD', onQuote: true };
  const currency = /FC|CDF/i.test(str) ? 'FC' : 'USD';
  return { unitPrice: amount, currency, onQuote: false };
};

// Ancien format de date des factures : "26/10/2026"
const parseFrenchDate = (str) => {
  const m = String(str ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12));
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Conversion entre devises à partir du taux (1 USD = rate FC)
const convert = (amount, from, to, rate) => {
  if (from === to) return amount;
  if (!rate || rate <= 0) return amount;
  return from === 'USD' ? amount * rate : amount / rate;
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const paginationParams = (query, defaultLimit = 20) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

const paginate = async (model, filter, query, sort, defaultLimit) => {
  const { page, limit, skip } = paginationParams(query, defaultLimit);
  const [items, total] = await Promise.all([
    model.find(filter).sort(sort).skip(skip).limit(limit),
    model.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
};

const dateRangeFilter = (from, to) => {
  const range = {};
  const start = parseDate(from);
  const end = parseDate(to);
  if (start) range.$gte = start;
  if (end) {
    end.setUTCHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return Object.keys(range).length ? range : null;
};

module.exports = {
  CURRENCIES,
  HttpError,
  pick,
  toNumber,
  round2,
  parseLegacyPrice,
  parseFrenchDate,
  parseDate,
  convert,
  escapeRegex,
  paginate,
  dateRangeFilter,
};
