import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { useMockConfirm, usePayment, useStartPayment } from '../../api/hooks';
import { useIdempotencyKey } from '../../api/idempotency';
import type { OrderDto, TransactionDto } from '../../api/types';
import { errorMessage } from '../../i18n/error-message';
import { useCountdown } from './useCountdown';

const BUTTON =
  'w-full rounded-xl bg-accent py-2.5 font-bold text-white hover:bg-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const toApiError = (e: unknown): ApiError | null =>
  e instanceof ApiError ? e : e ? new ApiError(0, 'INTERNAL') : null;

export function QrPayment({
  order,
  onPendingChange,
}: {
  order: OrderDto;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { t } = useTranslation(['payment', 'error-message-code']);
  const navigate = useNavigate();
  const { appEnv } = useAuth();
  const start = useStartPayment(order.id);
  const confirm = useMockConfirm();
  const startKey = useIdempotencyKey();
  const confirmKey = useIdempotencyKey();
  const inFlight = useRef(false);
  const [started, setStarted] = useState<TransactionDto | null>(null);
  // Local-clock deadline (ms): receipt time + the server's own duration, so terminal clock skew cannot matter.
  const [deadline, setDeadline] = useState<number | null>(null);
  const [confirmExpired, setConfirmExpired] = useState(false);
  const poll = usePayment(started?.id ?? null);

  const pending = start.isPending || confirm.isPending;
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  // The latest poll wins over the transaction returned when the QR was created.
  const tx = poll.data?.transaction ?? started;
  const deadlineIso = useMemo(() => (deadline === null ? null : new Date(deadline).toISOString()), [deadline]);
  const seconds = useCountdown(started ? deadlineIso : null);
  const paid = poll.data?.order.status === 'PAID' || poll.data?.transaction.status === 'SUCCEEDED';

  useEffect(() => {
    if (paid) navigate(`/orders/${order.id}/receipt`, { replace: true });
  }, [paid, navigate, order.id]);

  const expired = tx !== null && (tx.status === 'EXPIRED' || confirmExpired || (tx.status === 'PENDING' && seconds === 0));

  const begin = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const body = { method: 'QR' as const };
    start.mutate(
      { body, idempotencyKey: startKey.keyFor(body) },
      {
        onSuccess: (result) => {
          if (result.order.status === 'PAID') {
            navigate(`/orders/${order.id}/receipt`, { replace: true });
            return;
          }
          const { createdAt, expiresAt } = result.transaction;
          setDeadline(
            expiresAt === null ? null : Date.now() + (new Date(expiresAt).getTime() - new Date(createdAt).getTime()),
          );
          setStarted(result.transaction);
        },
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  // The body never changes, so without reset() the same key would replay the expired QR.
  const newQr = () => {
    startKey.reset();
    confirmKey.reset();
    confirm.reset();
    start.reset();
    setConfirmExpired(false);
    setStarted(null);
    setDeadline(null);
    begin();
  };

  const simulate = () => {
    if (!started || inFlight.current) return;
    inFlight.current = true;
    confirm.mutate(
      { txId: started.id, idempotencyKey: confirmKey.keyFor({ txId: started.id }) },
      {
        onSuccess: () => {
          confirmKey.reset();
          navigate(`/orders/${order.id}/receipt`, { replace: true });
        },
        onError: (e) => {
          if (e.code === 'PAYMENT_EXPIRED') setConfirmExpired(true);
        },
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  if (!tx) {
    const err = toApiError(start.error);
    return (
      <div className="space-y-3">
        <button type="button" className={BUTTON} disabled={start.isPending} onClick={begin}>
          {start.isPending ? t('payment:creatingQr') : t('payment:showQr')}
        </button>
        {err && (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(t, err.code)}
          </p>
        )}
      </div>
    );
  }

  if (expired) {
    const err = toApiError(start.error);
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-danger">
          {errorMessage(t, 'PAYMENT_EXPIRED')}
        </p>
        <button type="button" className={BUTTON} disabled={start.isPending} onClick={newQr}>
          {start.isPending ? t('payment:creatingQr') : t('payment:newQr')}
        </button>
        {err && (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(t, err.code)}
          </p>
        )}
      </div>
    );
  }

  const confirmErr = confirm.error && confirm.error.code !== 'PAYMENT_EXPIRED' ? toApiError(confirm.error) : null;
  return (
    <div className="space-y-3 text-center">
      <p className="text-sm text-muted">{t('payment:scanToPay')}</p>
      <div className="inline-block rounded-xl bg-white p-3">
        <QRCodeSVG value={tx.qrPayload ?? ''} size={192} />
      </div>
      <p className="text-sm text-muted">
        {t('payment:expiresIn')} <span className="text-lg font-bold tabular-nums text-ink">{clock(seconds)}</span>
      </p>
      {confirmErr && (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(t, confirmErr.code)}
        </p>
      )}
      {appEnv === 'dev' && (
        <button type="button" className={BUTTON} disabled={confirm.isPending} onClick={simulate}>
          {t('payment:simulatePaid')}
        </button>
      )}
    </div>
  );
}
