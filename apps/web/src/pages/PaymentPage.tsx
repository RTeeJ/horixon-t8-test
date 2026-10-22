import { useCallback, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Money } from '@coffee/domain';
import { useOrder } from '../api/hooks';
import { errorMessage } from '../i18n/error-message';
import { CashPayment } from '../features/payment/CashPayment';
import { QrPayment } from '../features/payment/QrPayment';

type Method = 'CASH' | 'QR';
const CARD = 'mx-auto my-8 max-w-md rounded-2xl bg-surface p-6 shadow-card';

export function PaymentPage() {
  const { t } = useTranslation(['payment', 'error-message-code']);
  const { id = '' } = useParams();
  const order = useOrder(id);
  const [method, setMethod] = useState<Method>('CASH');
  const [sending, setSending] = useState(false);
  const onPendingChange = useCallback((pending: boolean) => setSending(pending), []);

  if (order.error) {
    return (
      <main className={CARD}>
        <p role="alert" className="text-danger">{errorMessage(t, order.error.code)}</p>
      </main>
    );
  }
  if (!order.data) {
    return (
      <main className={CARD}>
        <p className="text-muted">{t('payment:loading')}</p>
      </main>
    );
  }
  const o = order.data;
  if (o.status !== 'PENDING_PAYMENT') return <Navigate to={`/orders/${o.id}/receipt`} replace />;

  const tab = (m: Method, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={method === m}
      disabled={sending}
      onClick={() => setMethod(m)}
      className={`flex-1 rounded-xl px-4 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 ${
        method === m ? 'bg-accent text-white' : 'border border-line bg-surface hover:bg-cream'
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className={CARD}>
      <h1 className="text-sm font-semibold text-muted">{t('payment:heading')}</h1>
      <p className="mt-2 text-xs text-muted">{t('payment:orderNumber')}</p>
      <p className="text-2xl font-bold">
        <strong>{o.orderNumber}</strong>
      </p>
      <p className="mt-3 text-xs text-muted">{t('payment:total')}</p>
      <p className="text-3xl font-bold tabular-nums text-accent">{Money.of(o.total).format()}</p>
      <div role="tablist" aria-label={t('payment:method')} className="mt-5 flex gap-2">
        {tab('CASH', t('payment:cash'))}
        {tab('QR', t('payment:qr'))}
      </div>
      <div className="mt-4">
        {method === 'CASH' ? <CashPayment order={o} onPendingChange={onPendingChange} /> : <QrPayment order={o} onPendingChange={onPendingChange} />}
      </div>
      <Link
        to="/"
        className="mt-6 inline-block text-sm font-semibold text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {t('payment:payLater')}
      </Link>
    </main>
  );
}
