import { Check, Clock, X, type LucideIcon } from 'lucide-react';
import type { OrderStatus } from '../api/types';

// Hues far apart plus an icon each, so the status never depends on colour alone.
const TONE: Record<OrderStatus, { className: string; Icon: LucideIcon }> = {
  PENDING_PAYMENT: { className: 'bg-amber-100 text-amber-900', Icon: Clock },
  PAID: { className: 'bg-emerald-100 text-emerald-800', Icon: Check },
  VOIDED: { className: 'bg-stone-200 text-stone-600', Icon: X },
};

/** Order status badge: pending is amber (needs action), paid is green, voided is grey (out of play). */
export function StatusPill({ status, label, className = '' }: { status: OrderStatus; label: string; className?: string }) {
  const { className: tone, Icon } = TONE[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone} ${className}`}>
      <Icon aria-hidden="true" className="size-3.5 print:hidden" strokeWidth={2.5} />
      {label}
    </span>
  );
}
