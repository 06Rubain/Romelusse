import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from '../lib/api';
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
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshCompany = useCallback(async () => {
    try { setCompany(await api.get<Company>('/company')); } catch { setCompany(null); }
  }, []);

  const loadSession = useCallback(async (nextUser: User | null) => {
    setUser(nextUser);
    // Les super-admins OmniCom n'appartiennent à aucune entreprise
    if (nextUser && !nextUser.isSuperAdmin) await refreshCompany();
    else setCompany(null);
  }, [refreshCompany]);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      setUser(await api.get<User>('/auth/me'));
    } catch {
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      let me: User | null = null;
      if (getToken()) {
        try { me = await api.get<User>('/auth/me'); } catch { setToken(null); }
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
    loadSession(nextUser);
  }, [loadSession]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setCompany(null);
  }, []);

  const can = useCallback((...permissions: Permission[]) => !!user && permissions.some((p) => user.permissions.includes(p)), [user]);

  return (
    <AuthContext.Provider value={{ user, company, loading, setSession, logout, refreshUser, refreshCompany, can }}>
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
