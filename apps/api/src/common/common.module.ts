import { Global, Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { CONFIG } from './config.token';
import { loadConfig } from './config';
import { CLOCK, SystemClock } from './clock';
import { createValidationPipe } from './validation';

@Global()
@Module({
  providers: [
    { provide: CONFIG, useFactory: () => loadConfig() },
    { provide: CLOCK, useClass: SystemClock },
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
  exports: [CONFIG, CLOCK],
})
export class CommonModule {}
