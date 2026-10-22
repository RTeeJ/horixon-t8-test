import type { DomainError, ErrorCode } from '@coffee/domain';
import { clearStoredAuth, readStoredAuth, notifyUnauthorized } from '../auth/storage';

const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    public details: DomainError[] = [],
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

interface Init {
  method?: string;
  body?: unknown;
  /** Public call (e.g. login): no Authorization header, a 401 does not log out. */
  public?: boolean;
  /** Sent as the Idempotency-Key header on mutating calls (D§5.5). */
  idempotencyKey?: string;
}

export async function apiFetch<T>(path: string, init: Init = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;
  if (!init.public) {
    const token = readStoredAuth()?.accessToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'INTERNAL');
  }
  if (res.ok) return (await res.json()) as T;

  let code: ErrorCode = 'INTERNAL';
  let details: DomainError[] = [];
  try {
    const body = await res.json();
    if (body?.error?.code) code = body.error.code;
    if (Array.isArray(body?.error?.details)) details = body.error.details;
  } catch {
    /* non-JSON error body */
  }
  if (res.status === 401 && !init.public) {
    clearStoredAuth();
    notifyUnauthorized();
  }
  throw new ApiError(res.status, code, details);
}
