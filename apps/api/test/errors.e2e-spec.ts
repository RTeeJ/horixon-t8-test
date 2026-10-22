import { createTestApp } from './helpers/test-app';

describe('error filter', () => {
  it('unknown route -> 404 NOT_FOUND', async () => {
    const t = await createTestApp();
    const res = await t.http.get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND' } });
    await t.app.close();
  });

  it('allows the configured web origin via CORS', async () => {
    const t = await createTestApp();
    const res = await t.http.get('/menu').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const other = await t.http.get('/menu').set('Origin', 'http://evil.example');
    expect(other.headers['access-control-allow-origin']).not.toBe('http://evil.example');
    await t.app.close();
  });
});
