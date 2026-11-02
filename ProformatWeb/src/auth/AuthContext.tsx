import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, fromCache, getActingCompany, getToken, setActingCompany, setToken } from '../lib/api';
import { clearCachedResponses, startSync } from '../lib/offline';
import { warmOfflineCache } from '../lib/warmup';

// Seul un refus du serveur met fin à la session ; une coupure de réseau la conserve (mode hors ligne)
const isRefused = (err: unknown) => err instanceof ApiError && (err.status === 401 || err.status === 403);
import type { Company, Permission, User } from '../lib/types';

interface AuthState {
  user: User | null;
  company: Company | null;
  loading: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshCompany: () => Promise<void>;
  can: (...permissions: Permission[]) => boolean;
  // Super-admin OmniCom dans la console d'une entreprise
  acting: boolean;
  enterCompany: (companyId: string) => Promise<void>;
  exitCompany: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(() => Boolean(getActingCompany()));

  const refreshCompany = useCallback(async () => {
    try { setCompany(await api.get<Company>('/company')); } catch (err) { if (isRefused(err)) setCompany(null); }
  }, []);

  const loadSession = useCallback(async (nextUser: User | null) => {
    setUser(nextUser);
    // Les super-admins OmniCom n'appartiennent à aucune entreprise, sauf quand ils en ouvrent la console
    if (nextUser && (!nextUser.isSuperAdmin || getActingCompany())) await refreshCompany();
    else {
      setActingCompany(null);
      setActing(false);
      setCompany(null);
    }
  }, [refreshCompany]);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      setUser(await api.get<User>('/auth/me'));
    } catch (err) {
      if (!isRefused(err)) return;
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Ouverture immédiate avec la session gardée sur l'appareil ; le serveur la confirme juste après
      if (getToken()) {
        try {
          const cachedMe = await fromCache(() => api.get<User>('/auth/me'));
          const needsCompany = !cachedMe.isSuperAdmin || Boolean(getActingCompany());
          const cachedCompany = needsCompany ? await fromCache(() => api.get<Company>('/company')).catch(() => null) : null;
          if (!needsCompany || cachedCompany) {
            setUser(cachedMe);
            setCompany(cachedCompany);
            setLoading(false);
          }
        } catch { /* première ouverture sur cet appareil : on attend le serveur */ }
      }
      let me: User | null = null;
      if (getToken()) {
        try { me = await api.get<User>('/auth/me'); } catch (err) { if (isRefused(err)) setToken(null); }
      }
      await loadSession(me);
      setLoading(false);
    })();
    const onLogout = () => { setUser(null); setCompany(null); };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [loadSession]);

  const setSession = useCallback((token: string, nextUser: User) => {
    setToken(token);
    setActingCompany(null);
    setActing(false);
    loadSession(nextUser);
  }, [loadSession]);

  const enterCompany = useCallback(async (companyId: string) => {
    setActingCompany(companyId);
    setActing(true);
    await refreshCompany();
  }, [refreshCompany]);

  const exitCompany = useCallback(() => {
    setActingCompany(null);
    setActing(false);
    setCompany(null);
  }, []);

  const logout = useCallback(() => {
    clearCachedResponses();
    setToken(null);
    setActingCompany(null);
    setActing(false);
    setUser(null);
    setCompany(null);
  }, []);

  // Session ouverte : envoi des saisies en attente et préparation du mode hors ligne
  const sessionKey = user ? `${user._id}|${company?._id || ''}` : '';
  useEffect(() => {
    if (!sessionKey) return;
    startSync();
    warmOfflineCache(sessionKey, sessionKey.split('|')[1] !== '');
  }, [sessionKey]);

  const can = useCallback((...permissions: Permission[]) => {
    if (!user) return false;
    if (user.isSuperAdmin) return acting; // tous les droits dans la console ouverte
    return permissions.some((p) => user.permissions.includes(p));
  }, [user, acting]);

  return (
    <AuthContext.Provider value={{ user, company, loading, setSession, logout, refreshUser, refreshCompany, can, acting, enterCompany, exitCompany }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
