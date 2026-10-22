import { loadConfig } from '../src/common/config';

const base = { DATABASE_URL: 'postgres://x', JWT_SECRET: 'a-sufficiently-long-random-secret-0123456789' };

describe('loadConfig JWT_SECRET in prod', () => {
  it('accepts a long random secret', () => {
    expect(loadConfig({ ...base, APP_ENV: 'prod' }).jwtSecret).toBe(base.JWT_SECRET);
  });
  it.each(['short', 'change-me', 'dev-only-secret-change-me'])('rejects %p in prod', (secret) => {
    expect(() => loadConfig({ ...base, APP_ENV: 'prod', JWT_SECRET: secret })).toThrow(/JWT_SECRET/);
  });
  it('stays permissive in dev', () => {
    expect(loadConfig({ ...base, APP_ENV: 'dev', JWT_SECRET: 'change-me' }).jwtSecret).toBe('change-me');
  });
});
