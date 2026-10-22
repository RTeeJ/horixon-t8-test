import { hash } from 'bcrypt';
import { MigrationInterface, QueryRunner } from 'typeorm';

// requirements §12: demo accounts; the password is hashed here, never stored in plain text.
const STAFF: [string, string][] = [
  ['cashier1', 'Cashier 1'],
  ['cashier2', 'Cashier 2'],
];
const DEMO_PASSWORD = 'password123';

export class SeedStaff1760000000004 implements MigrationInterface {
  name = 'SeedStaff1760000000004';

  async up(q: QueryRunner): Promise<void> {
    for (const [username, displayName] of STAFF) {
      await q.query('INSERT INTO staff (username, display_name, password_hash) VALUES ($1,$2,$3)', [
        username, displayName, await hash(DEMO_PASSWORD, 10),
      ]);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DELETE FROM staff WHERE username = ANY($1)', [STAFF.map((s) => s[0])]);
  }
}
