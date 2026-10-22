import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { AppModule } from '../../src/app.module';
import { CONFIG } from '../../src/common/config.token';
import { CLOCK, FixedClock } from '../../src/common/clock';
import { loadConfig } from '../../src/common/config';
import { configureApp } from '../../src/configure-app';

export { FixedClock };

export interface TestApp {
  app: INestApplication;
  http: ReturnType<typeof supertest>;
  ds: DataSource;
  clock: FixedClock;
  login(username?: string): Promise<string>;
}

export async function createTestApp(opts: { appEnv?: 'dev' | 'prod'; now?: Date } = {}): Promise<TestApp> {
  const clock = new FixedClock(opts.now ?? new Date('2026-10-21T05:00:00Z'));
  const cfg = { ...loadConfig({ ...process.env, JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret' }), appEnv: opts.appEnv ?? 'dev' };
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK).useValue(clock)
    .overrideProvider(CONFIG).useValue(cfg)
    .compile();
  const app = mod.createNestApplication();
  configureApp(app, cfg);
  await app.init();
  await app.listen(0); // listen once so supertest does not re-listen per request
  const http = supertest(app.getHttpServer());
  return {
    app,
    http,
    ds: app.get(DataSource),
    clock,
    login: async (username = 'cashier1') => {
      const res = await http.post('/auth/login').send({ username, password: 'password123' });
      if (res.status !== 200) throw new Error(`login(${username}) failed with ${res.status}`);
      return res.body.accessToken as string;
    },
  };
}

export async function resetOrders(ds: DataSource): Promise<void> {
  await ds.query('TRUNCATE order_line_items, order_lines, orders, order_number_counters, idempotency_keys, payment_transactions');
}

export function idem(): { 'Idempotency-Key': string } {
  return { 'Idempotency-Key': randomUUID() };
}
