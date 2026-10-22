import { ExecutionContext, Logger } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ApiException } from '../src/common/api-error';
import { IdempotencyInterceptor } from '../src/idempotency/idempotency.interceptor';

function setup(queryImpl: (sql: string) => Promise<unknown>) {
  const query = jest.fn(queryImpl);
  const interceptor = new IdempotencyInterceptor({ query } as never);
  const req = { headers: { 'idempotency-key': 'k1' }, user: { id: 's1' }, method: 'POST', originalUrl: '/orders', body: {} };
  const res = { statusCode: 201, status: jest.fn() };
  const ctx = { switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as unknown as ExecutionContext;
  return { query, interceptor, ctx };
}

describe('IdempotencyInterceptor error paths', () => {
  beforeEach(() => { jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined); });
  afterEach(() => { jest.restoreAllMocks(); });

  it('returns the body and keeps the key when the COMPLETED update fails', async () => {
    const { query, interceptor, ctx } = setup(async (sql) => {
      if (sql.includes('INSERT')) return [{ key: 'k1' }];
      throw new Error('db down');
    });
    const body = await firstValueFrom(interceptor.intercept(ctx, { handle: () => of({ id: 'o1' }) }));
    expect(body).toEqual({ id: 'o1' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('DELETE'))).toBe(false);
  });

  it('rethrows the original error when the DELETE also fails', async () => {
    const original = new ApiException(400, 'VALIDATION_FAILED');
    const { query, interceptor, ctx } = setup(async (sql) => {
      if (sql.includes('INSERT')) return [{ key: 'k1' }];
      throw new Error('db down');
    });
    await expect(firstValueFrom(interceptor.intercept(ctx, { handle: () => throwError(() => original) }))).rejects.toBe(original);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('DELETE'))).toBe(true);
  });
});
