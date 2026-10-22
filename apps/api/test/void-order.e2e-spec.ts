import { createTestApp, idem, resetOrders, TestApp } from './helpers/test-app';

const CART = { lines: [{ base: 'TEA', size: 'SIZE_MEDIUM', addOns: [], quantity: 2 }] };
const T0 = new Date('2026-10-21T07:05:00Z');

describe('Void order', () => {
  let t: TestApp;
  let token1: string;
  let token2: string;
  const auth = (tok = token1) => ({ Authorization: `Bearer ${tok}` });
  const place = async (): Promise<string> => (await t.http.post('/orders').set(idem()).set(auth()).send(CART)).body.id;
  const voidOrder = (id: string, body: object, tok = token2) =>
    t.http.post(`/orders/${id}/void`).set(idem()).set(auth(tok)).send(body);
  const cash = (id: string) =>
    t.http.post(`/orders/${id}/payments`).set(idem()).set(auth()).send({ method: 'CASH', cashReceived: '200.00' });
  const qr = (id: string) => t.http.post(`/orders/${id}/payments`).set(idem()).set(auth()).send({ method: 'QR' });

  beforeAll(async () => {
    t = await createTestApp({ now: T0 });
    token1 = await t.login('cashier1');
    token2 = await t.login('cashier2');
  });
  beforeEach(async () => { await resetOrders(t.ds); t.clock.set(T0); });
  afterAll(async () => { await t.app.close(); });

  it('voids a pending order', async () => {
    const id = await place();
    const res = await voidOrder(id, { reasonCode: 'WRONG_ORDER_ENTRY' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('VOIDED');
    expect(res.body.voided).toMatchObject({
      at: '2026-10-21T07:05:00.000Z',
      by: { displayName: 'Cashier 2' },
      reasonCode: 'WRONG_ORDER_ENTRY',
      note: null,
    });
  });

  it('A12: cannot void a paid order, nor a voided one', async () => {
    const paid = await place();
    await cash(paid);
    const r1 = await voidOrder(paid, { reasonCode: 'OUT_OF_STOCK' });
    expect(r1.status).toBe(409);
    expect(r1.body.error.code).toBe('VOID_NOT_ALLOWED');

    const id = await place();
    expect((await voidOrder(id, { reasonCode: 'OUT_OF_STOCK' })).status).toBe(200);
    const r2 = await voidOrder(id, { reasonCode: 'OUT_OF_STOCK' });
    expect(r2.status).toBe(409);
    expect(r2.body.error.code).toBe('VOID_NOT_ALLOWED');
  });

  it('OTHER needs a note', async () => {
    const id = await place();
    for (const body of [{ reasonCode: 'OTHER' }, { reasonCode: 'OTHER', note: '   ' }]) {
      const res = await voidOrder(id, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details).toEqual([{ code: 'VOID_NOTE_REQUIRED' }]);
    }
    const ok = await voidOrder(id, { reasonCode: 'OTHER', note: 'Spilled' });
    expect(ok.status).toBe(200);
    expect(ok.body.voided.note).toBe('Spilled');
  });

  it('a 201-character note and an unknown reasonCode are rejected', async () => {
    const id = await place();
    const long = await voidOrder(id, { reasonCode: 'OTHER', note: 'x'.repeat(201) });
    expect(long.status).toBe(400);
    expect(long.body.error.code).toBe('VALIDATION_FAILED');
    expect(long.body.error.details).toEqual([{ code: 'INVALID_BODY', params: { field: 'note' } }]);
    const bad = await voidOrder(id, { reasonCode: 'BORED' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    expect(bad.body.error.details).toEqual([{ code: 'INVALID_BODY', params: { field: 'reasonCode' } }]);
  });

  it('voiding expires a pending QR', async () => {
    const id = await place();
    const tx = (await qr(id)).body.transaction.id;
    expect((await voidOrder(id, { reasonCode: 'CUSTOMER_LEFT_UNPAID' })).status).toBe(200);
    expect((await t.ds.query('SELECT status FROM payment_transactions WHERE id = $1', [tx]))[0].status).toBe('EXPIRED');
    const confirm = await t.http.post(`/payments/${tx}/mock-confirm`).set(idem()).set(auth());
    expect(confirm.status).toBe(409);
    expect(confirm.body.error.code).toBe('PAYMENT_EXPIRED');
    const pay = await cash(id);
    expect(pay.status).toBe(409);
    expect(pay.body.error.code).toBe('ORDER_NOT_PAYABLE');
  });

  it('A17: void and pay race, exactly one wins', async () => {
    for (let i = 0; i < 5; i++) {
      const id = await place();
      const [v, p] = await Promise.all([voidOrder(id, { reasonCode: 'CUSTOMER_CHANGED_MIND' }), cash(id)]);
      const ok = [v, p].filter((r) => r.status >= 200 && r.status < 300);
      expect(ok).toHaveLength(1);
      const loser = ok[0] === v ? p : v;
      expect(loser.status).toBe(409);
      expect(['VOID_NOT_ALLOWED', 'ORDER_NOT_PAYABLE']).toContain(loser.body.error.code);
      const status = (await t.http.get(`/orders/${id}`).set(auth())).body.status;
      expect(status).toBe(ok[0] === v ? 'VOIDED' : 'PAID');
    }
  });
});
