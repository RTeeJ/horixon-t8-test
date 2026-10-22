import { createTestApp, TestApp } from './helpers/test-app';

const ORIGINAL_NAME_EN = 'Staff discount 15%';

describe('GET /discount-presets', () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.app.close(); });
  afterEach(async () => {
    await t.ds.query("UPDATE discount_presets SET is_active = true, name_en = $1 WHERE code = 'STAFF_15'", [ORIGINAL_NAME_EN]);
  });

  it('requires a JWT', async () => {
    const res = await t.http.get('/discount-presets');
    expect(res.status).toBe(401);
  });

  it('lists the three presets in order', async () => {
    const token = await t.login();
    const res = await t.http.get('/discount-presets').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.presets).toHaveLength(3);
    expect(res.body.presets).toMatchObject([
      { code: 'STAFF_15', nameEn: 'Staff discount 15%', nameTh: 'ส่วนลดพนักงาน 15%', type: 'PERCENT', value: '15.00', minSubtotal: null },
      { code: 'PROMO_10_PERCENT', nameEn: 'Promotion 10%', nameTh: 'โปรโมชัน ลด 10%', type: 'PERCENT', value: '10.00', minSubtotal: '100.00' },
      { code: 'PROMO_30_BAHT', nameEn: 'Promotion ฿30', nameTh: 'โปรโมชัน ลด ฿30', type: 'AMOUNT', value: '30.00', minSubtotal: '200.00' },
    ]);
    for (const p of res.body.presets) expect(typeof p.id).toBe('string');
    expect(res.body.presets[0].minSubtotal).toBeNull();
  });

  it('hides inactive presets', async () => {
    await t.ds.query("UPDATE discount_presets SET is_active = false WHERE code = 'STAFF_15'");
    const token = await t.login();
    const res = await t.http.get('/discount-presets').set('Authorization', `Bearer ${token}`);
    expect(res.body.presets.map((p: { code: string }) => p.code)).toEqual(['PROMO_10_PERCENT', 'PROMO_30_BAHT']);
  });

  it('type and value are immutable', async () => {
    await expect(t.ds.query("UPDATE discount_presets SET value = 20 WHERE code = 'STAFF_15'")).rejects.toThrow(/immutable/);
    await expect(t.ds.query("UPDATE discount_presets SET type = 'AMOUNT' WHERE code = 'STAFF_15'")).rejects.toThrow(/immutable/);
  });

  it('name and is_active may change', async () => {
    await expect(t.ds.query("UPDATE discount_presets SET name_en = 'Staff 15%' WHERE code = 'STAFF_15'")).resolves.toBeDefined();
    await expect(t.ds.query("UPDATE discount_presets SET is_active = false WHERE code = 'STAFF_15'")).resolves.toBeDefined();
  });

  it('old orders get discount_amount 0', async () => {
    const rows = await t.ds.query(
      "SELECT column_default FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'discount_amount'",
    );
    expect(['0', '0::numeric']).toContain(rows[0].column_default);
  });
});
