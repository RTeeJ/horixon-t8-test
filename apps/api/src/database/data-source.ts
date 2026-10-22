import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'node:path';

export function buildDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    // Concurrent order placement holds one connection per in-flight transaction.
    extra: { max: 20 },
    synchronize: false,
    migrationsRun: false,
  };
}

// Used by the TypeORM CLI: typeorm -d dist/database/data-source.js migration:run
export default new DataSource(buildDataSourceOptions(process.env.DATABASE_URL ?? ''));
