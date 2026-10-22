import { INestApplicationContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { addDays, businessDate, LineInput, Money, ORDER_HISTORY_DAYS, OrderInput, VoidReason } from '@coffee/domain';
import { StaffEntity } from '../auth/staff.entity';
import { FixedClock } from '../common/clock';
import { CONFIG } from '../common/config.token';
import type { AppConfig } from '../common/config';
import { OrderEntity } from '../order/order.entity';
import { OrderService } from '../order/order.service';
import { PaymentService } from '../payment/payment.service';

// Sample orders for a fresh dev database (R§10.3, D§5.7).

type Outcome = 'CASH' | 'QR' | 'PENDING' | { void: VoidReason; note?: string };

interface DemoOrder {
  staff: 'cashier1' | 'cashier2';
  input: OrderInput;
  outcome: Outcome;
}

interface Slot {
  at: Date;
  settleAt: Date;
  order: DemoOrder;
}

export interface DemoSeedResult {
  created: number;
  skipped: boolean;
}

function drink(base: string, size: string, addOns: Record<string, number> = {}, quantity = 1): LineInput {
  return { base, size, addOns: Object.entries(addOns).map(([code, count]) => ({ code, count })), quantity };
}

// Carts, with the preset each one qualifies for (R§9.1 minimum spend).
const CARTS: OrderInput[] = [
  { lines: [drink('COFFEE', 'SIZE_LARGE', { VANILLA: 2, WHIPPED_CREAM: 1 })] },                                   // 115.00
  { lines: [drink('LATTE', 'SIZE_MEDIUM', {}, 2)], discount: { presetCode: 'PROMO_10_PERCENT' } },                 // 150.00
  { lines: [drink('THAI_TEA', 'SIZE_MEDIUM'), drink('MATCHA_LATTE', 'SIZE_LARGE', { WHIPPED_CREAM: 1 })],
    discount: { presetCode: 'STAFF_15' } },                                                                       // 170.00
  { lines: [drink('ESPRESSO', 'SIZE_SMALL', { EXTRA_COFFEE_SHOT: 1 })] },                                         // 65.00
  { lines: [drink('MOCHA', 'SIZE_MEDIUM', {}, 3)], discount: { presetCode: 'PROMO_30_BAHT' } },                    // 240.00
  { lines: [drink('COCOA', 'SIZE_MEDIUM', { MARSHMALLOWS: 1 })] },                                                // 70.00
  { lines: [drink('AMERICANO', 'SIZE_MEDIUM'), drink('LEMON_TEA', 'SIZE_SMALL')] },                               // 110.00
  { lines: [drink('CAPPUCCINO', 'SIZE_LARGE', { CARAMEL: 1, CINNAMON: 1 }, 2)] },                                 // 210.00
  { lines: [drink('MILK', 'SIZE_SMALL', { CHOCOLATE: 1, MARSHMALLOWS: 1 })] },                                    // 55.00
];

// Today shows every state, so the Orders page has something to pay and something already voided.
const TODAY: DemoOrder[] = [
  { staff: 'cashier1', input: CARTS[0], outcome: 'CASH' },
  { staff: 'cashier2', input: CARTS[1], outcome: 'QR' },
  { staff: 'cashier1', input: CARTS[2], outcome: 'CASH' },
  { staff: 'cashier2', input: CARTS[3], outcome: { void: 'CUSTOMER_CHANGED_MIND' } },
  { staff: 'cashier1', input: CARTS[4], outcome: 'PENDING' },
  { staff: 'cashier2', input: CARTS[5], outcome: 'PENDING' },
];

/** Bangkok times of the orders on each past day. */
const PAST_TIMES = ['08:10', '10:35', '13:20', '16:45'];

/** The last order of these past days (days ago → reason) was voided. */
const PAST_VOIDS: Record<number, { void: VoidReason; note?: string }> = {
  1: { void: 'WRONG_ORDER_ENTRY' },
  3: { void: 'OUT_OF_STOCK' },
  5: { void: 'CUSTOMER_LEFT_UNPAID' },
  7: { void: 'OTHER', note: 'Drink spilled before handover' },
};

const TODAY_STEP_MS = 20 * 60_000;
const SETTLE_DELAY_MS = 45_000;

function pastDay(daysAgo: number): DemoOrder[] {
  return PAST_TIMES.map((_, i) => {
    const voided = i === PAST_TIMES.length - 1 ? PAST_VOIDS[daysAgo] : undefined;
    return {
      staff: (daysAgo + i) % 2 === 0 ? 'cashier1' : 'cashier2',
      input: CARTS[(daysAgo * PAST_TIMES.length + i) % CARTS.length],
      outcome: voided ?? (i % 2 === 0 ? 'CASH' : 'QR'),
    };
  });
}

/** Every demo order with its time, oldest first. Today's orders end before `now` and start after Bangkok midnight. */
function schedule(now: Date): Slot[] {
  const today = businessDate(now);
  const slots: Slot[] = [];
  for (let daysAgo = ORDER_HISTORY_DAYS; daysAgo >= 1; daysAgo--) {
    const date = addDays(today, -daysAgo);
    pastDay(daysAgo).forEach((order, i) => {
      const at = new Date(`${date}T${PAST_TIMES[i]}:00+07:00`);
      slots.push({ at, settleAt: new Date(at.getTime() + SETTLE_DELAY_MS), order });
    });
  }
  const midnight = new Date(`${today}T00:00:00+07:00`).getTime();
  const step = Math.min(TODAY_STEP_MS, (now.getTime() - midnight) / (TODAY.length + 1));
  TODAY.forEach((order, i) => {
    const at = now.getTime() - (TODAY.length - i) * step;
    slots.push({ at: new Date(at), settleAt: new Date(at + Math.min(SETTLE_DELAY_MS, step / 2)), order });
  });
  return slots;
}

/** Cash handed over: the total rounded up to the next 100 baht, so most orders get change. */
function cashFor(total: string): string {
  return Money.fromSatang(Math.ceil(Money.of(total).toSatang() / 10_000) * 10_000).toString();
}

/**
 * Places the demo orders through the real services, moving `clock` to each order's time.
 * Dev only; adds nothing if any order exists. The clock is set back to `now` at the end.
 */
export async function seedDemoOrders(app: INestApplicationContext, clock: FixedClock, now: Date): Promise<DemoSeedResult> {
  if (app.get<AppConfig>(CONFIG).appEnv !== 'dev') throw new Error('Demo orders are dev-only: set APP_ENV=dev');
  const ds = app.get(DataSource);
  if (await ds.getRepository(OrderEntity).exists()) return { created: 0, skipped: true };

  const staffIds = new Map((await ds.getRepository(StaffEntity).find()).map((s) => [s.username, s.id]));
  const orders = app.get(OrderService);
  const payments = app.get(PaymentService);

  let created = 0;
  try {
    for (const { at, settleAt, order } of schedule(now)) {
      const staffId = staffIds.get(order.staff);
      if (!staffId) throw new Error(`Demo staff "${order.staff}" not found; run the migrations first`);
      clock.set(at);
      const placed = await orders.place(staffId, order.input);
      created++;
      clock.set(settleAt);
      const { outcome } = order;
      if (outcome === 'CASH') {
        await payments.start(staffId, placed.id, { method: 'CASH', cashReceived: cashFor(placed.total) });
      } else if (outcome === 'QR') {
        const { transaction } = await payments.start(staffId, placed.id, { method: 'QR' });
        await payments.mockConfirm(transaction.id);
      } else if (outcome !== 'PENDING') {
        await orders.void(staffId, placed.id, { reasonCode: outcome.void, note: outcome.note });
      }
    }
  } finally {
    clock.set(now);
  }
  return { created, skipped: false };
}
