import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './api';

// Charge des données et expose un rechargement ; ignore les réponses obsolètes
export function useFetch<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const result = await load();
      if (id === requestId.current) setData(result);
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [load]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload, setData };
}
