import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './common/config';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const config = loadConfig(); // fail fast on bad env
  const app = await NestFactory.create(AppModule);
  configureApp(app, config);
  await app.listen(Number(process.env.PORT ?? 3000));
}
void bootstrap();
