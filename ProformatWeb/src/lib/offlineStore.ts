// Petit stockage IndexedDB : dernières données consultées et saisies en attente d'envoi.
// Si IndexedDB est indisponible (navigation privée…), tout fonctionne en ligne, simplement sans mode hors ligne.
const DB_NAME = 'omnicom-offline';
export type StoreName = 'responses' | 'outbox' | 'failed';

let dbPromise: Promise<IDBDatabase | null> | null = null;

const open = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          for (const name of ['responses', 'outbox', 'failed']) {
            if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
};

const run = async <T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> => {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
};

export const idbGet = <T>(store: StoreName, key: string) => run<T>(store, 'readonly', (s) => s.get(key));
export const idbSet = (store: StoreName, key: string, value: unknown) => run(store, 'readwrite', (s) => s.put(value, key));
export const idbDel = (store: StoreName, key: string) => run(store, 'readwrite', (s) => s.delete(key));
export const idbClear = (store: StoreName) => run(store, 'readwrite', (s) => s.clear());
export const idbAll = async <T>(store: StoreName) => (await run<T[]>(store, 'readonly', (s) => s.getAll())) || [];
