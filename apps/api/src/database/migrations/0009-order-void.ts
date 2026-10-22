import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderVoid1760000000009 implements MigrationInterface {
  name = 'OrderVoid1760000000009';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE void_reason AS ENUM ('CUSTOMER_CHANGED_MIND','WRONG_ORDER_ENTRY','OUT_OF_STOCK','CUSTOMER_LEFT_UNPAID','OTHER')`);
    await q.query(`ALTER TABLE orders
      ADD COLUMN voided_at timestamptz NULL,
      ADD COLUMN voided_by_staff_id uuid NULL REFERENCES staff(id),
      ADD COLUMN void_reason_code void_reason NULL,
      ADD COLUMN void_reason_note varchar(200) NULL`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE orders DROP COLUMN void_reason_note, DROP COLUMN void_reason_code, DROP COLUMN voided_by_staff_id, DROP COLUMN voided_at`);
    await q.query('DROP TYPE void_reason');
  }
}
