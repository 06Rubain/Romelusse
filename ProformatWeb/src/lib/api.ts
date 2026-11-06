import { API_URL } from '../config';
import { cachedResponse, cacheResponse, configureSync, enqueue, markOffline, markOnline, newOpKey, scopeOf } from './offline';

const TOKEN_KEY = 'jwt';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};

export const setToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* stockage indisponible */ }
};

// Entreprise ouverte par un super-admin OmniCom (envoyée à l'API dans l'en-tête X-Company-Id)
const ACTING_KEY = 'actingCompany';

export const getActingCompany = () => {
  try { return sessionStorage.getItem(ACTING_KEY) || ''; } catch { return ''; }
};

export const setActingCompany = (companyId: string | null) => {
  try {
    if (companyId) sessionStorage.setItem(ACTING_KEY, companyId);
    else sessionStorage.removeItem(ACTING_KEY);
  } catch { /* stockage indisponible */ }
};

type Query = Record<string, string | number | boolean | undefined | null>;

export const buildQuery = (query?: Query) => {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const str = params.toString();
  return str ? `?${str}` : '';
};

// Saisies qui peuvent attendre le retour de la connexion (envoyées ensuite, sans doublon)
const QUEUEABLE: [RegExp, (body: Record<string, unknown>) => string][] = [
  [/^\/invoices$/, (b) => `${b.type || 'Facture'} pour ${b.client || 'un client'}`],
  [/^\/invoices\/[a-f0-9]{24}\/payments$/, (b) => `Encaissement de ${b.amount}`],
  [/^\/expenses$/, (b) => `Dépense : ${b.description || ''}`],
  [/^\/clients$/, (b) => `Nouveau client : ${b.name || ''}`],
  [/^\/treasury\/movements$/, (b) => `Trésorerie : ${b.label || b.type}`],
];

// Réponse renvoyée pour une saisie mise en file d'attente
export interface Queued { _offline: true; _queuedKey: string }
export const isQueued = (value: unknown): value is Queued => Boolean(value && typeof value === 'object' && (value as Queued)._offline);
export const QUEUED_MESSAGE = 'Enregistré sur cet appareil : envoi automatique au retour de la connexion.';

const TIMEOUT_MS = 20000;

// Envoi brut : erreur de statut 0 si le serveur est injoignable (pas de réseau, délai dépassé)
async function send<T>(method: string, url: string, body: unknown, extra: Record<string, string> = {}, acting = getActingCompany()): Promise<T> {
  const headers = new Headers(extra);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (acting) headers.set('X-Company-Id', acting);
  if (body !== undefined) headers.set('Content-Type', 'application/json');

  let res: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
    res = await fetch(`${API_URL}/api${url}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'Pas de connexion internet.');
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Session expirée ou compte bloqué : retour à l'écran de connexion
    if (res.status === 401 && token && !url.startsWith('/auth/login')) {
      setToken(null);
      window.dispatchEvent(new Event('auth:logout'));
    }
    throw new ApiError(res.status, data.error || `Erreur ${res.status}`);
  }
  return data as T;
}

export const currentScope = () => {
  const token = getToken();
  return token ? scopeOf(token, getActingCompany()) : '';
};

// Lecture « copie de l'appareil seulement » : affichage immédiat avant la réponse du serveur
let cacheOnly = false;
export const fromCache = <T>(fn: () => Promise<T>): Promise<T> => {
  cacheOnly = true;
  try { return fn(); } finally { cacheOnly = false; }
};

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const onlyCache = cacheOnly;
  const url = `${path}${buildQuery(query)}`;
  const scope = currentScope();
  const cacheable = method === 'GET' && scope && !path.startsWith('/public');

  if (onlyCache) {
    const cached = method === 'GET' && cacheable ? await cachedResponse(scope, url) : undefined;
    if (cached) return cached.data as T;
    throw new ApiError(-1, 'Pas de copie sur cet appareil.');
  }

  if (method === 'GET') {
    try {
      const data = await send<T>(method, url, undefined);
      markOnline();
      if (cacheable) cacheResponse(scope, url, data);
      return data;
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 0) throw err;
      markOffline();
      const cached = cacheable ? await cachedResponse(scope, url) : undefined;
      if (cached) return cached.data as T;
      throw new ApiError(0, 'Hors ligne : ces données n\'ont pas encore été consultées sur cet appareil. Elles s\'afficheront au retour de la connexion.');
    }
  }

  const queueable = method === 'POST' && scope ? QUEUEABLE.find(([rx]) => rx.test(path)) : undefined;
  if (!queueable) {
    try {
      const data = await send<T>(method, url, body);
      markOnline();
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        markOffline();
        throw new ApiError(0, 'Hors ligne : cette action a besoin d\'une connexion internet.');
      }
      throw err;
    }
  }

  // Saisie pouvant attendre : même clé d'idempotence en ligne et hors ligne, pour qu'un renvoi ne crée jamais de doublon
  const key = newOpKey();
  try {
    const data = await send<T>(method, url, body, { 'Idempotency-Key': key });
    markOnline();
    return data;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 0) throw err;
    markOffline();
    await enqueue({
      key, scope, method: 'POST', path: url, body, acting: getActingCompany(),
      label: queueable[1]((body || {}) as Record<string, unknown>), createdAt: Date.now(),
    });
    return { _offline: true, _queuedKey: key } as unknown as T;
  }
}

configureSync(
  (op) => send(op.method, op.path, op.body, { 'Idempotency-Key': op.key }, op.acting),
  currentScope,
);

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown = {}) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown = {}) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
