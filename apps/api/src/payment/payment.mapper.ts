import type { PaymentTransactionEntity } from './payment-transaction.entity';

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

export function toTransactionDto(t: PaymentTransactionEntity): TransactionDto {
  return {
    id: t.id,
    method: t.method,
    amount: t.amount.toString(),
    status: t.status,
    qrPayload: t.qrPayload,
    cashReceived: t.cashReceived?.toString() ?? null,
    change: t.change?.toString() ?? null,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
    expiresAt: t.expiresAt?.toISOString() ?? null,
  };
}
