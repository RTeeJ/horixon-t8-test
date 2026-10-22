import { createTestApp, TestApp } from './helpers/test-app';

describe('Security headers', () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.app.close(); });

  it('sets helmet headers and hides the framework on success and error responses', async () => {
    for (const res of [await t.http.get('/menu'), await t.http.get('/auth/me')]) {
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    }
  });

  it('still allows the web origin to call the API (CORS)', async () => {
    const res = await t.http.get('/menu').set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
