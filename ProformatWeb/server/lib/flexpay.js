// Client de l'API FlexPaie (Mobile Money et carte en RDC). Les adresses se changent par variables d'environnement
// si FlexPaie en communique d'autres à l'entreprise.
const PAYMENT_URL = process.env.FLEXPAY_PAYMENT_URL || 'https://corporateapi.flexpay.cd/api/rest/v1/paymentService';
const CHECK_URL = process.env.FLEXPAY_CHECK_URL || 'https://apicheck.flexpaie.com/api/rest/v1/check';
// Anciennes adresses encore utilisées par de nombreux comptes FlexPaie (essayées si la première n'existe pas)
const LEGACY_PAYMENT_URL = 'https://backend.flexpay.cd/api/rest/v1/paymentService';
const LEGACY_CHECK_URL = 'https://backend.flexpay.cd/api/rest/v1/check';
const CARD_URL = process.env.FLEXPAY_CARD_URL || 'https://cardpayment.flexpay.cd/v1.1/pay';
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

// Clé collée avec « Bearer » devant (fréquent quand FlexPaie l'envoie par e-mail) : on ne garde que la clé
const cleanToken = (token) => String(token || '').trim().replace(/^bearer\s+/i, '');

// Journal technique d'un refus (jamais la clé) : permet de comprendre pourquoi FlexPaie refuse
const logRefusal = (what, url, httpStatus, json) => {
  let host = url;
  try { host = new URL(url).host + new URL(url).pathname; } catch { /* adresse brute */ }
  console.error(`[FlexPaie] ${what} refusé`, JSON.stringify({ endpoint: host, httpStatus, response: JSON.stringify(json).slice(0, 600) }));
};

// Message lisible à partir de la réponse de FlexPaie
const reason = (json, httpStatus, fallback) => {
  const text = json.message || json.error || json.errorMessage || json.detail || '';
  if (httpStatus === 401 || httpStatus === 403) return 'Clé API FlexPaie refusée : vérifiez la clé (sans le mot « Bearer ») et le code marchand.';
  if (text) return `${text}${json.code !== undefined && !isZero(json.code) ? ` (code ${json.code})` : ''}`;
  if (json.code !== undefined) return `${fallback} (code ${json.code})`;
  return httpStatus ? `${fallback} (réponse HTTP ${httpStatus})` : fallback;
};

// Adresse absente, réponse non JSON (page d'erreur) ou vide (service qui ne correspond pas au compte) :
// aucune transaction n'a été créée, on peut essayer l'autre adresse sans risque de double paiement
const notAnApi = (httpStatus, isJson, json = {}) => httpStatus === 404 || httpStatus === 405
  || (httpStatus >= 200 && (isJson === false || (json.code === undefined && !json.orderNumber && !json.message)));

const call = async (url, { token, body }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${cleanToken(token)}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!text.trim()) console.error('[FlexPaie] Réponse vide', JSON.stringify({ url: url.replace(/^https?:\/\//, '').split('?')[0], httpStatus: res.status, contentType: res.headers?.get?.('content-type') || '' }));
    let json = {};
    let isJson = true;
    try { json = text ? JSON.parse(text) : {}; } catch { isJson = false; json = { message: text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) }; }
    return { httpStatus: res.status, json, isJson };
  } catch (err) {
    return { httpStatus: 0, json: { message: err.name === 'AbortError' ? 'FlexPaie ne répond pas.' : 'FlexPaie injoignable.' }, isJson: true };
  } finally {
    clearTimeout(timer);
  }
};

// Envoie la demande à l'adresse principale, puis à l'ancienne si la première n'existe pas pour ce compte
const post = async (body, token) => {
  let res = await call(PAYMENT_URL, { token, body });
  let url = PAYMENT_URL;
  if (notAnApi(res.httpStatus, res.isJson, res.json) && PAYMENT_URL !== LEGACY_PAYMENT_URL) {
    logRefusal('Réponse vide ou inattendue, essai de l\'autre adresse', url, res.httpStatus, res.json);
    url = LEGACY_PAYMENT_URL;
    res = await call(LEGACY_PAYMENT_URL, { token, body });
  }
  return { ...res, url };
};

// Paiement Mobile Money : le client reçoit une demande de confirmation sur son téléphone
const startMobile = async ({ merchant, token, phone, reference, amount, currency, callbackUrl }) => {
  // L'adresse de rappel est envoyée sous ses deux noms (selon la version de l'API FlexPaie)
  const body = { merchant, type: '1', phone, reference, amount: String(amount), currency, callbackUrl, callback_url: callbackUrl };
  const { json, httpStatus, url } = await post(body, token);
  if (isZero(json.code) && json.orderNumber) return { ok: true, orderNumber: String(json.orderNumber), message: json.message || '' };
  logRefusal('Paiement Mobile Money', url, httpStatus, json);
  return { ok: false, message: reason(json, httpStatus, 'Paiement refusé par FlexPaie') };
};

// Paiement par carte : FlexPaie renvoie l'adresse de sa page sécurisée de saisie de la carte
const startCard = async ({ merchant, token, reference, amount, currency, callbackUrl, returnUrl }) => {
  const common = { merchant, reference, amount: String(amount), currency, callback_url: callbackUrl, approve_url: returnUrl, cancel_url: returnUrl, decline_url: returnUrl };
  const first = await post({ ...common, type: '2', callbackUrl }, token);
  const pick = (json) => json.url || json.redirectUrl || json.paymentUrl;
  if (isZero(first.json.code) && pick(first.json)) return { ok: true, url: pick(first.json), orderNumber: String(first.json.orderNumber || '') };
  logRefusal('Paiement carte', first.url, first.httpStatus, first.json);
  // Ancien service carte de FlexPaie (clé dans le corps de la demande)
  const second = await call(CARD_URL, {
    token,
    body: { ...common, authorization: `Bearer ${cleanToken(token)}`, description: `Facture ${reference}`, home_url: returnUrl },
  });
  if (isZero(second.json.code) && pick(second.json)) return { ok: true, url: pick(second.json), orderNumber: String(second.json.orderNumber || '') };
  logRefusal('Paiement carte (service carte)', CARD_URL, second.httpStatus, second.json);
  return { ok: false, message: reason(first.json.message ? first.json : second.json, first.json.message ? first.httpStatus : second.httpStatus, 'Paiement par carte indisponible') };
};

// État d'une transaction : success, failed ou pending
const check = async ({ token, orderNumber }) => {
  if (!orderNumber) return { status: 'pending' };
  let { json, httpStatus, isJson } = await call(`${CHECK_URL}/${encodeURIComponent(orderNumber)}`, { token });
  if (notAnApi(httpStatus, isJson, json)) ({ json } = await call(`${LEGACY_CHECK_URL}/${encodeURIComponent(orderNumber)}`, { token }));
  const tx = json.transaction || {};
  if (isZero(json.code) && isZero(tx.status)) {
    return {
      status: 'success', providerReference: tx.provider_reference || tx.providerReference || '',
      amount: tx.amount !== undefined ? Number(tx.amount) : undefined, currency: tx.currency ? String(tx.currency).toUpperCase() : undefined,
    };
  }
  if (isZero(json.code) && String(tx.status) === '1') return { status: 'failed', message: tx.message || json.message || 'Paiement refusé.' };
  return { status: 'pending' };
};

module.exports = { startMobile, startCard, check, normalizePhone, cleanToken, PAYMENT_URL, CHECK_URL };
