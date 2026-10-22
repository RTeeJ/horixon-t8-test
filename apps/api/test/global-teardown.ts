import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

export default async function globalTeardown(): Promise<void> {
  const pg = (globalThis as { __PG__?: StartedPostgreSqlContainer }).__PG__;
  if (pg) await pg.stop();
}
