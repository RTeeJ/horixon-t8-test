import { ValidationPipe, ValidationError } from '@nestjs/common';
import type { DomainError } from '@coffee/domain';
import { ApiException } from './api-error';

function fields(errors: ValidationError[], prefix = ''): string[] {
  return errors.flatMap((e) => {
    const path = prefix ? `${prefix}.${e.property}` : e.property;
    return e.children?.length ? fields(e.children, path) : [path];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      const details: DomainError[] = [...new Set(fields(errors))].map((field) => ({ code: 'INVALID_BODY', params: { field } }));
      return new ApiException(400, 'VALIDATION_FAILED', details);
    },
  });
}
