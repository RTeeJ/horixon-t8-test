import { MigrationInterface, QueryRunner } from 'typeorm';

export class Orders1760000000005 implements MigrationInterface {
  name = 'Orders1760000000005';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE order_status AS ENUM ('PENDING_PAYMENT','PAID','VOIDED')`);
    await q.query(`CREATE TABLE order_number_counters (
      business_date date PRIMARY KEY,
      last_value int NOT NULL
    )`);
    await q.query(`CREATE TABLE orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_number varchar NOT NULL UNIQUE,
      business_date date NOT NULL,
      status order_status NOT NULL DEFAULT 'PENDING_PAYMENT',
      created_by_staff_id uuid NOT NULL REFERENCES staff(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      subtotal numeric(12,2) NOT NULL,
      total numeric(12,2) NOT NULL,
      vat_rate_bps int NOT NULL,
      vat numeric(12,2) NOT NULL,
      before_vat numeric(12,2) NOT NULL
    )`);
    await q.query('CREATE INDEX orders_business_date_status_idx ON orders (business_date, status)');
    await q.query('CREATE INDEX orders_created_at_idx ON orders (created_at)');
    await q.query(`CREATE TABLE order_lines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES orders(id),
      line_no int NOT NULL,
      quantity int NOT NULL,
      unit_price numeric(12,2) NOT NULL,
      line_total numeric(12,2) NOT NULL,
      description_en varchar NOT NULL,
      description_th varchar NOT NULL
    )`);
    await q.query('CREATE INDEX order_lines_order_id_idx ON order_lines (order_id)');
    await q.query(`CREATE TABLE order_line_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_line_id uuid NOT NULL REFERENCES order_lines(id),
      menu_item_id uuid NOT NULL REFERENCES menu_items(id),
      code varchar NOT NULL,
      category varchar NOT NULL,
      name_en varchar NOT NULL,
      name_th varchar NOT NULL,
      unit_price numeric(12,2) NOT NULL,
      count int NOT NULL,
      position int NOT NULL
    )`);
    await q.query('CREATE INDEX order_line_items_line_idx ON order_line_items (order_line_id)');
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE order_line_items');
    await q.query('DROP TABLE order_lines');
    await q.query('DROP TABLE orders');
    await q.query('DROP TABLE order_number_counters');
    await q.query('DROP TYPE order_status');
  }
}
