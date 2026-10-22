import { createTestApp, idem, resetOrders, TestApp } from './helpers/test-app';

const CART = {
  lines: [
    { base: 'TEA', size: 'SIZE_MEDIUM', addOns: [], quantity: 2 },
    { base: 'COFFEE', size: 'SIZE_LARGE', addOns: [{ code: 'VANILLA', count: 1 }], quantity: 1 },
  ],
};

describe('POST /orders', () => {
  let t: TestApp;
  let token: string;
  const post = (body: unknown, tok = token) => t.http.post('/orders').set(idem()).set('Authorization', `Bearer ${tok}`).send(body as object);
  const count = async (table: string) => Number((await t.ds.query(`SELECT count(*)::int AS n FROM ${table}`))[0].n);

  beforeAll(async () => {
    t = await createTestApp({ now: new Date('2026-10-21T07:05:00Z') });
    token = await t.login('cashier1');
  });
  beforeEach(async () => {
    await resetOrders(t.ds);
    t.clock.set(new Date('2026-10-21T07:05:00Z'));
  });
  afterAll(async () => { await t.app.close(); });

  it('requires a JWT', async () => {
    const res = await t.http.post('/orders').send(CART);
    expect(res.status).toBe(401);
  });

  it('places the R§14.1 cart', async () => {
    const res = await post(CART);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      orderNumber: '20261021-0001',
      status: 'PENDING_PAYMENT',
      createdAt: '2026-10-21T07:05:00.000Z',
      createdBy: { displayName: 'Cashier 1' },
      lines: [
        { quantity: 2, descriptionEn: 'Medium Tea', descriptionTh: 'ชา แก้วกลาง', unitPrice: '55.00', lineTotal: '110.00' },
        { quantity: 1, descriptionEn: 'Large Coffee, Vanilla', descriptionTh: 'กาแฟ แก้วใหญ่, วานิลลา', unitPrice: '90.00', lineTotal: '90.00' },
      ],
      subtotal: '200.00', total: '200.00', vatRateBps: 700, vat: '13.08', beforeVat: '186.92',
    });
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.createdBy.id).toBe('string');
    const [row] = await t.ds.query('SELECT created_by_staff_id, business_date FROM orders');
    expect(row.created_by_staff_id).toBe(res.body.createdBy.id);
  });

  it('numbers a second order 0002', async () => {
    await post(CART);
    const res = await post(CART);
    expect(res.body.orderNumber).toBe('20261021-0002');
  });

  it('allocates 0001..0010 for 10 concurrent orders', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => post(CART)));
    expect(results.map((r) => r.status)).toEqual(Array(10).fill(201));
    const nums = results.map((r) => r.body.orderNumber as string).sort();
    expect(nums).toEqual(Array.from({ length: 10 }, (_, i) => `20261021-${String(i + 1).padStart(4, '0')}`));
  });

  it('uses the Bangkok business date (17:30Z is already tomorrow)', async () => {
    t.clock.set(new Date('2026-10-21T17:30:00Z'));
    const res = await post(CART);
    expect(res.body.orderNumber).toBe('20261022-0001');
  });

  it('widens to 5 digits after 9999', async () => {
    await t.ds.query("INSERT INTO order_number_counters (business_date, last_value) VALUES ('2026-10-21', 9999)");
    const res = await post(CART);
    expect(res.body.orderNumber).toBe('20261021-10000');
  });

  it('rejects a domain violation with details and writes nothing', async () => {
    const res = await post({ lines: [{ base: 'COFFEE', size: 'SIZE_LARGE', addOns: [{ code: 'VANILLA', count: 6 }], quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toEqual([
      expect.objectContaining({ line: 0, code: 'ADDON_REPEAT_LIMIT_EXCEEDED', params: { code: 'VANILLA', max: 5 } }),
    ]);
    expect(await count('orders')).toBe(0);
    expect(await count('order_number_counters')).toBe(0);
  });

  it.each([
    ['empty object', {}],
    ['lines not an array', { lines: 'x' }],
    ['extra property', { lines: [], extra: 1 }],
    ['string quantity', { lines: [{ base: 'TEA', size: 'SIZE_SMALL', addOns: [], quantity: '2' }] }],
  ])('shape error (%s) -> INVALID_BODY', async (_n, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.length).toBeGreaterThan(0);
    for (const d of res.body.error.details) expect(d.code).toBe('INVALID_BODY');
  });

  it('empty lines -> ORDER_EMPTY', async () => {
    const res = await post({ lines: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ code: 'ORDER_EMPTY' }]);
  });

  it('quantity 0 -> INVALID_QUANTITY on line 0', async () => {
    const res = await post({ lines: [{ base: 'TEA', size: 'SIZE_SMALL', addOns: [], quantity: 0 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ line: 0, code: 'INVALID_QUANTITY' })]);
  });

  it('huge integer quantity -> 400 ORDER_CUP_LIMIT_EXCEEDED, never 500', async () => {
    const res = await post({ lines: [{ base: 'TEA', size: 'SIZE_SMALL', addOns: [], quantity: 1e13 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toEqual([expect.objectContaining({ code: 'ORDER_CUP_LIMIT_EXCEEDED' })]);
  });

  it('body over 100 KB -> 400 VALIDATION_FAILED / INVALID_BODY', async () => {
    const res = await t.http.post('/orders').set(idem()).set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json').send(JSON.stringify({ pad: 'x'.repeat(200_000) }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'VALIDATION_FAILED', details: [{ code: 'INVALID_BODY', params: { field: 'body' } }] } });
  });

  it('malformed JSON -> 400 VALIDATION_FAILED / INVALID_BODY', async () => {
    const res = await t.http.post('/orders').set(idem()).set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json').send('{"lines":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'VALIDATION_FAILED', details: [{ code: 'INVALID_BODY', params: { field: 'body' } }] } });
  });

  it('rejects a client-supplied staffId and always uses the token staff', async () => {
    const t2 = await t.login('cashier2');
    const [c2] = await t.ds.query("SELECT id FROM staff WHERE username='cashier2'");
    const bad = await post({ ...CART, staffId: c2.id });
    expect(bad.status).toBe(400);
    const ok = await post(CART, t2);
    expect(ok.body.createdBy.displayName).toBe('Cashier 2');
    expect(ok.body.createdBy.id).toBe(c2.id);
  });

  it('persists drink components with positions 0..4', async () => {
    const res = await post({
      lines: [{ base: 'LATTE', size: 'SIZE_LARGE', quantity: 1, addOns: [
        { code: 'VANILLA', count: 1 }, { code: 'WHIPPED_CREAM', count: 1 },
        { code: 'EXTRA_COFFEE_SHOT', count: 1 }, { code: 'VANILLA', count: 1 },
      ] }],
    });
    expect(res.status).toBe(201);
    expect(res.body.lines[0].descriptionEn).toBe('Large Latte, Extra Coffee Shot, 2x Vanilla, Whipped Cream');
    const rows = await t.ds.query(
      `SELECT i.code, i.count, i.position, i.category, i.unit_price FROM order_line_items i
       JOIN order_lines l ON l.id = i.order_line_id ORDER BY i.position`);
    expect(rows.map((r: { code: string; count: number; position: number }) => [r.code, r.count, r.position])).toEqual([
      ['LATTE', 1, 0], ['SIZE_LARGE', 1, 1], ['EXTRA_COFFEE_SHOT', 1, 2], ['VANILLA', 2, 3], ['WHIPPED_CREAM', 1, 4],
    ]);
  });
});
