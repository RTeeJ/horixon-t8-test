import { MigrationInterface, QueryRunner } from 'typeorm';

export class Payments1760000000008 implements MigrationInterface {
  name = 'Payments1760000000008';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE payment_method AS ENUM ('QR','CASH','NONE')`);
    await q.query(`CREATE TYPE payment_status AS ENUM ('PENDING','SUCCEEDED','FAILED','EXPIRED')`);
    await q.query(`CREATE TABLE payment_transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES orders(id),
      method payment_method NOT NULL,
      amount numeric(12,2) NOT NULL,
      status payment_status NOT NULL,
      qr_payload text NULL,
      provider_ref varchar NULL,
      cash_received numeric(12,2) NULL,
      change numeric(12,2) NULL,
      processed_by_staff_id uuid NOT NULL REFERENCES staff(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz NULL,
      expires_at timestamptz NULL
    )`);
    await q.query(`CREATE UNIQUE INDEX payment_transactions_one_succeeded ON payment_transactions (order_id) WHERE status = 'SUCCEEDED'`);
    await q.query(`CREATE UNIQUE INDEX payment_transactions_one_pending ON payment_transactions (order_id) WHERE status = 'PENDING'`);
    await q.query(`CREATE INDEX payment_transactions_order_id ON payment_transactions (order_id)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE payment_transactions');
    await q.query('DROP TYPE payment_status');
    await q.query('DROP TYPE payment_method');
  }
}
