import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CLOCK, FixedClock } from '../common/clock';
import { loadConfig } from '../common/config';
import { CONFIG } from '../common/config.token';
import { buildDataSourceOptions } from '../database/data-source';
import { PaymentModule } from '../payment/payment.module';
import { seedDemoOrders } from './demo-orders';

// `npm run seed:demo`: adds the demo orders (R§10.3, D§5.7).

const clock = new FixedClock(new Date());

/** Stands in for CommonModule: same CONFIG, but a clock the seed can move. */
@Global()
@Module({
  providers: [
    { provide: CONFIG, useFactory: () => loadConfig() },
    { provide: CLOCK, useValue: clock },
  ],
  exports: [CONFIG, CLOCK],
})
class SeedCommonModule {}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => buildDataSourceOptions(loadConfig().databaseUrl) }),
    SeedCommonModule,
    PaymentModule, // brings OrderModule, MenuModule and DiscountModule
  ],
})
class SeedDemoModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedDemoModule, { logger: ['error', 'warn'] });
  try {
    const result = await seedDemoOrders(app, clock, new Date());
    console.log(result.skipped ? 'Orders already exist; no demo orders added.' : `Added ${result.created} demo orders.`);
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
