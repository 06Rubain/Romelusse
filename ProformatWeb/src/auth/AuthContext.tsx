import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from '../lib/api';
import type { Role, Settings, User } from '../lib/types';

interface AuthState {
  user: User | null;
  settings: Settings | null;
  loading: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try { setSettings(await api.get<Settings>('/settings')); } catch { /* non bloquant */ }
  }, []);

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
      await refreshUser();
      if (getToken()) await refreshSettings();
      setLoading(false);
    })();
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [refreshUser, refreshSettings]);

  const setSession = useCallback((token: string, nextUser: User) => {
    setToken(token);
    setUser(nextUser);
    refreshSettings();
  }, [refreshSettings]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const hasRole = useCallback((...roles: Role[]) => !!user && roles.includes(user.role), [user]);

  return (
    <AuthContext.Provider value={{ user, settings, loading, setSession, logout, refreshUser, refreshSettings, hasRole }}>
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
