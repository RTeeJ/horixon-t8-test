import { addDays, historyDates } from '@coffee/domain';
import { seedDemoOrders } from '../src/demo/demo-orders';
import { createTestApp, resetOrders, TestApp } from './helpers/test-app';

const T0 = new Date('2026-10-21T07:05:00Z'); // 14:05 Bangkok, business date 2026-10-21

interface Row {
  order_number: string;
  business_date: string;
  status: string;
  created_at: Date;
  discount_preset_id: string | null;
  void_reason_code: string | null;
  void_reason_note: string | null;
  username: string;
}

describe('Demo orders', () => {
  let t: TestApp;

  const rows = (): Promise<Row[]> =>
    t.ds.query(`SELECT o.order_number, to_char(o.business_date, 'YYYY-MM-DD') AS business_date, o.status, o.created_at,
                       o.discount_preset_id, o.void_reason_code, o.void_reason_note, s.username
                FROM orders o JOIN staff s ON s.id = o.created_by_staff_id ORDER BY o.created_at`);

  beforeAll(async () => { t = await createTestApp({ now: T0 }); });
  beforeEach(async () => { await resetOrders(t.ds); t.clock.set(T0); });
  afterAll(async () => { await t.app.close(); });

  it('fills today and the last 7 days with every order state', async () => {
    const result = await seedDemoOrders(t.app, t.clock, T0);
    const all = await rows();
    expect(result).toEqual({ created: all.length, skipped: false });

    expect([...new Set(all.map((r) => r.business_date))].sort().reverse()).toEqual(historyDates('2026-10-21'));
    expect(new Set(all.map((r) => r.status))).toEqual(new Set(['PAID', 'PENDING_PAYMENT', 'VOIDED']));
    expect(new Set(all.map((r) => r.username))).toEqual(new Set(['cashier1', 'cashier2']));
    const presets: { id: string }[] = await t.ds.query('SELECT id FROM discount_presets');
    expect(new Set(all.map((r) => r.discount_preset_id).filter(Boolean))).toEqual(new Set(presets.map((p) => p.id)));
    expect(all.some((r) => r.void_reason_code === 'OTHER' && r.void_reason_note)).toBe(true);

    // The clock is restored, and nothing is dated after it.
    expect(t.clock.now()).toEqual(T0);
    expect(all.every((r) => r.created_at.getTime() < T0.getTime())).toBe(true);

    // Order numbers restart each day, in time order.
    for (const date of historyDates('2026-10-21')) {
      const numbers = all.filter((r) => r.business_date === date).map((r) => r.order_number);
      const prefix = date.replaceAll('-', '');
      expect(numbers).toEqual(numbers.map((_, i) => `${prefix}-${String(i + 1).padStart(4, '0')}`));
    }
  });

  it('today has paid, pending and voided orders, and payments match the totals', async () => {
    await seedDemoOrders(t.app, t.clock, T0);
    const today = (await rows()).filter((r) => r.business_date === '2026-10-21');
    expect(new Set(today.map((r) => r.status))).toEqual(new Set(['PAID', 'PENDING_PAYMENT', 'VOIDED']));

    const paid: { method: string; amount: string; total: string; cash_received: string | null; change: string | null }[] =
      await t.ds.query(`SELECT pt.method, pt.amount, o.total, pt.cash_received, pt.change
                        FROM payment_transactions pt JOIN orders o ON o.id = pt.order_id
                        WHERE pt.status = 'SUCCEEDED'`);
    expect(new Set(paid.map((p) => p.method))).toEqual(new Set(['CASH', 'QR']));
    for (const p of paid) {
      expect(p.amount).toBe(p.total);
      if (p.method === 'CASH') expect(Number(p.cash_received) - Number(p.change)).toBeCloseTo(Number(p.total), 2);
    }
    const [{ n }] = await t.ds.query(
      `SELECT count(*)::int AS n FROM orders o
       WHERE o.status = 'PAID' AND NOT EXISTS (SELECT 1 FROM payment_transactions pt WHERE pt.order_id = o.id AND pt.status = 'SUCCEEDED')`,
    );
    expect(n).toBe(0);
  });

  it('just after midnight, today\'s orders stay on today', async () => {
    const early = new Date('2026-10-21T17:03:00Z'); // 00:03 on 22 Oct in Bangkok
    t.clock.set(early);
    await seedDemoOrders(t.app, t.clock, early);
    const all = await rows();
    const today = all.filter((r) => r.business_date === '2026-10-22');
    expect(today.length).toBeGreaterThan(0);
    expect(all.every((r) => r.created_at.getTime() < early.getTime())).toBe(true);
    expect(all.some((r) => r.business_date === addDays('2026-10-22', -7))).toBe(true);
  });

  it('adds nothing when orders already exist', async () => {
    const first = await seedDemoOrders(t.app, t.clock, T0);
    const second = await seedDemoOrders(t.app, t.clock, T0);
    expect(second).toEqual({ created: 0, skipped: true });
    expect(await rows()).toHaveLength(first.created);
  });

  it('refuses to run unless APP_ENV=dev', async () => {
    const prod = await createTestApp({ appEnv: 'prod', now: T0 });
    try {
      await expect(seedDemoOrders(prod.app, prod.clock, T0)).rejects.toThrow('APP_ENV');
      expect(await rows()).toHaveLength(0);
    } finally {
      await prod.app.close();
    }
  });
});
