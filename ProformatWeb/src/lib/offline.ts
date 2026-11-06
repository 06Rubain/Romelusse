import { useEffect, useState } from 'react';
import { idbAll, idbClear, idbDel, idbGet, idbSet } from './offlineStore';

// Mode hors ligne : dernières données consultées gardées sur l'appareil, saisies mises en file d'attente
// puis envoyées automatiquement au retour de la connexion (avec une clé d'idempotence : jamais de doublon).

export interface QueuedOp {
  key: string;
  scope: string;
  method: 'POST' | 'PUT';
  path: string;
  body: unknown;
  acting: string;
  label: string;
  createdAt: number;
}
export interface FailedOp extends QueuedOp { error: string }

export interface OfflineState {
  online: boolean;
  pending: number;
  syncing: boolean;
  failed: FailedOp[];
  // Nombre d'opérations envoyées lors de la dernière synchronisation (pour l'afficher une fois)
  lastSent: { count: number; at: number } | null;
}

let state: OfflineState = { online: typeof navigator === 'undefined' ? true : navigator.onLine, pending: 0, syncing: false, failed: [], lastSent: null };
const listeners = new Set<(s: OfflineState) => void>();
const emit = (patch: Partial<OfflineState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
};

export const markOnline = () => { if (!state.online) emit({ online: true }); };
export const markOffline = () => { if (state.online) emit({ online: false }); };
export const isOffline = () => !state.online;

// Données propres à un utilisateur et à l'entreprise ouverte (un appareil peut servir à plusieurs comptes)
export const scopeOf = (token: string, acting: string) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return `${payload.sub}|${acting}`;
  } catch {
    return '';
  }
};

// ---- Dernières réponses consultées ----
export const cacheResponse = (scope: string, url: string, data: unknown) => {
  if (scope) idbSet('responses', `${scope}|${url}`, { data, savedAt: Date.now() });
};
export const cachedResponse = async (scope: string, url: string) => (scope ? idbGet<{ data: unknown; savedAt: number }>('responses', `${scope}|${url}`) : undefined);
// À la déconnexion : rien ne reste lisible sur l'appareil
export const clearCachedResponses = () => idbClear('responses');

// ---- File d'attente ----
const refreshCounts = async (scope: string) => {
  const [ops, failed] = await Promise.all([idbAll<QueuedOp>('outbox'), idbAll<FailedOp>('failed')]);
  emit({ pending: ops.filter((o) => o.scope === scope).length, failed: failed.filter((o) => o.scope === scope).sort((a, b) => a.createdAt - b.createdAt) });
};

export const enqueue = async (op: QueuedOp) => {
  await idbSet('outbox', op.key, op);
  await refreshCounts(op.scope);
};

export const dismissFailed = async (scope: string) => {
  const failed = await idbAll<FailedOp>('failed');
  await Promise.all(failed.filter((f) => f.scope === scope).map((f) => idbDel('failed', f.key)));
  await refreshCounts(scope);
};

type Sender = (op: QueuedOp) => Promise<unknown>;
let sender: Sender | null = null;
let currentScope: () => string = () => '';
export const configureSync = (send: Sender, scope: () => string) => { sender = send; currentScope = scope; };

let flushing = false;
export const flush = async () => {
  const scope = currentScope();
  if (flushing || !sender || !scope) return;
  flushing = true;
  emit({ syncing: true });
  let sent = 0;
  try {
    const ops = (await idbAll<QueuedOp>('outbox')).filter((o) => o.scope === scope).sort((a, b) => a.createdAt - b.createdAt);
    for (const op of ops) {
      try {
        await sender(op);
        await idbDel('outbox', op.key);
        sent += 1;
        markOnline();
      } catch (err) {
        const status = (err as { status?: number }).status ?? 0;
        // Toujours hors ligne, session expirée ou serveur en difficulté : on réessaiera plus tard
        if (status === 0 || status === 401 || status >= 500) {
          if (status === 0) markOffline();
          break;
        }
        // Refus définitif (données invalides…) : mis de côté pour être montré à l'utilisateur
        await idbSet('failed', op.key, { ...op, error: err instanceof Error ? err.message : String(err) });
        await idbDel('outbox', op.key);
      }
    }
  } finally {
    flushing = false;
    await refreshCounts(scope);
    emit({ syncing: false, ...(sent ? { lastSent: { count: sent, at: Date.now() } } : {}) });
  }
};

// Relance automatique : retour du réseau, toutes les 30 secondes s'il reste des envois, au démarrage
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { markOnline(); flush(); });
  window.addEventListener('offline', markOffline);
  setInterval(() => { if (state.pending > 0 && navigator.onLine) flush(); }, 30000);
}

export const startSync = async () => {
  await refreshCounts(currentScope());
  if (navigator.onLine) flush();
};

export function useOffline() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    setS(state);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

export const newOpKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};
