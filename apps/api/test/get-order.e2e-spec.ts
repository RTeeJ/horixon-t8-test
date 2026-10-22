import { randomUUID } from 'node:crypto';
import { createTestApp, idem, resetOrders, TestApp } from './helpers/test-app';

const CART = {
  lines: [
    { base: 'TEA', size: 'SIZE_MEDIUM', addOns: [], quantity: 2 },
    { base: 'COFFEE', size: 'SIZE_LARGE', addOns: [{ code: 'VANILLA', count: 1 }], quantity: 1 },
  ],
};

describe('GET /orders/:id', () => {
  let t: TestApp;
  let token: string;
  const get = (id: string, tok: string | null = token) => {
    const req = t.http.get(`/orders/${id}`);
    return tok ? req.set('Authorization', `Bearer ${tok}`) : req;
  };
  const place = (tok = token) => t.http.post('/orders').set(idem()).set('Authorization', `Bearer ${tok}`).send(CART);

  beforeAll(async () => {
    t = await createTestApp({ now: new Date('2026-10-21T07:05:00Z') });
    token = await t.login('cashier1');
  });
  beforeEach(async () => { await resetOrders(t.ds); });
  afterAll(async () => { await t.app.close(); });

  it('returns the same body as the POST response', async () => {
    const posted = await place();
    const res = await get(posted.body.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(posted.body);
  });

  it('is a snapshot: later menu changes do not alter the order (A14)', async () => {
    const posted = await place();
    const [orig] = await t.ds.query(`SELECT price, name_en FROM menu_items WHERE code='TEA'`);
    try {
      await t.ds.query(`UPDATE menu_items SET price='99.00', name_en='Tea X' WHERE code='TEA'`);
      const res = await get(posted.body.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(posted.body);
      expect(res.body.lines[0]).toMatchObject({ descriptionEn: 'Medium Tea', unitPrice: '55.00' });
    } finally {
      await t.ds.query(`UPDATE menu_items SET price=$1, name_en=$2 WHERE code='TEA'`, [orig.price, orig.name_en]);
    }
  });

  it('404 for unknown or malformed ids', async () => {
    const a = await get(randomUUID());
    expect(a.status).toBe(404);
    expect(a.body.error.code).toBe('NOT_FOUND');
    const b = await get('abc');
    expect(b.status).toBe(404);
    expect(b.body.error.code).toBe('NOT_FOUND');
  });

  it('requires a JWT', async () => {
    const posted = await place();
    expect((await get(posted.body.id, null)).status).toBe(401);
  });

  it('is readable by another cashier', async () => {
    const posted = await place();
    const other = await t.login('cashier2');
    const res = await get(posted.body.id, other);
    expect(res.status).toBe(200);
    expect(res.body.createdBy.displayName).toBe('Cashier 1');
  });
});
