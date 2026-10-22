import { Money } from '../src/money/money';
import { roundHalfUpDiv } from '../src/money/money';

it('adds decimals exactly', () => expect(Money.of('0.10').add(Money.of('0.20')).toString()).toBe('0.30'));
it('accepts 0–2 decimals', () => { expect(Money.of('50').toString()).toBe('50.00'); expect(Money.of('5.5').toString()).toBe('5.50'); });
it.each(['1.234', 'abc', '', '1,000.00', ' 1.00'])('rejects %p', (s) => expect(() => Money.of(s)).toThrow());
it('multiplies by integers only', () => { expect(Money.of('55.00').times(2).toString()).toBe('110.00'); expect(() => Money.of('1.00').times(1.5)).toThrow(); });
it('formats with baht sign and grouping', () => expect(Money.of('10000').format()).toBe('฿10,000.00'));
it('compares', () => { expect(Money.of('1.00').compare(Money.of('2.00'))).toBe(-1); expect(Money.zero().isZero()).toBe(true); });
it('rounds half up', () => { expect(roundHalfUpDiv(5n, 10n)).toBe(1n); expect(roundHalfUpDiv(4n, 10n)).toBe(0n); expect(roundHalfUpDiv(15n, 10n)).toBe(2n); });
