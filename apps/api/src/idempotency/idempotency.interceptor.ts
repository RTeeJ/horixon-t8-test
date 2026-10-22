import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Observable, catchError, from, mergeMap, of, throwError } from 'rxjs';
import { DataSource } from 'typeorm';
import { ApiException } from '../common/api-error';

const HEADER = 'idempotency-key';
const MAX_KEY_LENGTH = 100;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly log = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly ds: DataSource) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = ctx.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const raw = req.headers[HEADER];
    const key = typeof raw === 'string' ? raw : '';
    if (key.length === 0 || key.length > MAX_KEY_LENGTH) {
      throw new ApiException(400, 'VALIDATION_FAILED', [{ code: 'INVALID_BODY', params: { field: 'Idempotency-Key' } }]);
    }
    const staffId: string = req.user.id;
    const hash = createHash('sha256')
      .update(`${req.method} ${req.originalUrl}\n${JSON.stringify(req.body ?? null)}`)
      .digest('hex');

    return from(this.claim(staffId, key, hash)).pipe(
      mergeMap((replay) => {
        if (replay) {
          res.status(replay.code);
          return of(replay.body);
        }
        return next.handle().pipe(
          // Only handler/pipe failures release the key; the action did not happen, so a retry is safe.
          catchError((err) => from(this.release(staffId, key)).pipe(mergeMap(() => throwError(() => err)))),
          // The action succeeded: a failed bookkeeping UPDATE must not fail the response nor free the key.
          mergeMap((body) => from(this.complete(staffId, key, res.statusCode, body)).pipe(mergeMap(() => of(body)))),
        );
      }),
    );
  }

  /** Returns null when this request owns the key; the stored response when it is a replay; throws otherwise. */
  private async claim(staffId: string, key: string, hash: string): Promise<{ code: number; body: unknown } | null> {
    const inserted = await this.ds.query(
      `INSERT INTO idempotency_keys (staff_id, key, request_hash, status) VALUES ($1, $2, $3, 'IN_PROGRESS')
       ON CONFLICT DO NOTHING RETURNING key`,
      [staffId, key, hash],
    );
    if (inserted.length > 0) return null;
    const [row] = await this.ds.query(
      'SELECT request_hash, status, response_code, response_body FROM idempotency_keys WHERE staff_id = $1 AND key = $2',
      [staffId, key],
    );
    // Row deleted between INSERT and SELECT (the other request failed): treat as still in progress, client retries.
    if (!row) throw new ApiException(409, 'IDEMPOTENCY_IN_PROGRESS');
    if (row.request_hash !== hash) throw new ApiException(422, 'IDEMPOTENCY_KEY_REUSED');
    if (row.status === 'IN_PROGRESS') throw new ApiException(409, 'IDEMPOTENCY_IN_PROGRESS');
    return { code: row.response_code, body: row.response_body };
  }

  private async complete(staffId: string, key: string, code: number, body: unknown): Promise<void> {
    try {
      await this.ds.query(
        `UPDATE idempotency_keys SET status = 'COMPLETED', response_code = $3, response_body = $4::jsonb
         WHERE staff_id = $1 AND key = $2`,
        [staffId, key, code, JSON.stringify(body ?? null)],
      );
    } catch (err) {
      // Row stays IN_PROGRESS: a retry gets 409 instead of creating a duplicate.
      this.log.error(`Failed to complete idempotency key ${key}: ${String(err)}`);
    }
  }

  private async release(staffId: string, key: string): Promise<void> {
    try {
      await this.ds.query('DELETE FROM idempotency_keys WHERE staff_id = $1 AND key = $2', [staffId, key]);
    } catch (err) {
      // Swallow: the caller rethrows the original handler error, which must not be replaced.
      this.log.error(`Failed to release idempotency key ${key}: ${String(err)}`);
    }
  }
}
