import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cashChange, Money } from '@coffee/domain';
import { ApiError } from '../../api/client';
import { useStartPayment } from '../../api/hooks';
import { useIdempotencyKey } from '../../api/idempotency';
import type { OrderDto } from '../../api/types';
import { errorMessage } from '../../i18n/error-message';

export function CashPayment({
  order,
  onPendingChange,
}: {
  order: OrderDto;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { t } = useTranslation(['payment', 'error-message-code']);
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const client = useQueryClient();
  const pay = useStartPayment(order.id);
  const idem = useIdempotencyKey();
  const inFlight = useRef(false);
  const { isPending } = pay;

  // Lets the page lock the method switch so this form is not unmounted mid-send.
  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);

  const trimmed = value.trim();
  const change = trimmed === '' ? null : cashChange(Money.of(order.total), trimmed);
  const valid = change?.ok === true;
  const apiError = pay.error instanceof ApiError ? pay.error : pay.error ? new ApiError(0, 'INTERNAL') : null;

  const submit = () => {
    if (!change?.ok || inFlight.current) return;
    inFlight.current = true;
    const body = { method: 'CASH' as const, cashReceived: Money.of(trimmed).toString() };
    pay.mutate(
      { body, idempotencyKey: idem.keyFor(body) },
      {
        onSuccess: () => {
          idem.reset();
          navigate(`/orders/${order.id}/receipt`, { replace: true });
        },
        onError: (e) => {
          // Another terminal may have paid or voided it: refetch so the page redirects to the receipt.
          if (e.code === 'ORDER_NOT_PAYABLE') void client.invalidateQueries({ queryKey: ['order', order.id] });
        },
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="block text-sm font-semibold" htmlFor="cash-received">
        {t('payment:cashReceived')}
      </label>
      <input
        id="cash-received"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        disabled={pay.isPending}
        onChange={(e) => {
          setValue(e.target.value);
          if (!inFlight.current) pay.reset();
        }}
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-lg tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {change && (
        <p
          role={change.ok ? undefined : 'alert'}
          className={change.ok ? 'font-semibold text-accent' : 'text-sm text-danger'}
        >
          {change.ok
            ? t('payment:change', { amount: change.unwrap().format() })
            : change.errors.map((e) => errorMessage(t, e.code, e.params)).join(' ')}
        </p>
      )}
      {apiError && (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(t, apiError.code)}
        </p>
      )}
      <button
        type="submit"
        disabled={!valid || pay.isPending}
        className="w-full rounded-xl bg-accent py-2.5 font-bold text-white hover:bg-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
      >
        {pay.isPending ? t('payment:confirming') : t('payment:confirmCash')}
      </button>
    </form>
  );
}
