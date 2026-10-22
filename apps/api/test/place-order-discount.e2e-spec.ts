import { createTestApp, idem, resetOrders, TestApp } from './helpers/test-app';

const CART = {
  lines: [
    { base: 'TEA', size: 'SIZE_MEDIUM', addOns: [], quantity: 2 },
    { base: 'COFFEE', size: 'SIZE_LARGE', addOns: [{ code: 'VANILLA', count: 1 }], quantity: 1 },
  ],
};
const TEA_ONLY = { lines: [CART.lines[0]] }; // 110.00

describe('POST /orders with a discount preset', () => {
  let t: TestApp;
  let token: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const post = (body: unknown, headers: Record<string, string> = idem()) => t.http.post('/orders').set(headers).set(auth()).send(body as object);
  const count = async (table: string) => Number((await t.ds.query(`SELECT count(*)::int AS n FROM ${table}`))[0].n);
  const presetId = async (code: string) => (await t.ds.query('SELECT id FROM discount_presets WHERE code = $1', [code]))[0].id as string;

  beforeAll(async () => {
    t = await createTestApp({ now: new Date('2026-10-21T07:05:00Z') });
    token = await t.login('cashier1');
  });
  beforeEach(async () => {
    await resetOrders(t.ds);
    t.clock.set(new Date('2026-10-21T07:05:00Z'));
  });
  afterAll(async () => { await t.app.close(); });

  it('places with PROMO_10_PERCENT (A3)', async () => {
    const res = await post({ ...CART, discount: { presetCode: 'PROMO_10_PERCENT' } });
    expect(res.status).toBe(201);
    const discount = { presetCode: 'PROMO_10_PERCENT', nameEn: 'Promotion 10%', nameTh: 'โปรโมชัน ลด 10%', amount: '20.00' };
    expect(res.body).toMatchObject({ subtotal: '200.00', discount, total: '180.00', vat: '11.78', beforeVat: '168.22', status: 'PENDING_PAYMENT' });
    const [row] = await t.ds.query('SELECT discount_amount, discount_preset_id FROM orders');
    expect(row.discount_amount).toBe('20.00');
    expect(row.discount_preset_id).toBe(await presetId('PROMO_10_PERCENT'));
    const got = await t.http.get(`/orders/${res.body.id}`).set(auth());
    expect(got.body.discount).toEqual(discount);
  });

  it('min spend met exactly (PROMO_30_BAHT on 200.00)', async () => {
    const res = await post({ ...CART, discount: { presetCode: 'PROMO_30_BAHT' } });
    expect(res.status).toBe(201);
    expect(res.body.total).toBe('170.00');
  });

  it('no discount', async () => {
    const res = await post(CART);
    expect(res.status).toBe(201);
    expect(res.body.discount).toBeNull();
    const [row] = await t.ds.query('SELECT discount_amount, discount_preset_id FROM orders');
    expect(row.discount_amount).toBe('0.00');
    expect(row.discount_preset_id).toBeNull();
  });

  it('below min spend', async () => {
    const res = await post({ ...TEA_ONLY, discount: { presetCode: 'PROMO_30_BAHT' } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toEqual([{ code: 'DISCOUNT_MIN_SPEND_NOT_MET', params: { minSubtotal: '200.00' } }]);
    expect(await count('orders')).toBe(0);
  });

  it('unknown preset', async () => {
    const res = await post({ ...CART, discount: { presetCode: 'NOPE' } });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ code: 'DISCOUNT_PRESET_UNAVAILABLE' })]);
    expect(await count('orders')).toBe(0);
  });

  it('inactive preset', async () => {
    await t.ds.query("UPDATE discount_presets SET is_active = false WHERE code = 'STAFF_15'");
    try {
      const res = await post({ ...CART, discount: { presetCode: 'STAFF_15' } });
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([expect.objectContaining({ code: 'DISCOUNT_PRESET_UNAVAILABLE' })]);
      expect(await count('orders')).toBe(0);
    } finally {
      await t.ds.query("UPDATE discount_presets SET is_active = true WHERE code = 'STAFF_15'");
    }
  });

  it.each([
    ['non-string code', { presetCode: 5 }],
    ['extra field', { presetCode: 'STAFF_15', value: '50' }],
    ['array instead of object', []],
  ])('bad discount shape: %s', async (_n, discount) => {
    const res = await post({ ...CART, discount });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_BODY' })]));
    expect(await count('orders')).toBe(0);
  });

  it('same key, different discount', async () => {
    const headers = idem();
    const first = await post({ ...CART, discount: { presetCode: 'STAFF_15' } }, headers);
    expect(first.status).toBe(201);
    const second = await post({ ...CART, discount: { presetCode: 'PROMO_10_PERCENT' } }, headers);
    expect(second.status).toBe(422);
    expect(second.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await count('orders')).toBe(1);
  });

  it('pays the discounted total', async () => {
    const placed = await post({ ...CART, discount: { presetCode: 'PROMO_10_PERCENT' } });
    const cash = await t.http.post(`/orders/${placed.body.id}/payments`).set(idem()).set(auth()).send({ method: 'CASH', cashReceived: '200.00' });
    expect(cash.status).toBe(201);
    expect(cash.body.transaction).toMatchObject({ amount: '180.00', change: '20.00' });
    expect(cash.body.order.discount).toMatchObject({ presetCode: 'PROMO_10_PERCENT', amount: '20.00' });

    const other = await post({ ...CART, discount: { presetCode: 'PROMO_10_PERCENT' } });
    const qr = await t.http.post(`/orders/${other.body.id}/payments`).set(idem()).set(auth()).send({ method: 'QR' });
    expect(qr.body.transaction.amount).toBe('180.00');

    const voided = await t.http.post(`/orders/${other.body.id}/void`).set(idem()).set(auth()).send({ reasonCode: 'CUSTOMER_CHANGED_MIND' });
    expect(voided.body.discount).toMatchObject({ presetCode: 'PROMO_10_PERCENT', amount: '20.00' });
  });
});
