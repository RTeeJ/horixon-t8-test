import type { VoidReason } from '@coffee/domain';

export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'VOIDED';

export interface OrderSummaryDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  createdBy: { id: number | string; displayName: string };
  total: string;
  paymentMethod: 'QR' | 'CASH' | 'NONE' | null;
}

export interface TransactionDto {
  id: string;
  method: 'QR' | 'CASH' | 'NONE';
  amount: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  qrPayload: string | null;
  cashReceived: string | null;
  change: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
}

export interface PaymentResultDto {
  transaction: TransactionDto;
  order: OrderDto;
}

/** Order as returned by the API (money as decimal strings). */
export interface OrderDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  createdBy: { id: number | string; displayName: string };
  lines: {
    quantity: number;
    descriptionEn: string;
    descriptionTh: string;
    unitPrice: string;
    lineTotal: string;
  }[];
  subtotal: string;
  total: string;
  vatRateBps: number;
  vat: string;
  beforeVat: string;
  discount: { presetCode: string; nameEn: string; nameTh: string; amount: string } | null;
  transactions: TransactionDto[];
  voided: {
    at: string;
    by: { id: string; displayName: string };
    reasonCode: VoidReason;
    note: string | null;
  } | null;
}
