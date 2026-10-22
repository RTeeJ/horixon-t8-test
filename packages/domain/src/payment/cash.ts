import { Money } from '../money/money';
import { Result } from '../result';

/** Largest cash amount accepted in one payment (R§11.2). */
export const MAX_CASH_RECEIVED = Money.of('10000.00');

const AMOUNT_FORMAT = /^\d+(\.\d{1,2})?$/;

/** Change due for a cash payment, or why the received amount is rejected (R§11.2). */
export function cashChange(total: Money, received: string): Result<Money> {
  if (!AMOUNT_FORMAT.test(received)) {
    return Result.err([{ code: 'CASH_AMOUNT_INVALID', params: { max: MAX_CASH_RECEIVED.toString() } }]);
  }
  const amount = Money.of(received);
  if (amount.compare(MAX_CASH_RECEIVED) > 0) {
    return Result.err([{ code: 'CASH_AMOUNT_INVALID', params: { max: MAX_CASH_RECEIVED.toString() } }]);
  }
  if (amount.compare(total) < 0) return Result.err([{ code: 'CASH_INSUFFICIENT' }]);
  return Result.ok(amount.subtract(total));
}
