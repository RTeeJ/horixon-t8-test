import type { VoidReason } from '@coffee/domain';
import type { PaymentTransactionEntity } from '../payment/payment-transaction.entity';
import { toTransactionDto, TransactionDto } from '../payment/payment.mapper';
import { OrderEntity, OrderStatus } from './order.entity';

export interface OrderDto {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  createdBy: { id: string; displayName: string };
  lines: { quantity: number; descriptionEn: string; descriptionTh: string; unitPrice: string; lineTotal: string }[];
  subtotal: string;
  discount: { presetCode: string; nameEn: string; nameTh: string; amount: string } | null;
  total: string;
  vatRateBps: number;
  vat: string;
  beforeVat: string;
  transactions: TransactionDto[];
  voided: { at: string; by: { id: string; displayName: string }; reasonCode: VoidReason; note: string | null } | null;
}

export interface OrderSummaryDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  createdBy: { id: string; displayName: string };
  total: string;
  paymentMethod: 'QR' | 'CASH' | 'NONE' | null;
}

/** `o.transactions` is only the SUCCEEDED row here (the list query joins just that one). */
export function toOrderSummaryDto(o: OrderEntity): OrderSummaryDto {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    createdBy: { id: o.createdBy.id, displayName: o.createdBy.displayName },
    total: o.total.toString(),
    paymentMethod: o.transactions?.[0]?.method ?? null,
  };
}

export function toOrderDto(o: OrderEntity): OrderDto {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    createdBy: { id: o.createdBy.id, displayName: o.createdBy.displayName },
    lines: [...o.lines].sort((a, b) => a.lineNo - b.lineNo).map((l) => ({
      quantity: l.quantity,
      descriptionEn: l.descriptionEn,
      descriptionTh: l.descriptionTh,
      unitPrice: l.unitPrice.toString(),
      lineTotal: l.lineTotal.toString(),
    })),
    subtotal: o.subtotal.toString(),
    discount: o.discountPresetId && o.discountPreset
      ? { presetCode: o.discountPreset.code, nameEn: o.discountPreset.nameEn, nameTh: o.discountPreset.nameTh, amount: o.discountAmount.toString() }
      : null,
    total: o.total.toString(),
    vatRateBps: o.vatRateBps,
    vat: o.vat.toString(),
    beforeVat: o.beforeVat.toString(),
    transactions: [...(o.transactions ?? [])].sort(byCreatedAtThenStatus).map(toTransactionDto),
    voided: o.voidedAt && o.voidedBy && o.voidReasonCode
      ? {
          at: o.voidedAt.toISOString(),
          by: { id: o.voidedBy.id, displayName: o.voidedBy.displayName },
          reasonCode: o.voidReasonCode,
          note: o.voidReasonNote,
        }
      : null,
  };
}

// Same createdAt (frozen test clock): EXPIRED/FAILED first, then PENDING, then SUCCEEDED, then id.
const STATUS_RANK = { EXPIRED: 0, FAILED: 0, PENDING: 1, SUCCEEDED: 2 } as const;
function byCreatedAtThenStatus(a: PaymentTransactionEntity, b: PaymentTransactionEntity): number {
  return a.createdAt.getTime() - b.createdAt.getTime()
    || STATUS_RANK[a.status] - STATUS_RANK[b.status]
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
