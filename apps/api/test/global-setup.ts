import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/database/data-source';

// One Postgres container per test run. DATABASE_URL set here is inherited by jest workers.
export default async function globalSetup(): Promise<void> {
  const pg = await new PostgreSqlContainer('postgres:16-alpine').start();
  (globalThis as { __PG__?: unknown }).__PG__ = pg;
  process.env.DATABASE_URL = pg.getConnectionUri();
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
  const ds = new DataSource(buildDataSourceOptions(process.env.DATABASE_URL));
  await ds.initialize();
  await ds.runMigrations();
  await ds.destroy();
}
