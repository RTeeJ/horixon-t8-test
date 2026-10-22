import { MigrationInterface, QueryRunner } from 'typeorm';

export class Menu1760000000001 implements MigrationInterface {
  name = 'Menu1760000000001';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE menu_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar NOT NULL UNIQUE,
      category varchar NOT NULL CHECK (category IN ('BASE','SIZE','EXTRA','SYRUP','TOPPING')),
      name_en varchar NOT NULL,
      name_th varchar NOT NULL,
      price numeric(12,2) NOT NULL CHECK (price >= 0),
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE menu_items');
  }
}
