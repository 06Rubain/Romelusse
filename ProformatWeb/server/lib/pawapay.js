const crypto = require('crypto');

// Client de l'API pawaPay (Mobile Money en RDC : Vodacom M-Pesa, Orange Money, Airtel Money).
// Compte et environnement de test gratuits : https://dashboard.sandbox.pawapay.io (clé API immédiate).
const BASE = {
  sandbox: process.env.PAWAPAY_SANDBOX_URL || 'https://api.sandbox.pawapay.io',
  live: process.env.PAWAPAY_LIVE_URL || 'https://api.pawapay.io',
};
const TIMEOUT_MS = 20000;

// Opérateurs pawaPay connus en RDC (utilisés si la configuration du compte ne peut pas être lue)
const PROVIDERS = { 'M-Pesa': 'VODACOM_MPESA_COD', 'Orange Money': 'ORANGE_COD', 'Airtel Money': 'AIRTEL_COD' };
const METHODS = Object.keys(PROVIDERS);
const COUNTRY = 'COD';
const CONF_TTL_MS = 10 * 60 * 1000;

// Nom affiché au client pour un code opérateur pawaPay
const methodName = (code, displayName) => {
  const c = String(code).toUpperCase();
  if (c.includes('VODACOM') || c.includes('MPESA')) return 'M-Pesa';
  if (c.includes('ORANGE')) return 'Orange Money';
  if (c.includes('AIRTEL')) return 'Airtel Money';
  if (c.includes('AFRICELL') || c.includes('AFRIMONEY')) return 'Africell Money';
  return displayName || code;
};

const call = async (env, path, { token, body }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE[env] || BASE.sandbox}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${String(token || '').trim().replace(/^bearer\s+/i, '')}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
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

// Motifs de refus pawaPay expliqués simplement au client
const FAILURES = {
  INSUFFICIENT_BALANCE: 'Solde insuffisant sur ce compte Mobile Money.',
  PAYMENT_NOT_APPROVED: 'Paiement non validé sur le téléphone (code secret non saisi ou demande refusée).',
  PAYER_NOT_FOUND: 'Ce numéro n\'a pas de compte Mobile Money chez cet opérateur.',
  PAYER_LIMIT_REACHED: 'Plafond de transactions atteint sur ce compte Mobile Money.',
  INVALID_PHONE_NUMBER: 'Numéro de téléphone invalide pour cet opérateur.',
  INVALID_PAYER_FORMAT: 'Numéro de téléphone invalide pour cet opérateur.',
  AMOUNT_OUT_OF_BOUNDS: 'Montant hors des limites acceptées par l\'opérateur.',
  INVALID_AMOUNT: 'Montant non accepté par l\'opérateur.',
  INVALID_CURRENCY: 'Devise non acceptée par cet opérateur : essayez un autre opérateur.',
  PROVIDER_TEMPORARILY_UNAVAILABLE: 'L\'opérateur est momentanément indisponible : réessayez dans quelques minutes ou choisissez un autre opérateur.',
  PAYMENT_IN_PROGRESS: 'Un paiement est déjà en cours sur ce numéro : validez-le ou attendez quelques minutes.',
  MANUALLY_CANCELLED: 'Paiement annulé.',
  WALLET_LIMIT_REACHED: 'Plafond du compte Mobile Money atteint.',
  UNSPECIFIED_FAILURE: 'Paiement refusé par l\'opérateur.',
  UNKNOWN_ERROR: 'Paiement refusé par l\'opérateur.',
};
const failureText = (json) => {
  const code = json.failureReason?.failureCode || json.rejectionReason?.rejectionCode;
  if (code && FAILURES[code]) return FAILURES[code];
  return json.failureReason?.failureMessage || json.rejectionReason?.rejectionMessage || code || json.message || json.errorMessage || '';
};

// Montant au format pawaPay : francs congolais sans décimales, dollars avec 2 décimales au plus
const formatAmount = (amount, currency) => (currency === 'CDF' ? String(Math.round(amount)) : String(Math.round(amount * 100) / 100));

// Opérateurs réellement ouverts sur le compte pawaPay de l'entreprise (ses portefeuilles), avec leurs devises.
// Lu dans la configuration active du compte, gardé 10 minutes ; liste connue par défaut si pawaPay ne répond pas.
const confCache = new Map();
const parseConf = (json) => {
  const countries = json.countries || json.data?.countries || [];
  const country = countries.find((c) => c.country === COUNTRY) || {};
  const providers = country.providers || country.correspondents || [];
  const list = [];
  for (const p of providers) {
    const code = p.provider || p.correspondent;
    if (!code) continue;
    const currencies = (p.currencies || []).filter((cur) => {
      const ops = cur.operationTypes || cur.operations || {};
      const deposit = Array.isArray(ops) ? ops.find((o) => (o.operationType || o.type) === 'DEPOSIT') : ops.DEPOSIT;
      return deposit && (!deposit.status || deposit.status === 'OPERATIONAL');
    });
    if (!currencies.length) continue;
    const entry = { method: methodName(code, p.displayName), code, currencies: currencies.map((cur) => String(cur.currency).toUpperCase()) };
    // Montants minimum et maximum de l'opérateur, par devise (s'ils sont donnés)
    const limits = {};
    for (const cur of currencies) {
      const ops = cur.operationTypes || cur.operations || {};
      const deposit = Array.isArray(ops) ? ops.find((o) => (o.operationType || o.type) === 'DEPOSIT') : ops.DEPOSIT;
      const min = Number(deposit?.minAmount ?? deposit?.minTransactionLimit);
      const max = Number(deposit?.maxAmount ?? deposit?.maxTransactionLimit);
      if (Number.isFinite(min) || Number.isFinite(max)) {
        limits[String(cur.currency).toUpperCase()] = { ...(Number.isFinite(min) ? { min } : {}), ...(Number.isFinite(max) ? { max } : {}) };
      }
    }
    if (Object.keys(limits).length) entry.limits = limits;
    list.push(entry);
  }
  return list;
};

const activeProviders = async ({ env, token }) => {
  const key = `${env}:${crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 16)}`;
  const cached = confCache.get(key);
  if (cached && Date.now() - cached.at < CONF_TTL_MS) return cached.list;
  const { httpStatus, json } = await call(env, `/v2/active-conf?country=${COUNTRY}&operationType=DEPOSIT`, { token });
  const list = httpStatus >= 200 && httpStatus < 300 ? parseConf(json) : [];
  const result = list.length ? list : METHODS.map((m) => ({ method: m, code: PROVIDERS[m], currencies: ['CDF', 'USD'], fallback: true }));
  confCache.set(key, { at: Date.now(), list: result });
  return result;
};

// Vérification de la clé depuis les réglages : vraie lecture du compte pawaPay, sans cache
const verify = async ({ env, token }) => {
  const { httpStatus, json } = await call(env, `/v2/active-conf?country=${COUNTRY}&operationType=DEPOSIT`, { token });
  if (httpStatus === 401 || httpStatus === 403) return { ok: false, message: 'Clé refusée par pawaPay : vérifiez la clé et l\'environnement (test ou réel).' };
  if (!(httpStatus >= 200 && httpStatus < 300)) {
    console.error('[pawaPay] Vérification de la clé', JSON.stringify({ httpStatus, response: JSON.stringify(json).slice(0, 600) }));
    return { ok: false, message: json.message || json.errorMessage || `pawaPay injoignable (code ${httpStatus || 'réseau'}).` };
  }
  confCache.clear();
  return { ok: true, providers: parseConf(json) };
};

// Demande de paiement envoyée directement sur le téléphone du client
const startDeposit = async ({ env, token, method, providerCode, phone, amount, currency, reference }) => {
  const depositId = crypto.randomUUID();
  const { httpStatus, json } = await call(env, '/v2/deposits', {
    token,
    body: {
      depositId,
      amount: formatAmount(amount, currency),
      currency,
      payer: { type: 'MMO', accountDetails: { phoneNumber: phone, provider: providerCode || PROVIDERS[method] } },
      clientReferenceId: reference,
      customerMessage: String(reference).replace(/[^A-Za-z0-9 ]/g, ' ').slice(0, 22).padEnd(4, ' '),
    },
  });
  if (httpStatus >= 200 && httpStatus < 300 && ['ACCEPTED', 'DUPLICATE_IGNORED'].includes(json.status)) return { ok: true, orderNumber: depositId };
  if (httpStatus === 401 || httpStatus === 403) return { ok: false, message: 'Clé API pawaPay refusée : vérifiez la clé et l\'environnement (test ou réel).' };
  // Pas de réponse claire (coupure, délai, erreur du serveur pawaPay) : la demande a peut-être été reçue et payée.
  // On garde le paiement « en cours » et on interroge pawaPay avec le même identifiant, sans jamais le refaire.
  if (httpStatus === 0 || httpStatus >= 500) return { ok: true, orderNumber: depositId, uncertain: true };
  console.error('[pawaPay] Paiement refusé', JSON.stringify({ httpStatus, response: JSON.stringify(json).slice(0, 600) }));
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
  if (json.status === 'NOT_FOUND') return { status: 'not_found' };
  return { status: 'pending' };
};

module.exports = {
  startDeposit, check, activeProviders, verify, parseConf, methodName, METHODS, PROVIDERS, BASE,
  clearConfCache: () => confCache.clear(),
};
