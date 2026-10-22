import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Money } from '@coffee/domain';
import { useOrder } from '../api/hooks';
import { StatusPill } from '../components/StatusPill';
import { errorMessage } from '../i18n/error-message';

export function ReceiptPage() {
  const { t, i18n } = useTranslation(['receipt', 'common', 'button', 'void-reason']);
  const { id = '' } = useParams();
  const order = useOrder(id);
  const lang = i18n.language === 'th' ? 'th' : 'en';

  if (order.error) {
    return (
      <main className="mx-auto my-8 max-w-md rounded-2xl bg-surface p-6 shadow-card print:my-0 print:max-w-none print:bg-transparent print:p-0 print:text-black print:shadow-none">
        <p role="alert" className="text-danger print:text-black">{errorMessage(t, order.error.code)}</p>
      </main>
    );
  }
  if (!order.data) {
    return (
      <main className="mx-auto my-8 max-w-md rounded-2xl bg-surface p-6 shadow-card print:my-0 print:max-w-none print:bg-transparent print:p-0 print:text-black print:shadow-none">
        <p className="text-muted print:text-black">{t('receipt:loading')}</p>
      </main>
    );
  }

  const o = order.data;
  const money = (s: string) => Money.of(s).format();
  const when = new Intl.DateTimeFormat(lang, {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(o.createdAt));
  const rate = String(o.vatRateBps / 100);
  const paid = o.transactions.find((x) => x.status === 'SUCCEEDED');
  const statusKey = `receipt:status.${o.status}`;

  return (
    <main className="mx-auto my-8 max-w-md rounded-2xl bg-surface p-6 shadow-card print:my-0 print:max-w-none print:bg-transparent print:p-0 print:text-black print:shadow-none">
      <h1 className="text-sm font-semibold text-muted print:text-black">{t('common:receipt.heading')}</h1>
      <div className="mt-2">
        <p className="text-xs text-muted print:text-black">{t('receipt:orderNumber')}</p>
        <p className="text-2xl font-bold">
          <strong>{o.orderNumber}</strong>
        </p>
      </div>
      <div className="mt-2 space-y-0.5 text-sm text-muted print:text-black">
        <p>{when}</p>
        <p>{t('receipt:staff', { name: o.createdBy.displayName })}</p>
      </div>
      <p className="mt-3">
        <StatusPill
          status={o.status}
          label={i18n.exists(statusKey) ? t(statusKey) : o.status}
          className="print:bg-transparent print:px-0 print:text-black"
        />
      </p>
      <hr className="my-4 border-dashed border-line print:border-black" />
      <ul className="space-y-2">
        {o.lines.map((l, i) => {
          const desc = lang === 'th' ? l.descriptionTh : l.descriptionEn;
          const label =
            l.quantity > 1
              ? `${l.quantity} × ${desc} @ ${money(l.unitPrice)}`
              : `${l.quantity} × ${desc}`;
          return (
            <li key={i} className="flex justify-between gap-4">
              <span className="break-words">{label}</span>
              <span className="tabular-nums">{money(l.lineTotal)}</span>
            </li>
          );
        })}
      </ul>
      <hr className="my-4 border-dashed border-line print:border-black" />
      <div className="space-y-1">
        <Row label={t('receipt:subtotal')} value={money(o.subtotal)} />
        {o.discount && (
          <Row
            label={t('receipt:discount', { name: lang === 'th' ? o.discount.nameTh : o.discount.nameEn })}
            value={`−${money(o.discount.amount)}`}
          />
        )}
        <Row label={t('receipt:grandTotal')} value={money(o.total)} strong />
        <Row label={t('receipt:beforeVat')} value={money(o.beforeVat)} />
        <Row label={t('receipt:vat', { rate })} value={money(o.vat)} />
      </div>
      {paid && (
        <div className="mt-3 flex flex-wrap gap-x-4 text-sm">
          <span>{t(`receipt:payment.${paid.method.toLowerCase()}`)}</span>
          {paid.method === 'CASH' && paid.cashReceived !== null && (
            <span>{t('receipt:payment.received', { amount: money(paid.cashReceived) })}</span>
          )}
          {paid.method === 'CASH' && paid.change !== null && (
            <span>{t('receipt:payment.change', { amount: money(paid.change) })}</span>
          )}
        </div>
      )}
      {o.voided && (
        <p className="mt-3 text-sm">
          {o.voided.note
            ? t('receipt:voidReason', { reason: t(`void-reason:${o.voided.reasonCode}`), note: o.voided.note })
            : t(`void-reason:${o.voided.reasonCode}`)}
        </p>
      )}
      <div className="mt-6 flex gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 font-semibold hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Printer size={18} aria-hidden="true" />
          {t('button:print')}
        </button>
        {o.status === 'PENDING_PAYMENT' && (
          <Link
            to={`/orders/${o.id}/pay`}
            className="inline-flex items-center rounded-xl border border-line bg-surface px-4 py-2 font-semibold hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent print:hidden"
          >
            {t('receipt:takePayment')}
          </Link>
        )}
        <Link
          to="/"
          className="inline-flex items-center rounded-xl bg-accent px-4 py-2 font-semibold text-white hover:bg-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {t('button:newOrder')}
        </Link>
      </div>
    </main>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'font-bold' : 'text-sm text-muted print:text-black'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
