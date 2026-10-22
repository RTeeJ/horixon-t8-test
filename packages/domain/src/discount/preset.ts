import type { Result as ResultType } from '../result';
import { Result } from '../result';
import { Money } from '../money/money';
import type { QuotedLine } from '../order/quote-order';
import { FixedAmountDiscount, PercentDiscount } from './discount';
import type { Discount } from './discount';

export interface DiscountPreset {
  id: string;
  code: string;
  nameEn: string;
  nameTh: string;
  type: 'PERCENT' | 'AMOUNT';
  /** Decimal string: percent for PERCENT ("15.00"), baht for AMOUNT ("30.00"). */
  value: string;
  minSubtotal: string | null;
}

/** Builds the Strategy for a preset. A percent "15.00" has 2 decimals, so its satang value is the bps (1500). */
export function toDiscount(p: DiscountPreset): Discount {
  return p.type === 'PERCENT'
    ? new PercentDiscount(Money.of(p.value).toSatang())
    : new FixedAmountDiscount(Money.of(p.value));
}

/** Eligible when subtotal >= minSubtotal (equal qualifies); no minimum is always eligible. */
export function isPresetEligible(p: DiscountPreset, subtotal: Money): boolean {
  return p.minSubtotal === null || subtotal.compare(Money.of(p.minSubtotal)) >= 0;
}

/** D§4.4 steps 2-4: find the preset, check the minimum spend, compute the amount capped at the subtotal. */
export function resolveDiscount(
  code: string,
  presets: DiscountPreset[],
  subtotal: Money,
  lines: QuotedLine[],
): ResultType<{ preset: DiscountPreset; amount: Money }> {
  const preset = presets.find((p) => p.code === code);
  if (!preset) return Result.err([{ code: 'DISCOUNT_PRESET_UNAVAILABLE' }]);
  if (!isPresetEligible(preset, subtotal)) {
    return Result.err([{ code: 'DISCOUNT_MIN_SPEND_NOT_MET', params: { minSubtotal: preset.minSubtotal! } }]);
  }
  const raw = toDiscount(preset).amountFor(subtotal, lines);
  return Result.ok({ preset, amount: raw.compare(subtotal) > 0 ? subtotal : raw });
}
