import { DEFAULT_LIMITS, Limits } from '@coffee/domain';

export interface AppConfig {
  appEnv: 'dev' | 'prod';
  databaseUrl: string;
  jwtSecret: string;
  webOrigin: string;
  vatRateBps: number;
  limits: Limits;
}

const KNOWN_DEV_SECRETS = ['change-me', 'dev-only-secret-change-me'];

function required(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key];
  if (!v) throw new Error(`Missing required environment variable ${key}`);
  return v;
}

function int(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${key} must be a non-negative integer, got "${raw}"`);
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const appEnv = env.APP_ENV ?? 'dev';
  if (appEnv !== 'dev' && appEnv !== 'prod') throw new Error(`APP_ENV must be "dev" or "prod", got "${appEnv}"`);
  const jwtSecret = required(env, 'JWT_SECRET');
  if (appEnv === 'prod' && (jwtSecret.length < 32 || KNOWN_DEV_SECRETS.includes(jwtSecret))) {
    throw new Error('JWT_SECRET must be at least 32 characters and not a known dev value when APP_ENV=prod');
  }
  return {
    appEnv,
    databaseUrl: required(env, 'DATABASE_URL'),
    jwtSecret,
    webOrigin: env.WEB_ORIGIN || 'http://localhost:5173',
    vatRateBps: int(env, 'VAT_RATE_BPS', 700),
    limits: {
      maxAddOns: int(env, 'MAX_ADDONS', DEFAULT_LIMITS.maxAddOns),
      maxSameAddOn: int(env, 'MAX_SAME_ADDON', DEFAULT_LIMITS.maxSameAddOn),
      maxCups: int(env, 'MAX_CUPS', DEFAULT_LIMITS.maxCups),
    },
  };
}
