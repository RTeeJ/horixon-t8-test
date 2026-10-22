import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { DomainError } from '@coffee/domain';
import { ApiException, ErrorBody } from './api-error';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse();
    const [status, body] = this.map(exception);
    res.status(status).json(body);
  }

  private map(e: unknown): [number, ErrorBody] {
    if (e instanceof ApiException) return [e.getStatus(), e.getResponse() as ErrorBody];
    if (e instanceof UnauthorizedException) return [401, { error: { code: 'UNAUTHORIZED' } }];
    if (e instanceof NotFoundException) return [404, { error: { code: 'NOT_FOUND' } }];
    if (e instanceof BadRequestException) {
      // Malformed JSON and other pipe-less 400s.
      const details: DomainError[] = [{ code: 'INVALID_BODY', params: { field: 'body' } }];
      return [400, { error: { code: 'VALIDATION_FAILED', details } }];
    }
    const status = (e as { status?: unknown } | null)?.status;
    if (!(e instanceof HttpException) && typeof status === 'number' && status >= 400 && status < 500) {
      // Body-parser errors (payload too large, bad encoding, ...) are not Nest exceptions.
      this.logger.warn(`Rejected request body (${status}): ${e instanceof Error ? e.message : String(e)}`);
      const details: DomainError[] = [{ code: 'INVALID_BODY', params: { field: 'body' } }];
      return [400, { error: { code: 'VALIDATION_FAILED', details } }];
    }
    if (e instanceof HttpException && e.getStatus() < 500) {
      this.logger.warn(`Unmapped HTTP exception ${e.getStatus()}: ${e.message}`);
    } else {
      this.logger.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    }
    return [500, { error: { code: 'INTERNAL' } }];
  }
}
