import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { businessDate, historyDates } from '@coffee/domain';
import type { OrderFilters } from '../../api/hooks';

const STATUSES = ['PENDING_PAYMENT', 'PAID', 'VOIDED'] as const;
// NONE (free orders) is left out until free orders exist (R§13.3); the API still accepts it.
export const FILTER_METHODS = ['QR', 'CASH'] as const;

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | 'ALL' {
  return allowed.find((a) => a === value) ?? 'ALL';
}

/** Filters live in the URL search params so a receipt's Back button returns to the same list. */
export function useOrderFilters(): [OrderFilters, (patch: Partial<OrderFilters>) => void] {
  const [params, setParams] = useSearchParams();
  const rawDate = params.get('date');
  const status = params.get('status');
  const method = params.get('method');
  const sort = params.get('sort');

  const filters = useMemo<OrderFilters>(() => {
    const today = businessDate(new Date());
    return {
      date: rawDate && historyDates(today).includes(rawDate) ? rawDate : today,
      status: pick(status, STATUSES),
      method: pick(method, FILTER_METHODS),
      sort: sort === 'asc' ? 'asc' : 'desc',
    };
  }, [rawDate, status, method, sort]);

  const update = useCallback(
    (patch: Partial<OrderFilters>) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined) continue;
          const isDefault = v === 'ALL' || (k === 'sort' && v === 'desc');
          if (isDefault) next.delete(k);
          else next.set(k, v);
        }
        return next;
      });
    },
    [setParams],
  );

  return [filters, update];
}
