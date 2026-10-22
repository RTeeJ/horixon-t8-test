import { useCallback, useRef } from 'react';

/**
 * One Idempotency-Key per logical request (D§5.5). The same key is returned while
 * the body is unchanged, so a retry replays instead of duplicating; call `reset()` on success.
 */
export function useIdempotencyKey(): { keyFor(body: unknown): string; reset(): void } {
  const current = useRef<{ body: string; key: string } | null>(null);
  const keyFor = useCallback((body: unknown) => {
    const serialized = JSON.stringify(body);
    if (current.current?.body !== serialized) {
      current.current = { body: serialized, key: crypto.randomUUID() };
    }
    return current.current.key;
  }, []);
  const reset = useCallback(() => {
    current.current = null;
  }, []);
  return { keyFor, reset };
}
