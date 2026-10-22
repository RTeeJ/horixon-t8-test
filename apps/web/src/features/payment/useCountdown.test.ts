import { renderHook, act } from '@testing-library/react';
import { useCountdown } from './useCountdown';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-22T10:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts whole seconds left and ticks down', () => {
    const { result } = renderHook(() => useCountdown('2026-10-22T10:05:00.000Z'));
    expect(result.current).toBe(300);
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(result.current).toBe(239);
  });

  it('is 0 for a past time and for null', () => {
    expect(renderHook(() => useCountdown('2026-10-22T09:00:00.000Z')).result.current).toBe(0);
    expect(renderHook(() => useCountdown(null)).result.current).toBe(0);
  });
});
