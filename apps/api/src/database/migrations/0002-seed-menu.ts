import { MigrationInterface, QueryRunner } from 'typeorm';

// requirements §4.1; SIZE prices are surcharges; sort_order = row order within category.
const ROWS: [string, string, string, string, string, number][] = [
  ['COFFEE', 'BASE', 'Coffee', 'กาแฟ', '50.00', 1],
  ['TEA', 'BASE', 'Tea', 'ชา', '40.00', 2],
  ['MILK', 'BASE', 'Milk', 'นม', '35.00', 3],
  ['LATTE', 'BASE', 'Latte', 'ลาเต้', '60.00', 4],
  ['SIZE_SMALL', 'SIZE', 'Small', 'แก้วเล็ก', '0.00', 1],
  ['SIZE_MEDIUM', 'SIZE', 'Medium', 'แก้วกลาง', '15.00', 2],
  ['SIZE_LARGE', 'SIZE', 'Large', 'แก้วใหญ่', '30.00', 3],
  ['EXTRA_COFFEE_SHOT', 'EXTRA', 'Extra Coffee Shot', 'เพิ่มช็อตกาแฟ', '20.00', 1],
  ['EXTRA_MILK', 'EXTRA', 'Extra Milk', 'เพิ่มนม', '10.00', 2],
  ['VANILLA', 'SYRUP', 'Vanilla', 'วานิลลา', '10.00', 1],
  ['CARAMEL', 'SYRUP', 'Caramel', 'คาราเมล', '10.00', 2],
  ['CHOCOLATE', 'SYRUP', 'Chocolate', 'ช็อกโกแลต', '10.00', 3],
  ['WHIPPED_CREAM', 'TOPPING', 'Whipped Cream', 'วิปครีม', '15.00', 1],
  ['CINNAMON', 'TOPPING', 'Cinnamon', 'อบเชย', '5.00', 2],
  ['MARSHMALLOWS', 'TOPPING', 'Marshmallows', 'มาร์ชเมลโลว์', '10.00', 3],
];

export class SeedMenu1760000000002 implements MigrationInterface {
  name = 'SeedMenu1760000000002';

  async up(q: QueryRunner): Promise<void> {
    for (const r of ROWS) {
      await q.query(
        'INSERT INTO menu_items (code, category, name_en, name_th, price, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
        r,
      );
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DELETE FROM menu_items WHERE code = ANY($1)', [ROWS.map((r) => r[0])]);
  }
}
