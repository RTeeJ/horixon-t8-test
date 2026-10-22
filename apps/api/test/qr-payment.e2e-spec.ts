import { randomUUID } from 'node:crypto';
import { createTestApp, idem, resetOrders, TestApp } from './helpers/test-app';

const CART = {
  lines: [
    { base: 'TEA', size: 'SIZE_MEDIUM', addOns: [], quantity: 2 },
    { base: 'COFFEE', size: 'SIZE_LARGE', addOns: [{ code: 'VANILLA', count: 1 }], quantity: 1 },
  ],
};
const T0 = new Date('2026-10-21T07:05:00Z');
const plus = (ms: number) => new Date(T0.getTime() + ms);
const MIN = 60_000;

describe('QR payment (mock)', () => {
  let t: TestApp;
  let token: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const place = async (): Promise<string> => (await t.http.post('/orders').set(idem()).set(auth()).send(CART)).body.id;
  const startQr = (id: string) => t.http.post(`/orders/${id}/payments`).set(idem()).set(auth()).send({ method: 'QR' });
  const startCash = (id: string) => t.http.post(`/orders/${id}/payments`).set(idem()).set(auth()).send({ method: 'CASH', cashReceived: '200.00' });
  const confirm = (txId: string) => t.http.post(`/payments/${txId}/mock-confirm`).set(idem()).set(auth());
  const dbStatus = async (txId: string): Promise<string> =>
    (await t.ds.query('SELECT status FROM payment_transactions WHERE id = $1', [txId]))[0].status;
  const orderStatus = async (id: string): Promise<string> => (await t.http.get(`/orders/${id}`).set(auth())).body.status;

  beforeAll(async () => {
    t = await createTestApp({ now: T0 });
    token = await t.login('cashier1');
  });
  beforeEach(async () => { await resetOrders(t.ds); t.clock.set(T0); });
  afterAll(async () => { await t.app.close(); });

  it('starts a QR', async () => {
    const id = await place();
    const res = await startQr(id);
    expect(res.status).toBe(201);
    expect(res.body.transaction).toMatchObject({
      method: 'QR', status: 'PENDING', amount: '200.00', expiresAt: '2026-10-21T07:10:00.000Z',
    });
    expect(res.body.transaction.qrPayload).toMatch(/^MOCKPAY\|MOCK-.+\|200\.00$/);
    expect(res.body.order.status).toBe('PENDING_PAYMENT');
  });

  it('confirm within 5 minutes pays', async () => {
    const id = await place();
    const tx = (await startQr(id)).body.transaction.id;
    t.clock.set(plus(4 * MIN + 59_000));
    const res = await confirm(tx);
    expect(res.status).toBe(200);
    expect(res.body.transaction.status).toBe('SUCCEEDED');
    expect(res.body.transaction.completedAt).toBe(plus(4 * MIN + 59_000).toISOString());
    expect(res.body.order.status).toBe('PAID');
  });

  it('confirm at exactly 5:00 still pays', async () => {
    const id = await place();
    const tx = (await startQr(id)).body.transaction.id;
    t.clock.set(plus(5 * MIN));
    const res = await confirm(tx);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('PAID');
  });

  it('A18: confirm after 6 minutes -> PAYMENT_EXPIRED, row persisted EXPIRED', async () => {
    const id = await place();
    const tx = (await startQr(id)).body.transaction.id;
    t.clock.set(plus(6 * MIN));
    const res = await confirm(tx);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_EXPIRED');
    expect(await dbStatus(tx)).toBe('EXPIRED');
    expect(await orderStatus(id)).toBe('PENDING_PAYMENT');
  });

  it('GET /payments/:id expires on access', async () => {
    const id = await place();
    const tx = (await startQr(id)).body.transaction.id;
    const fresh = await t.http.get(`/payments/${tx}`).set(auth());
    expect(fresh.status).toBe(200);
    expect(fresh.body.transaction.status).toBe('PENDING');
    t.clock.set(plus(6 * MIN));
    const res = await t.http.get(`/payments/${tx}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.transaction.status).toBe('EXPIRED');
    expect(res.body.order.status).toBe('PENDING_PAYMENT');
    expect(await dbStatus(tx)).toBe('EXPIRED');
  });

  it('a new QR expires the previous one', async () => {
    const id = await place();
    const first = (await startQr(id)).body.transaction.id;
    const second = (await startQr(id)).body.transaction.id;
    expect(await dbStatus(first)).toBe('EXPIRED');
    expect(await dbStatus(second)).toBe('PENDING');
    const rows = await t.ds.query("SELECT count(*)::int AS n FROM payment_transactions WHERE status = 'PENDING'");
    expect(rows[0].n).toBe(1);
    const res = await confirm(first);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_EXPIRED');
  });

  it('cash while a QR is showing expires the QR', async () => {
    const id = await place();
    const qr = (await startQr(id)).body.transaction.id;
    expect((await startCash(id)).status).toBe(201);
    expect(await dbStatus(qr)).toBe('EXPIRED');
    expect(await orderStatus(id)).toBe('PAID');
    const res = await confirm(qr);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_EXPIRED');
    const got = await t.http.get(`/orders/${id}`).set(auth());
    expect(got.body.transactions.map((x: { status: string }) => x.status)).toEqual(['EXPIRED', 'SUCCEEDED']);
  });

  it('confirming twice -> ORDER_NOT_PAYABLE', async () => {
    const id = await place();
    const tx = (await startQr(id)).body.transaction.id;
    expect((await confirm(tx)).status).toBe(200);
    const res = await confirm(tx);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_NOT_PAYABLE');
  });

  it('A19: mock confirm is 404 in prod', async () => {
    const id = await place();
    const tx = (await startQr(id)).body.transaction.id;
    const prod = await createTestApp({ appEnv: 'prod', now: T0 });
    try {
      const ptoken = await prod.login('cashier1');
      const res = await prod.http.post(`/payments/${tx}/mock-confirm`).set(idem()).set({ Authorization: `Bearer ${ptoken}` });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(await dbStatus(tx)).toBe('PENDING');
    } finally {
      await prod.app.close();
    }
  });

  it('GET /payments/:id is 404 for unknown and malformed ids', async () => {
    for (const bad of [randomUUID(), 'not-a-uuid']) {
      const res = await t.http.get(`/payments/${bad}`).set(auth());
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
    const res = await t.http.post(`/payments/${randomUUID()}/mock-confirm`).set(idem()).set(auth());
    expect(res.status).toBe(404);
  });
});
