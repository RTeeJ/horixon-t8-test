import { MigrationInterface, QueryRunner } from 'typeorm';

export class Staff1760000000003 implements MigrationInterface {
  name = 'Staff1760000000003';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE staff (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username varchar NOT NULL UNIQUE,
      display_name varchar NOT NULL,
      password_hash varchar NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE staff');
  }
}
