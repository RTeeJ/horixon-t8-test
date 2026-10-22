import { Money, roundHalfUpDiv } from '../money/money';
import type { QuotedLine } from '../order/quote-order';

/** Strategy: how much a discount takes off an order. Callers cap the result at the subtotal. */
export interface Discount {
  amountFor(subtotal: Money, lines: QuotedLine[]): Money;
}

/** bps: 1500 = 15%. Rounded half-up to the satang (R§9). */
export class PercentDiscount implements Discount {
  constructor(private readonly bps: number) {}

  amountFor(subtotal: Money, _lines: QuotedLine[]): Money {
    const satang = roundHalfUpDiv(BigInt(subtotal.toSatang()) * BigInt(this.bps), 10000n);
    return Money.fromSatang(Number(satang));
  }
}

/** A fixed baht amount off, regardless of the order. */
export class FixedAmountDiscount implements Discount {
  constructor(private readonly amount: Money) {}

  amountFor(_subtotal: Money, _lines: QuotedLine[]): Money {
    return this.amount;
  }
}
