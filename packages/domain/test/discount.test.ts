import { Money } from '../src/money/money';
import { FixedAmountDiscount, PercentDiscount } from '../src/discount/discount';
import { isPresetEligible, resolveDiscount, toDiscount } from '../src/discount/preset';
import { SEED_PRESETS } from './fixtures';

const preset = (code: string) => SEED_PRESETS.find((p) => p.code === code)!;

describe('discount', () => {
  it('percent rounds half-up', () => {
    expect(new PercentDiscount(1500).amountFor(Money.of('0.10'), []).toString()).toBe('0.02'); // 0.015
    expect(new PercentDiscount(1500).amountFor(Money.of('115.00'), []).toString()).toBe('17.25');
  });
  it('fixed amount', () =>
    expect(new FixedAmountDiscount(Money.of('30.00')).amountFor(Money.of('200.00'), []).toString()).toBe('30.00'));
  it('toDiscount maps PERCENT to bps and AMOUNT to a fixed amount', () => {
    expect(toDiscount(preset('STAFF_15')).amountFor(Money.of('100.00'), []).toString()).toBe('15.00');
    expect(toDiscount(preset('PROMO_30_BAHT')).amountFor(Money.of('500.00'), []).toString()).toBe('30.00');
  });
  it('min spend: equal qualifies', () => {
    expect(isPresetEligible(preset('PROMO_30_BAHT'), Money.of('200.00'))).toBe(true);
    expect(isPresetEligible(preset('PROMO_30_BAHT'), Money.of('199.99'))).toBe(false);
    expect(isPresetEligible(preset('STAFF_15'), Money.of('0.01'))).toBe(true);
  });
  it('A5: ฿199.00 with PROMO_30_BAHT', () =>
    expect(resolveDiscount('PROMO_30_BAHT', SEED_PRESETS, Money.of('199.00'), []).errors).toEqual([
      { code: 'DISCOUNT_MIN_SPEND_NOT_MET', params: { minSubtotal: '200.00' } },
    ]));
  it('A6: ฿99.00 with PROMO_10_PERCENT', () =>
    expect(resolveDiscount('PROMO_10_PERCENT', SEED_PRESETS, Money.of('99.00'), []).errors[0].code).toBe('DISCOUNT_MIN_SPEND_NOT_MET'));
  it('unknown or inactive code', () =>
    expect(resolveDiscount('NOPE', SEED_PRESETS, Money.of('500.00'), []).errors).toEqual([{ code: 'DISCOUNT_PRESET_UNAVAILABLE' }]));
  it('resolves an eligible preset', () => {
    const r = resolveDiscount('PROMO_10_PERCENT', SEED_PRESETS, Money.of('200.00'), []).unwrap();
    expect([r.preset.code, r.amount.toString()]).toEqual(['PROMO_10_PERCENT', '20.00']);
  });
  it('caps at the subtotal', () => {
    const big = { ...preset('PROMO_30_BAHT'), code: 'BIG', minSubtotal: null };
    expect(resolveDiscount('BIG', [big], Money.of('25.00'), []).unwrap().amount.toString()).toBe('25.00');
  });
});
