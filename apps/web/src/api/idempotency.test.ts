import { renderHook } from '@testing-library/react';
import { useIdempotencyKey } from './idempotency';

describe('useIdempotencyKey', () => {
  it('returns the same key for an unchanged body', () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const a = result.current.keyFor({ method: 'CASH', cashReceived: '250.00' });
    expect(result.current.keyFor({ method: 'CASH', cashReceived: '250.00' })).toBe(a);
  });

  it('returns a new key when the body changes', () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const a = result.current.keyFor({ n: 1 });
    expect(result.current.keyFor({ n: 2 })).not.toBe(a);
  });

  it('returns a new key after reset()', () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const a = result.current.keyFor({ n: 1 });
    result.current.reset();
    expect(result.current.keyFor({ n: 1 })).not.toBe(a);
  });
});
