import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, fromCache } from './api';

// Charge des données et expose un rechargement ; ignore les réponses obsolètes.
// À l'ouverture d'une page, les dernières données gardées sur l'appareil s'affichent tout de suite,
// puis sont remplacées par la réponse du serveur (pas d'attente sur une connexion lente).
export function useFetch<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);

  // useCache : seulement à l'ouverture (après une modification, on attend la donnée à jour pour éviter un retour en arrière visible)
  const run = useCallback(async (useCache: boolean) => {
    const id = ++requestId.current;
    setError('');
    let shown = false;
    if (useCache) {
      try {
        const cached = await fromCache(load);
        if (id === requestId.current) {
          setData(cached);
          setLoading(false);
          shown = true;
        }
      } catch { /* rien sur l'appareil : on attend le serveur */ }
    }
    if (!shown) setLoading(true);
    try {
      const result = await load();
      if (id === requestId.current) setData(result);
    } catch (err) {
      if (id === requestId.current && !shown) setError(errorMessage(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [load]);

  const reload = useCallback(() => run(false), [run]);

  useEffect(() => { run(true); }, [run]);

  // Saisies faites hors ligne envoyées au serveur : les données affichées sont rechargées
  useEffect(() => {
    window.addEventListener('omnicom:synced', reload);
    return () => window.removeEventListener('omnicom:synced', reload);
  }, [reload]);

  return { data, loading, error, reload, setData };
}
