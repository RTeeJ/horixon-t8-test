import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppConfig } from './common/config';

/** App-level setup shared by main.ts and the e2e test harness. */
export function configureApp(app: INestApplication, config: AppConfig): void {
  (app as NestExpressApplication).disable('x-powered-by');
  // JSON only: nothing here is meant to load resources or be framed.
  app.use(helmet({
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    xFrameOptions: { action: 'deny' },
  }));
  app.enableCors({ origin: config.webOrigin });
}
