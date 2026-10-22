import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { checkVoid, MAX_VOID_NOTE, VOID_REASONS, type VoidReason } from '@coffee/domain';
import { ApiError } from '../../api/client';
import { useVoidOrder } from '../../api/hooks';
import { useIdempotencyKey } from '../../api/idempotency';
import type { OrderSummaryDto } from '../../api/types';
import { errorMessage } from '../../i18n/error-message';

const field =
  'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60';
const btn =
  'rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2';

/**
 * Native modal <dialog> to void a pending order (R§10.2). Mounted only while a row's Void is open.
 * Every exit (Cancel, Esc, backdrop, success) goes through `dialog.close()`; the `close` event
 * then calls `onClose`, which unmounts it. While the void is in flight no exit is allowed.
 */
export function VoidDialog({ order, onClose }: { order: OrderSummaryDto; onClose(): void }) {
  const { t } = useTranslation(['orders', 'void-reason', 'error-message-code']);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [reason, setReason] = useState<VoidReason | ''>('');
  const [note, setNote] = useState('');
  const mutation = useVoidOrder();
  const idem = useIdempotencyKey();
  const inFlight = useRef(false);
  const { isPending } = mutation;

  useEffect(() => {
    // No cleanup: closing here would fire `close` (and onClose) under StrictMode's re-run.
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const checked = reason === '' ? null : checkVoid(reason, note);
  const valid = checked?.ok === true;
  const apiError =
    mutation.error instanceof ApiError ? mutation.error : mutation.error ? new ApiError(0, 'INTERNAL') : null;

  const close = () => ref.current?.close();

  const submit = () => {
    if (!checked?.ok || inFlight.current) return;
    inFlight.current = true;
    const { reasonCode, note: cleanNote } = checked.unwrap();
    const body = cleanNote === null ? { reasonCode } : { reasonCode, note: cleanNote };
    mutation.mutate(
      { orderId: order.id, body, idempotencyKey: idem.keyFor(body) },
      {
        onSuccess: () => {
          idem.reset();
          close();
        },
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  const edited = () => {
    if (!inFlight.current) mutation.reset();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        if (inFlight.current) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !inFlight.current) close();
      }}
      className="m-auto w-[min(440px,92vw)] rounded-2xl bg-surface p-0 text-espresso shadow-card backdrop:bg-espresso/45"
    >
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {t('orders:void.title', { number: order.orderNumber })}
        </h2>

        <div className="space-y-1">
          <label htmlFor="void-reason" className="block text-sm font-semibold">
            {t('orders:void.reason')}
          </label>
          <select
            id="void-reason"
            className={`${field} pr-10`}
            value={reason}
            disabled={isPending}
            onChange={(e) => {
              setReason(e.target.value as VoidReason | '');
              edited();
            }}
          >
            <option value="">{t('orders:void.choose')}</option>
            {VOID_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`void-reason:${r}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="void-note" className="block text-sm font-semibold">
            {reason === 'OTHER' ? t('orders:void.noteRequired') : t('orders:void.noteOptional')}
          </label>
          <textarea
            id="void-note"
            className={field}
            rows={3}
            maxLength={MAX_VOID_NOTE}
            required={reason === 'OTHER'}
            value={note}
            disabled={isPending}
            onChange={(e) => {
              setNote(e.target.value);
              edited();
            }}
          />
        </div>

        {checked && !checked.ok && (
          <p className="text-sm text-danger">
            {checked.errors.map((e) => errorMessage(t, e.code, e.params)).join(' ')}
          </p>
        )}
        {apiError && (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(t, apiError.code)}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={close}
            className={`${btn} border border-line bg-surface hover:bg-cream disabled:opacity-60`}
          >
            {t('orders:void.cancel')}
          </button>
          <button
            type="submit"
            disabled={!valid || isPending}
            className={`${btn} bg-accent text-white enabled:hover:bg-accent-ink disabled:cursor-not-allowed disabled:bg-line disabled:text-muted`}
          >
            {isPending ? t('orders:void.voiding') : t('orders:void.confirm')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
