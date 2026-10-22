import { formatOrderNumber } from '../src/order/order-number';

describe('formatOrderNumber', () => {
  it('pads the sequence to 4 digits', () => {
    expect(formatOrderNumber('2026-10-21', 1)).toBe('20261021-0001');
    expect(formatOrderNumber('2026-10-21', 9999)).toBe('20261021-9999');
  });
  it('widens past 9999', () => {
    expect(formatOrderNumber('2026-10-21', 10000)).toBe('20261021-10000');
  });
});
