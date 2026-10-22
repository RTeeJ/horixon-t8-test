import { HttpException } from '@nestjs/common';
import type { DomainError, ErrorCode } from '@coffee/domain';

export interface ErrorBody {
  error: { code: ErrorCode; details?: DomainError[] };
}

export class ApiException extends HttpException {
  constructor(status: number, code: ErrorCode, details?: DomainError[]) {
    const body: ErrorBody = { error: details ? { code, details } : { code } };
    super(body, status);
  }
}
