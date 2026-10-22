import { MigrationInterface, QueryRunner } from 'typeorm';

export class IdempotencyKeys1760000000007 implements MigrationInterface {
  name = 'IdempotencyKeys1760000000007';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE idempotency_keys (
      staff_id uuid NOT NULL REFERENCES staff(id),
      key varchar(100) NOT NULL,
      request_hash char(64) NOT NULL,
      status varchar NOT NULL CHECK (status IN ('IN_PROGRESS','COMPLETED')),
      response_code int NULL,
      response_body jsonb NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (staff_id, key)
    )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE idempotency_keys');
  }
}
