import type { Money } from '../money/money';
import type { MenuItem } from '../menu/menu';

/** Seam for size pricing (R§13.1). Only one adapter today, so it is hypothetical by design. */
export interface SizePricingRule {
  apply(inner: Money, size: MenuItem): Money;
}

/** Today's rule: the size adds its own price on top of the drink. */
export class FixedSurchargeRule implements SizePricingRule {
  apply(inner: Money, size: MenuItem): Money {
    return inner.add(size.price);
  }
}
