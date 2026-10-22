import { MigrationInterface, QueryRunner } from 'typeorm';

// requirements §4.1 (footnote 1); eight more BASE drinks, sort_order continues after LATTE (4).
const ROWS: [string, string, string, string, string, number][] = [
  ['AMERICANO', 'BASE', 'Americano', 'อเมริกาโน่', '55.00', 5],
  ['ESPRESSO', 'BASE', 'Espresso', 'เอสเปรสโซ่', '45.00', 6],
  ['CAPPUCCINO', 'BASE', 'Cappuccino', 'คาปูชิโน่', '60.00', 7],
  ['MOCHA', 'BASE', 'Mocha', 'มอคค่า', '65.00', 8],
  ['THAI_TEA', 'BASE', 'Thai Tea', 'ชาไทย', '45.00', 9],
  ['LEMON_TEA', 'BASE', 'Lemon Tea', 'ชามะนาว', '40.00', 10],
  ['MATCHA_LATTE', 'BASE', 'Matcha Latte', 'มัทฉะลาเต้', '65.00', 11],
  ['COCOA', 'BASE', 'Cocoa', 'โกโก้', '45.00', 12],
];

export class SeedMoreMenu1760000000006 implements MigrationInterface {
  name = 'SeedMoreMenu1760000000006';

  async up(q: QueryRunner): Promise<void> {
    for (const r of ROWS) {
      await q.query(
        'INSERT INTO menu_items (code, category, name_en, name_th, price, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
        r,
      );
    }
  }

  // Not reversible once an order references one of these drinks (FK violation); deactivate via is_active instead.
  async down(q: QueryRunner): Promise<void> {
    await q.query('DELETE FROM menu_items WHERE code = ANY($1)', [ROWS.map((r) => r[0])]);
  }
}
