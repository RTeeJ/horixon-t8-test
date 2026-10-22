import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { businessDate, historyDates, Money } from '@coffee/domain';
import { useOrders, type OrderFilters } from '../api/hooks';
import type { OrderSummaryDto } from '../api/types';
import { StatusPill } from '../components/StatusPill';
import { VoidDialog } from '../features/orders/VoidDialog';
import { FILTER_METHODS, useOrderFilters } from '../features/orders/useOrderFilters';
import { errorMessage } from '../i18n/error-message';

const selectClass =
  'rounded-lg border border-line bg-surface py-1.5 pl-3 pr-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const linkClass =
  'inline-flex items-center rounded-lg border border-line bg-surface px-3 py-1 text-sm font-semibold hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function OrdersPage() {
  const { t, i18n } = useTranslation(['orders', 'receipt', 'common']);
  const lang = i18n.language === 'th' ? 'th' : 'en';
  const [filters, setFilters] = useOrderFilters();
  const orders = useOrders(filters);
  // Lives here, not in the row: a refetch after the void drops the row's Void button and must not unmount the dialog.
  const [voiding, setVoiding] = useState<OrderSummaryDto | null>(null);

  return (
    <main className="mx-auto my-8 max-w-5xl px-6">
      <h1 className="text-2xl font-bold">{t('orders:heading')}</h1>
      <Filters filters={filters} onChange={setFilters} lang={lang} />
      {orders.error ? (
        <p role="alert" className="mt-6 text-danger">
          {errorMessage(t, orders.error.code)}
        </p>
      ) : !orders.data ? (
        <p className="mt-6 text-muted">{t('orders:loading')}</p>
      ) : orders.data.length === 0 ? (
        <p className="mt-6 text-muted">{t('orders:empty')}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                {(['order', 'time', 'staff', 'total', 'status', 'method', 'actions'] as const).map((c) => (
                  <th key={c} scope="col" className="px-4 py-3 font-medium">
                    {t(`orders:columns.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.data.map((o) => (
                <OrderRow key={o.id} order={o} onVoid={setVoiding} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {voiding && <VoidDialog order={voiding} onClose={() => setVoiding(null)} />}
    </main>
  );
}

function Filters({
  filters,
  onChange,
  lang,
}: {
  filters: OrderFilters;
  onChange: (patch: Partial<OrderFilters>) => void;
  lang: 'en' | 'th';
}) {
  const { t } = useTranslation(['orders', 'receipt']);
  const today = businessDate(new Date());
  const dates = historyDates(today);
  // The strings are already Bangkok dates, so format them as UTC midnight to keep the day unchanged.
  const fmt = new Intl.DateTimeFormat(lang, { timeZone: 'UTC', day: 'numeric', month: 'short' });
  const dateLabel = (d: string, i: number) =>
    i === 0 ? t('orders:filters.today') : i === 1 ? t('orders:filters.yesterday') : fmt.format(new Date(`${d}T00:00:00Z`));

  return (
    <div className="mt-4 flex flex-wrap gap-4">
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('orders:filters.date')}
        <select
          className={selectClass}
          value={filters.date}
          onChange={(e) => onChange({ date: e.target.value })}
        >
          {dates.map((d, i) => (
            <option key={d} value={d}>
              {dateLabel(d, i)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('orders:filters.status')}
        <select
          className={selectClass}
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value as OrderFilters['status'] })}
        >
          <option value="ALL">{t('orders:filters.all')}</option>
          {(['PENDING_PAYMENT', 'PAID', 'VOIDED'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`receipt:status.${s}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('orders:filters.method')}
        <select
          className={selectClass}
          value={filters.method}
          onChange={(e) => onChange({ method: e.target.value as OrderFilters['method'] })}
        >
          <option value="ALL">{t('orders:filters.all')}</option>
          {FILTER_METHODS.map((m) => (
            <option key={m} value={m}>
              {t(`orders:method.${m}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('orders:filters.sort')}
        <select
          className={selectClass}
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value as OrderFilters['sort'] })}
        >
          <option value="desc">{t('orders:sort.desc')}</option>
          <option value="asc">{t('orders:sort.asc')}</option>
        </select>
      </label>
    </div>
  );
}

function OrderRow({ order, onVoid }: { order: OrderSummaryDto; onVoid: (o: OrderSummaryDto) => void }) {
  const { t } = useTranslation(['orders', 'receipt']);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(order.createdAt));
  return (
    <tr className="border-t border-line">
      <td className="px-4 py-3 font-semibold">{order.orderNumber}</td>
      <td className="px-4 py-3 tabular-nums">{time}</td>
      <td className="px-4 py-3">{order.createdBy.displayName}</td>
      <td className="px-4 py-3 tabular-nums">{Money.of(order.total).format()}</td>
      <td className="px-4 py-3">
        <StatusPill status={order.status} label={t(`receipt:status.${order.status}`)} />
      </td>
      <td className="px-4 py-3">{order.paymentMethod ? t(`orders:method.${order.paymentMethod}`) : '—'}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {order.status === 'PENDING_PAYMENT' ? (
            <>
              <Link to={`/orders/${order.id}/pay`} className={linkClass}>
                {t('orders:pay')}
              </Link>
              <button type="button" onClick={() => onVoid(order)} className={linkClass}>
                {t('orders:void.open')}
              </button>
            </>
          ) : (
            <Link to={`/orders/${order.id}/receipt`} className={linkClass}>
              {t('orders:receipt')}
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}
