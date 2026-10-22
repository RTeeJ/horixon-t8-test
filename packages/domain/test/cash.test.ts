import { Money } from '../src/money/money';
import { cashChange } from '../src/payment/cash';

const T = Money.of('180.00');
it('computes change', () => expect(cashChange(T, '200').unwrap().toString()).toBe('20.00'));
it('accepts the exact amount', () => expect(cashChange(T, '180.00').unwrap().isZero()).toBe(true));
it('A11: less than total', () => expect(cashChange(T, '150.00').errors).toEqual([{ code: 'CASH_INSUFFICIENT' }]));
it('A20: over ฿10,000', () => {
  const r = cashChange(T, '10000.01');
  expect(r.errors[0].code).toBe('CASH_AMOUNT_INVALID');
  expect(r.errors[0].params).toEqual({ max: '10000.00' });
});
it('allows exactly ฿10,000', () => expect(cashChange(T, '10000.00').ok).toBe(true));
it.each(['', 'abc', '200.005', '-5', '1e3', ' 200', '200.', '1,000'])('rejects %p', (s) =>
  expect(cashChange(T, s).errors[0].code).toBe('CASH_AMOUNT_INVALID'));
