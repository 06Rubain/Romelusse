const crypto = require('crypto');

// Client de l'API pawaPay (Mobile Money en RDC : Vodacom M-Pesa, Orange Money, Airtel Money).
// Compte et environnement de test gratuits : https://dashboard.sandbox.pawapay.io (clé API immédiate).
const BASE = {
  sandbox: process.env.PAWAPAY_SANDBOX_URL || 'https://api.sandbox.pawapay.io',
  live: process.env.PAWAPAY_LIVE_URL || 'https://api.pawapay.io',
};
const TIMEOUT_MS = 20000;

// Opérateurs pawaPay en RDC
const PROVIDERS = { 'M-Pesa': 'VODACOM_MPESA_COD', 'Orange Money': 'ORANGE_COD', 'Airtel Money': 'AIRTEL_COD' };
const METHODS = Object.keys(PROVIDERS);

const call = async (env, path, { token, body }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE[env] || BASE.sandbox}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text.slice(0, 200) }; }
    return { httpStatus: res.status, json };
  } catch (err) {
    return { httpStatus: 0, json: { message: err.name === 'AbortError' ? 'pawaPay ne répond pas.' : 'pawaPay injoignable.' } };
  } finally {
    clearTimeout(timer);
  }
};

const failureText = (json) => json.failureReason?.failureMessage || json.failureReason?.failureCode || json.message || json.errorMessage || '';

// Montant au format pawaPay : francs congolais sans décimales, dollars avec 2 décimales au plus
const formatAmount = (amount, currency) => (currency === 'CDF' ? String(Math.round(amount)) : String(Math.round(amount * 100) / 100));

// Demande de paiement envoyée directement sur le téléphone du client
const startDeposit = async ({ env, token, method, phone, amount, currency, reference }) => {
  const depositId = crypto.randomUUID();
  const { httpStatus, json } = await call(env, '/v2/deposits', {
    token,
    body: {
      depositId,
      amount: formatAmount(amount, currency),
      currency,
      payer: { type: 'MMO', accountDetails: { phoneNumber: phone, provider: PROVIDERS[method] } },
      clientReferenceId: reference,
      customerMessage: String(reference).replace(/[^A-Za-z0-9 ]/g, ' ').slice(0, 22).padEnd(4, ' '),
    },
  });
  if (httpStatus >= 200 && httpStatus < 300 && ['ACCEPTED', 'DUPLICATE_IGNORED'].includes(json.status)) return { ok: true, orderNumber: depositId };
  if (httpStatus === 401 || httpStatus === 403) return { ok: false, message: 'Clé API pawaPay refusée : vérifiez la clé et l\'environnement (test ou réel).' };
  return { ok: false, message: failureText(json) || 'Paiement refusé par pawaPay.' };
};

// État d'un paiement : success, failed ou pending (avec le montant réellement payé)
const check = async ({ env, token, orderNumber }) => {
  if (!orderNumber) return { status: 'pending' };
  const { json } = await call(env, `/v2/deposits/${encodeURIComponent(orderNumber)}`, { token });
  const data = json.data || (Array.isArray(json) ? json[0] : json) || {};
  if (data.status === 'COMPLETED') {
    return {
      status: 'success', providerReference: data.providerTransactionId || orderNumber,
      amount: data.amount !== undefined ? Number(data.amount) : undefined, currency: data.currency ? String(data.currency).toUpperCase() : undefined,
    };
  }
  if (data.status === 'FAILED') return { status: 'failed', message: failureText(data) || 'Paiement refusé.' };
  return { status: 'pending' };
};

module.exports = { startDeposit, check, METHODS, PROVIDERS, BASE };
