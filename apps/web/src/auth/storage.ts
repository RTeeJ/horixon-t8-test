export const AUTH_KEY = 'pos.auth';

export interface Staff {
  id: number | string;
  displayName: string;
}
export type AppEnv = 'dev' | 'prod';
export interface StoredAuth {
  accessToken: string;
  staff: Staff;
  appEnv: AppEnv;
}

export function readStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v?.accessToken && v?.staff ? (v as StoredAuth) : null;
  } catch {
    return null;
  }
}

export function writeStoredAuth(auth: StoredAuth): void {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } catch {
    /* storage unavailable: session lives in memory only */
  }
}

export function clearStoredAuth(): void {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    /* storage unavailable */
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();
export function onUnauthorized(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function notifyUnauthorized(): void {
  listeners.forEach((fn) => fn());
}
