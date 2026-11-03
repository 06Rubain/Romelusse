// Client de l'API FlexPaie (Mobile Money et carte en RDC). Les adresses se changent par variables d'environnement
// si FlexPaie en communique d'autres à l'entreprise.
const PAYMENT_URL = process.env.FLEXPAY_PAYMENT_URL || 'https://corporateapi.flexpay.cd/api/rest/v1/paymentService';
const CHECK_URL = process.env.FLEXPAY_CHECK_URL || 'https://apicheck.flexpaie.com/api/rest/v1/check';
const TIMEOUT_MS = 20000;

const isZero = (value) => value !== undefined && value !== null && String(value) === '0';

// Numéro congolais au format attendu : 243 suivi de 9 chiffres
const normalizePhone = (value) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 9) digits = `243${digits}`;
  return /^243\d{9}$/.test(digits) ? digits : '';
};

const call = async (url, { token, body }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
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
    return { httpStatus: 0, json: { message: err.name === 'AbortError' ? 'FlexPaie ne répond pas.' : 'FlexPaie injoignable.' } };
  } finally {
    clearTimeout(timer);
  }
};

// Paiement Mobile Money : le client reçoit une demande de confirmation sur son téléphone
const startMobile = async ({ merchant, token, phone, reference, amount, currency, callbackUrl }) => {
  const { json } = await call(PAYMENT_URL, {
    token,
    body: { merchant, type: '1', phone, reference, amount: String(amount), currency, callback_url: callbackUrl },
  });
  if (isZero(json.code) && json.orderNumber) return { ok: true, orderNumber: String(json.orderNumber), message: json.message || '' };
  return { ok: false, message: json.message || 'Paiement refusé par FlexPaie.' };
};

// Paiement par carte : FlexPaie renvoie l'adresse de sa page sécurisée de saisie de la carte
const startCard = async ({ merchant, token, reference, amount, currency, callbackUrl, returnUrl }) => {
  const { json } = await call(PAYMENT_URL, {
    token,
    body: {
      merchant, type: '2', reference, amount: String(amount), currency, callback_url: callbackUrl,
      approve_url: returnUrl, cancel_url: returnUrl, decline_url: returnUrl,
    },
  });
  const url = json.url || json.redirectUrl || json.paymentUrl;
  if (isZero(json.code) && url) return { ok: true, url, orderNumber: String(json.orderNumber || '') };
  return { ok: false, message: json.message || 'Paiement par carte indisponible.' };
};

// État d'une transaction : success, failed ou pending
const check = async ({ token, orderNumber }) => {
  if (!orderNumber) return { status: 'pending' };
  const { json } = await call(`${CHECK_URL}/${encodeURIComponent(orderNumber)}`, { token });
  const tx = json.transaction || {};
  if (isZero(json.code) && isZero(tx.status)) return { status: 'success', providerReference: tx.provider_reference || tx.providerReference || '' };
  if (isZero(json.code) && String(tx.status) === '1') return { status: 'failed', message: tx.message || json.message || 'Paiement refusé.' };
  return { status: 'pending' };
};

module.exports = { startMobile, startCard, check, normalizePhone, PAYMENT_URL, CHECK_URL };
