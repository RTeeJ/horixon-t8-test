import { randomUUID } from 'node:crypto';
import { createTestApp, resetOrders, TestApp } from './helpers/test-app';

const CART = {
  lines: [
    { base: 'TEA', size: 'SIZE_MEDIUM', addOns: [], quantity: 2 },
    { base: 'COFFEE', size: 'SIZE_LARGE', addOns: [{ code: 'VANILLA', count: 1 }], quantity: 1 },
  ],
};

describe('Idempotency-Key on POST /orders', () => {
  let t: TestApp;
  let token: string;
  const send = (key: string | null, body: unknown, tok = token) => {
    const req = t.http.post('/orders').set('Authorization', `Bearer ${tok}`);
    return (key === null ? req : req.set('Idempotency-Key', key)).send(body as object);
  };
  const count = async (table: string) => Number((await t.ds.query(`SELECT count(*)::int AS n FROM ${table}`))[0].n);

  beforeAll(async () => {
    t = await createTestApp({ now: new Date('2026-10-21T07:05:00Z') });
    token = await t.login('cashier1');
  });
  beforeEach(async () => { await resetOrders(t.ds); });
  afterAll(async () => { await t.app.close(); });

  it('requires an Idempotency-Key', async () => {
    const res = await send(null, CART);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details[0].params.field).toBe('Idempotency-Key');
    expect((await send('x'.repeat(101), CART)).status).toBe(400);
    expect(await count('orders')).toBe(0);
  });

  it('A16: same key twice -> one order, identical responses', async () => {
    const key = randomUUID();
    const a = await send(key, CART);
    const b = await send(key, CART);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body).toEqual(a.body);
    expect(await count('orders')).toBe(1);
  });

  it('same key, different body -> 422 IDEMPOTENCY_KEY_REUSED', async () => {
    const key = randomUUID();
    await send(key, CART);
    const res = await send(key, { lines: [{ base: 'TEA', size: 'SIZE_SMALL', addOns: [], quantity: 1 }] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await count('orders')).toBe(1);
  });

  it('same key sent concurrently -> one order', async () => {
    const key = randomUUID();
    const results = await Promise.all([send(key, CART), send(key, CART)]);
    for (const r of results) expect([201, 409]).toContain(r.status);
    for (const r of results.filter((x) => x.status === 409)) expect(r.body.error.code).toBe('IDEMPOTENCY_IN_PROGRESS');
    const created = results.filter((x) => x.status === 201);
    expect(created.length).toBeGreaterThanOrEqual(1);
    for (const r of created) expect(r.body).toEqual(created[0].body);
    expect(await count('orders')).toBe(1);
  });

  it('a failed request does not keep the key', async () => {
    const key = randomUUID();
    const bad = await send(key, { lines: [] });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details).toEqual([expect.objectContaining({ code: 'ORDER_EMPTY' })]);
    expect(await count('idempotency_keys')).toBe(0);
    const ok = await send(key, CART);
    expect(ok.status).toBe(201);
  });

  it('keys are per staff', async () => {
    const key = randomUUID();
    const t2 = await t.login('cashier2');
    const a = await send(key, CART);
    const b = await send(key, CART, t2);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body.orderNumber).not.toBe(a.body.orderNumber);
  });
});
