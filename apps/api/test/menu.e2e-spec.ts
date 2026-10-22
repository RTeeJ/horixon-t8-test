import { createTestApp, TestApp } from './helpers/test-app';

const CODES = [
  'COFFEE', 'TEA', 'MILK', 'LATTE',
  'AMERICANO', 'ESPRESSO', 'CAPPUCCINO', 'MOCHA', 'THAI_TEA', 'LEMON_TEA', 'MATCHA_LATTE', 'COCOA',
  'SIZE_SMALL', 'SIZE_MEDIUM', 'SIZE_LARGE',
  'EXTRA_COFFEE_SHOT', 'EXTRA_MILK', 'VANILLA', 'CARAMEL', 'CHOCOLATE',
  'WHIPPED_CREAM', 'CINNAMON', 'MARSHMALLOWS',
];

describe('GET /menu', () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.app.close(); });

  it('is public and returns the 23 seed items in category/sortOrder order', async () => {
    const res = await t.http.get('/menu');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(23);
    expect(res.body.items[0]).toMatchObject({ code: 'COFFEE', price: '50.00', nameTh: 'กาแฟ', category: 'BASE', sortOrder: 1 });
    expect(res.body.items.map((i: { code: string }) => i.code)).toEqual(CODES);
    expect(res.body.items[4]).toMatchObject({ code: 'AMERICANO', price: '55.00', nameTh: 'อเมริกาโน่' });
    expect(res.body.items[12]).toMatchObject({ code: 'SIZE_SMALL', price: '0.00' });
  });

  it('omits inactive items', async () => {
    await t.ds.query("UPDATE menu_items SET is_active=false WHERE code='TEA'");
    try {
      const res = await t.http.get('/menu');
      expect(res.body.items).toHaveLength(22);
      expect(res.body.items.map((i: { code: string }) => i.code)).not.toContain('TEA');
    } finally {
      await t.ds.query("UPDATE menu_items SET is_active=true WHERE code='TEA'");
    }
  });
});
