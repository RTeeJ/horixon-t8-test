import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor';

/** Marks a state-changing route as requiring an Idempotency-Key header (D§5.5). */
export function Idempotent(): MethodDecorator {
  return applyDecorators(UseInterceptors(IdempotencyInterceptor));
}
