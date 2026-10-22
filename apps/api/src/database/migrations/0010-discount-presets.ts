import { MigrationInterface, QueryRunner } from 'typeorm';

// requirements §9, design §4.4: preset table, immutability trigger, and the two order columns.
export class DiscountPresets1760000000010 implements MigrationInterface {
  name = 'DiscountPresets1760000000010';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE discount_type AS ENUM ('PERCENT','AMOUNT')`);
    await q.query(`CREATE TABLE discount_presets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar NOT NULL UNIQUE,
      name_en varchar NOT NULL,
      name_th varchar NOT NULL,
      type discount_type NOT NULL,
      value numeric(12,2) NOT NULL CHECK (value > 0 AND (type <> 'PERCENT' OR value <= 100)),
      min_subtotal numeric(12,2) NULL,
      is_active boolean NOT NULL DEFAULT true,
      sort_order int NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE FUNCTION discount_presets_immutable() RETURNS trigger AS $$
      BEGIN
        IF NEW.type IS DISTINCT FROM OLD.type OR NEW.value IS DISTINCT FROM OLD.value THEN
          RAISE EXCEPTION 'discount preset type and value are immutable';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql`);
    await q.query(`CREATE TRIGGER discount_presets_immutable_trg BEFORE UPDATE ON discount_presets
      FOR EACH ROW EXECUTE FUNCTION discount_presets_immutable()`);
    await q.query(`ALTER TABLE orders
      ADD COLUMN discount_preset_id uuid NULL REFERENCES discount_presets(id),
      ADD COLUMN discount_amount numeric(12,2) NOT NULL DEFAULT 0`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE orders DROP COLUMN discount_amount, DROP COLUMN discount_preset_id');
    await q.query('DROP TRIGGER discount_presets_immutable_trg ON discount_presets');
    await q.query('DROP FUNCTION discount_presets_immutable()');
    await q.query('DROP TABLE discount_presets');
    await q.query('DROP TYPE discount_type');
  }
}
