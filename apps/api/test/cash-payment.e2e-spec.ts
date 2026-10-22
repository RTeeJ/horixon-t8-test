import { randomUUID } from 'node:crypto';
import { createTestApp, idem, resetOrders, TestApp } from './helpers/test-app';

const CART = {
  lines: [
    { base: 'TEA', size: 'SIZE_MEDIUM', addOns: [], quantity: 2 },
    { base: 'COFFEE', size: 'SIZE_LARGE', addOns: [{ code: 'VANILLA', count: 1 }], quantity: 1 },
  ],
};

describe('POST /orders/:id/payments (cash)', () => {
  let t: TestApp;
  let token: string;
  const auth = (tok = token) => ({ Authorization: `Bearer ${tok}` });
  const place = async (tok = token): Promise<string> => {
    const res = await t.http.post('/orders').set(idem()).set(auth(tok)).send(CART);
    expect(res.body.total).toBe('200.00');
    return res.body.id as string;
  };
  const pay = (id: string, body: object, tok = token, headers: Record<string, string> = idem()) =>
    t.http.post(`/orders/${id}/payments`).set(headers).set(auth(tok)).send(body);
  const count = async (table: string) => Number((await t.ds.query(`SELECT count(*)::int AS n FROM ${table}`))[0].n);

  beforeAll(async () => {
    t = await createTestApp({ now: new Date('2026-10-21T07:05:00Z') });
    token = await t.login('cashier1');
  });
  beforeEach(async () => { await resetOrders(t.ds); });
  afterAll(async () => { await t.app.close(); });

  it('takes cash and gives change', async () => {
    const id = await place();
    const res = await pay(id, { method: 'CASH', cashReceived: '250.00' });
    expect(res.status).toBe(201);
    expect(res.body.transaction).toMatchObject({
      method: 'CASH', status: 'SUCCEEDED', amount: '200.00', cashReceived: '250.00', change: '50.00',
      completedAt: '2026-10-21T07:05:00.000Z',
    });
    expect(res.body.order.status).toBe('PAID');
    const got = await t.http.get(`/orders/${id}`).set(auth());
    expect(got.body.transactions).toHaveLength(1);
    expect(got.body.status).toBe('PAID');
  });

  it('exact cash gives 0.00 change', async () => {
    const res = await pay(await place(), { method: 'CASH', cashReceived: '200' });
    expect(res.status).toBe(201);
    expect(res.body.transaction.change).toBe('0.00');
  });

  it('A11: rejects too little cash', async () => {
    const id = await place();
    const res = await pay(id, { method: 'CASH', cashReceived: '150.00' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toMatchObject([{ code: 'CASH_INSUFFICIENT' }]);
    expect((await t.http.get(`/orders/${id}`).set(auth())).body.status).toBe('PENDING_PAYMENT');
    expect(await count('payment_transactions')).toBe(0);
  });

  it.each(['10000.01', '', 'abc', '200.005', '-5', '1e3'])('A20: malformed amount %j -> CASH_AMOUNT_INVALID', async (v) => {
    const res = await pay(await place(), { method: 'CASH', cashReceived: v });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toMatchObject([{ code: 'CASH_AMOUNT_INVALID' }]);
  });

  it('rejects a numeric or missing cashReceived as INVALID_BODY', async () => {
    const id = await place();
    for (const body of [{ method: 'CASH', cashReceived: 200 }, { method: 'CASH' }]) {
      const res = await pay(id, body);
      expect(res.status).toBe(400);
      expect(res.body.error.details).toMatchObject([{ code: 'INVALID_BODY', params: { field: 'cashReceived' } }]);
    }
  });

  it('cannot pay twice', async () => {
    const id = await place();
    expect((await pay(id, { method: 'CASH', cashReceived: '200.00' })).status).toBe(201);
    const again = await pay(id, { method: 'CASH', cashReceived: '200.00' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ORDER_NOT_PAYABLE');
  });

  it('records who took the payment', async () => {
    const id = await place();
    const token2 = await t.login('cashier2');
    expect((await pay(id, { method: 'CASH', cashReceived: '200.00' }, token2)).status).toBe(201);
    const [row] = await t.ds.query(`SELECT processed_by_staff_id AS s FROM payment_transactions`);
    const [staff] = await t.ds.query(`SELECT id FROM staff WHERE username='cashier2'`);
    expect(row.s).toBe(staff.id);
  });

  it('two terminals pay at once -> one wins', async () => {
    const id = await place();
    const results = await Promise.all([
      pay(id, { method: 'CASH', cashReceived: '200.00' }),
      pay(id, { method: 'CASH', cashReceived: '200.00' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await t.ds.query(`SELECT 1 FROM payment_transactions WHERE status='SUCCEEDED'`)).toHaveLength(1);
  });

  it('a key reused on another order -> 422', async () => {
    const a = await place();
    const b = await place();
    const key = { 'Idempotency-Key': randomUUID() };
    expect((await pay(a, { method: 'CASH', cashReceived: '200.00' }, token, key)).status).toBe(201);
    const res = await pay(b, { method: 'CASH', cashReceived: '200.00' }, token, key);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect((await t.http.get(`/orders/${b}`).set(auth())).body.status).toBe('PENDING_PAYMENT');
  });

  it('404 for unknown or malformed order ids', async () => {
    for (const id of [randomUUID(), 'not-a-uuid']) {
      const res = await pay(id, { method: 'CASH', cashReceived: '200.00' });
      expect(res.status).toBe(404);
    }
  });

  it('requires a JWT', async () => {
    const res = await t.http.post(`/orders/${randomUUID()}/payments`).set(idem()).send({ method: 'CASH', cashReceived: '1' });
    expect(res.status).toBe(401);
  });
});
