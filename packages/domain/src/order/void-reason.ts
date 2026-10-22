import { Result } from '../result';

/** Reasons a staff member can give for voiding an order (R§10.2). */
export const VOID_REASONS = [
  'CUSTOMER_CHANGED_MIND',
  'WRONG_ORDER_ENTRY',
  'OUT_OF_STOCK',
  'CUSTOMER_LEFT_UNPAID',
  'OTHER',
] as const;

export type VoidReason = (typeof VOID_REASONS)[number];

export const MAX_VOID_NOTE = 200;

/** Normalises the note (trimmed, empty → null); `OTHER` requires one. */
export function checkVoid(
  reasonCode: VoidReason,
  note?: string | null,
): Result<{ reasonCode: VoidReason; note: string | null }> {
  const trimmed = note?.trim() || null;
  if (reasonCode === 'OTHER' && trimmed === null) return Result.err([{ code: 'VOID_NOTE_REQUIRED' }]);
  return Result.ok({ reasonCode, note: trimmed });
}
