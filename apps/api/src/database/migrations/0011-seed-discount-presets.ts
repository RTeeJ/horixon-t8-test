import { MigrationInterface, QueryRunner } from 'typeorm';

// requirements §9.1: exactly three presets. [code, nameEn, nameTh, type, value, minSubtotal, sortOrder]
const ROWS: [string, string, string, string, string, string | null, number][] = [
  ['STAFF_15', 'Staff discount 15%', 'ส่วนลดพนักงาน 15%', 'PERCENT', '15.00', null, 1],
  ['PROMO_10_PERCENT', 'Promotion 10%', 'โปรโมชัน ลด 10%', 'PERCENT', '10.00', '100.00', 2],
  ['PROMO_30_BAHT', 'Promotion ฿30', 'โปรโมชัน ลด ฿30', 'AMOUNT', '30.00', '200.00', 3],
];

export class SeedDiscountPresets1760000000011 implements MigrationInterface {
  name = 'SeedDiscountPresets1760000000011';

  async up(q: QueryRunner): Promise<void> {
    for (const r of ROWS) {
      await q.query(
        'INSERT INTO discount_presets (code, name_en, name_th, type, value, min_subtotal, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        r,
      );
    }
  }

  // Not reversible once an order references a preset (FK violation); deactivate via is_active instead.
  async down(q: QueryRunner): Promise<void> {
    await q.query('DELETE FROM discount_presets WHERE code = ANY($1)', [ROWS.map((r) => r[0])]);
  }
}
