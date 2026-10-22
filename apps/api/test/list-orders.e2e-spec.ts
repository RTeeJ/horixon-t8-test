import { createTestApp, idem, resetOrders, TestApp } from './helpers/test-app';

const CART = { lines: [{ base: 'TEA', size: 'SIZE_MEDIUM', addOns: [], quantity: 2 }] };
const T0 = new Date('2026-10-21T07:05:00Z'); // 14:05 Bangkok, business date 2026-10-21

describe('List orders', () => {
  let t: TestApp;
  let token: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const place = async (): Promise<string> => (await t.http.post('/orders').set(idem()).set(auth()).send(CART)).body.id;
  const cash = (id: string) =>
    t.http.post(`/orders/${id}/payments`).set(idem()).set(auth()).send({ method: 'CASH', cashReceived: '200.00' });
  const qrPaid = async (id: string) => {
    const tx = await t.http.post(`/orders/${id}/payments`).set(idem()).set(auth()).send({ method: 'QR' });
    await t.http.post(`/payments/${tx.body.transaction.id}/mock-confirm`).set(idem()).set(auth());
  };
  const list = (q = '') => t.http.get(`/orders${q}`).set(auth());

  beforeAll(async () => {
    t = await createTestApp({ now: T0 });
    token = await t.login('cashier1');
  });
  beforeEach(async () => { await resetOrders(t.ds); t.clock.set(T0); });
  afterAll(async () => { await t.app.close(); });

  async function placeThree(): Promise<string[]> {
    const ids: string[] = [];
    for (const m of [5, 6, 7]) {
      t.clock.set(new Date(`2026-10-21T07:0${m}:00Z`));
      ids.push(await place());
    }
    return ids;
  }

  it('lists today newest first', async () => {
    await placeThree();
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body.orders.map((o: { orderNumber: string }) => o.orderNumber.slice(-4))).toEqual(['0003', '0002', '0001']);
    expect(res.body.orders[0]).toMatchObject({
      status: 'PENDING_PAYMENT',
      createdAt: '2026-10-21T07:07:00.000Z',
      createdBy: { displayName: 'Cashier 1' },
      paymentMethod: null,
    });
    expect(typeof res.body.orders[0].total).toBe('string');
    const asc = await list('?sort=asc');
    expect(asc.body.orders.map((o: { orderNumber: string }) => o.orderNumber.slice(-4))).toEqual(['0001', '0002', '0003']);
  });

  it('filters by status and method', async () => {
    const [a, b] = await placeThree();
    await cash(a);
    await qrPaid(b);
    expect((await list('?status=PAID')).body.orders).toHaveLength(2);
    expect((await list('?status=PENDING_PAYMENT')).body.orders).toHaveLength(1);
    const byCash = (await list('?method=CASH')).body.orders;
    expect(byCash).toHaveLength(1);
    expect(byCash[0]).toMatchObject({ id: a, paymentMethod: 'CASH' });
    expect((await list('?method=QR')).body.orders.map((o: { id: string }) => o.id)).toEqual([b]);
    const all = (await list()).body.orders;
    expect(all.find((o: { paymentMethod: unknown }) => o.paymentMethod === null).status).toBe('PENDING_PAYMENT');
  });

  it('uses the Bangkok date', async () => {
    t.clock.set(new Date('2026-10-21T17:30:00Z')); // 00:30 on 22 Oct in Bangkok
    await place();
    expect((await list('?date=2026-10-22')).body.orders).toHaveLength(1);
    expect((await list()).body.orders).toHaveLength(1);
    expect((await list('?date=2026-10-21')).body.orders).toHaveLength(0);
  });

  it('date range', async () => {
    expect((await list('?date=2026-10-14')).status).toBe(200); // today (21) - 7
    for (const d of ['2026-10-13', '2026-10-22', 'abc']) {
      const res = await list(`?date=${d}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details).toEqual([{ code: 'INVALID_BODY', params: { field: 'date' } }]);
    }
    const unknown = await list('?foo=1');
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.details).toEqual([{ code: 'INVALID_BODY', params: { field: 'foo' } }]);
  });

  it('requires a JWT', async () => {
    expect((await t.http.get('/orders')).status).toBe(401);
  });
});
