import { useEffect, useState } from 'react';

const secondsLeft = (expiresAt: string | null, now: number): number =>
  expiresAt === null ? 0 : Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));

/** Whole seconds until `expiresAt`, ticking each second, never below 0 (0 when null). */
export function useCountdown(expiresAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (expiresAt === null) return;
    setNow(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (secondsLeft(expiresAt, t) === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  // Derived during render, so a new expiresAt is correct on its very first render.
  return secondsLeft(expiresAt, now);
}
