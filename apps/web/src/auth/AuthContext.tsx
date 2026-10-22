import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from '../api/client';
import {
  clearStoredAuth,
  onUnauthorized,
  readStoredAuth,
  writeStoredAuth,
  type AppEnv,
  type Staff,
  type StoredAuth,
} from './storage';

interface AuthValue {
  staff: Staff | null;
  appEnv: AppEnv | null;
  login(username: string, password: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(() => readStoredAuth());

  // A 401 from any protected call clears storage (in apiFetch); mirror it in state so
  // RequireAuth redirects to /login. The cart lives elsewhere and is untouched.
  useEffect(() => onUnauthorized(() => setAuth(null)), []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiFetch<StoredAuth>('/auth/login', {
      body: { username, password },
      public: true,
    });
    writeStoredAuth(res);
    setAuth(res);
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setAuth(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ staff: auth?.staff ?? null, appEnv: auth?.appEnv ?? null, login, logout }),
    [auth, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
