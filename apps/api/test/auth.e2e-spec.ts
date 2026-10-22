import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { createTestApp, idem, TestApp } from './helpers/test-app';

const INVALID = { error: { code: 'INVALID_CREDENTIALS' } };

describe('auth', () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.app.close(); });

  it('logs in cashier1', async () => {
    const res = await t.http.post('/auth/login').send({ username: 'cashier1', password: 'password123' });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.staff.displayName).toBe('Cashier 1');
    expect(typeof res.body.staff.id).toBe('string');
    expect(res.body.appEnv).toBe('dev');
  });

  it('rejects wrong password and unknown user with an identical body', async () => {
    const a = await t.http.post('/auth/login').send({ username: 'cashier1', password: 'nope' });
    const b = await t.http.post('/auth/login').send({ username: 'ghost', password: 'password123' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(INVALID);
    expect(b.body).toEqual(INVALID);
  });

  it('rejects an inactive staff member', async () => {
    await t.ds.query("UPDATE staff SET is_active=false WHERE username='cashier2'");
    try {
      const res = await t.http.post('/auth/login').send({ username: 'cashier2', password: 'password123' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(INVALID);
    } finally {
      await t.ds.query("UPDATE staff SET is_active=true WHERE username='cashier2'");
    }
  });

  it('returns 400 VALIDATION_FAILED when password is missing', async () => {
    const res = await t.http.post('/auth/login').send({ username: 'cashier1' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('GET /auth/me requires a token', async () => {
    const none = await t.http.get('/auth/me');
    expect(none.status).toBe(401);
    expect(none.body).toEqual({ error: { code: 'UNAUTHORIZED' } });
    const token = await t.login();
    const ok = await t.http.get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ id: expect.any(String), displayName: 'Cashier 1' });
  });

  it('rejects a token signed with another secret', async () => {
    const { body } = await t.http.post('/auth/login').send({ username: 'cashier1', password: 'password123' });
    const forged = new JwtService({ secret: 'other-secret' }).sign({ sub: body.staff.id, name: 'Cashier 1' }, { expiresIn: '8h' });
    const res = await t.http.get('/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED' } });
  });

  it('rejects a valid token whose staff no longer exists (e.g. after a database reset)', async () => {
    const stale = t.app.get(JwtService).sign({ sub: randomUUID(), name: 'Cashier 1' });
    const me = await t.http.get('/auth/me').set('Authorization', `Bearer ${stale}`);
    expect(me.status).toBe(401);
    expect(me.body).toEqual({ error: { code: 'UNAUTHORIZED' } });
    // Before the check, the idempotency key's staff FK turned this into a 500.
    const place = await t.http.post('/orders').set(idem()).set('Authorization', `Bearer ${stale}`)
      .send({ lines: [{ base: 'TEA', size: 'SIZE_SMALL', addOns: [], quantity: 1 }] });
    expect(place.status).toBe(401);
    expect(place.body).toEqual({ error: { code: 'UNAUTHORIZED' } });
  });

  it('keeps accepting a token of a staff member deactivated after login (isActive is checked at login only)', async () => {
    const token = await t.login('cashier2');
    await t.ds.query("UPDATE staff SET is_active=false WHERE username='cashier2'");
    try {
      const res = await t.http.get('/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    } finally {
      await t.ds.query("UPDATE staff SET is_active=true WHERE username='cashier2'");
    }
  });
});
