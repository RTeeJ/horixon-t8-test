import { Menu } from '../src/menu/menu';
import { DEFAULT_LIMITS } from '../src/drink/drink-builder';
import { quoteOrder } from '../src/order/quote-order';
import { SEED_MENU, SEED_PRESETS } from './fixtures';

const ctx = { menu: Menu.fromItems(SEED_MENU), vatRateBps: 700, limits: DEFAULT_LIMITS, presets: SEED_PRESETS };
const tea = { base: 'TEA', size: 'SIZE_MEDIUM', addOns: [], quantity: 2 };
const coffee = { base: 'COFFEE', size: 'SIZE_LARGE', addOns: [{ code: 'VANILLA', count: 1 }], quantity: 1 };

describe('quoteOrder', () => {
  it('quotes the R§14.1 cart without discount', () => {
    const q = quoteOrder({ lines: [tea, coffee] }, ctx).unwrap();
    expect(q.lines.map((l) => [l.descriptionEn, l.descriptionTh, l.unitPrice.toString(), l.lineTotal.toString()])).toEqual([
      ['Medium Tea', 'ชา แก้วกลาง', '55.00', '110.00'],
      ['Large Coffee, Vanilla', 'กาแฟ แก้วใหญ่, วานิลลา', '90.00', '90.00'],
    ]);
    expect([q.subtotal, q.total, q.vat, q.beforeVat].map(String)).toEqual(['200.00', '200.00', '13.08', '186.92']);
    expect(q.vatRateBps).toBe(700);
    expect(q.lines[1].components.length).toBeGreaterThan(0);
  });
  it('rejects an empty order', () =>
    expect(quoteOrder({ lines: [] }, ctx).errors).toEqual([{ code: 'ORDER_EMPTY' }]));
  it('allows 20 cups, rejects 21 across lines (A10)', () => {
    expect(quoteOrder({ lines: [{ ...tea, quantity: 20 }] }, ctx).ok).toBe(true);
    expect(quoteOrder({ lines: [{ ...tea, quantity: 20 }, coffee] }, ctx).errors).toEqual([
      { code: 'ORDER_CUP_LIMIT_EXCEEDED', params: { max: 20 } },
    ]);
  });
  it('uses the configured cup limit', () =>
    expect(quoteOrder({ lines: [tea] }, { ...ctx, limits: { ...DEFAULT_LIMITS, maxCups: 1 } }).errors).toEqual([
      { code: 'ORDER_CUP_LIMIT_EXCEEDED', params: { max: 1 } },
    ]));
  it.each([0, -1, 2.5])('rejects quantity %p', (n) =>
    expect(quoteOrder({ lines: [{ ...tea, quantity: n }] }, ctx).errors).toEqual([
      { code: 'INVALID_QUANTITY', line: 0, params: { field: 'quantity' } },
    ]));
  it('reports every bad line with its index (V7)', () => {
    const errs = quoteOrder(
      { lines: [tea, { ...coffee, base: 'NOPE' }, { ...tea, addOns: [{ code: 'VANILLA', count: 6 }] }] },
      ctx,
    ).errors;
    expect(errs.map((e) => [e.line, e.code])).toEqual([
      [1, 'MENU_ITEM_UNAVAILABLE'],
      [2, 'ADDON_REPEAT_LIMIT_EXCEEDED'],
    ]);
  });
  it('reports line errors before the cup limit, ignoring invalid quantities in the sum', () => {
    const errs = quoteOrder({ lines: [{ ...tea, quantity: 20 }, { ...coffee, base: 'NOPE' }, coffee] }, ctx).errors;
    expect(errs.map((e) => [e.line, e.code])).toEqual([
      [1, 'MENU_ITEM_UNAVAILABLE'],
      [undefined, 'ORDER_CUP_LIMIT_EXCEEDED'],
    ]);
  });
  it('excludes an invalid quantity from the cup sum', () => {
    const errs = quoteOrder({ lines: [{ ...tea, quantity: 20 }, { ...tea, quantity: -5 }], }, ctx).errors;
    expect(errs).toEqual([{ code: 'INVALID_QUANTITY', line: 1, params: { field: 'quantity' } }]);
    const over = quoteOrder({ lines: [{ ...tea, quantity: 20 }, { ...tea, quantity: -5 }, coffee] }, ctx).errors;
    expect(over.map((e) => [e.line, e.code])).toEqual([
      [1, 'INVALID_QUANTITY'],
      [undefined, 'ORDER_CUP_LIMIT_EXCEEDED'],
    ]);
  });
  it('reports bad quantity and bad drink on the same line', () => {
    const errs = quoteOrder({ lines: [{ ...coffee, base: 'NOPE', quantity: 0 }] }, ctx).errors;
    expect(errs.map((e) => [e.line, e.code])).toEqual([
      [0, 'INVALID_QUANTITY'],
      [0, 'MENU_ITEM_UNAVAILABLE'],
    ]);
  });
  it.each([1e13, Number.MAX_SAFE_INTEGER, 1e300])('huge quantity %p -> cup limit error, no throw', (n) => {
    const errs = quoteOrder({ lines: [{ ...tea, quantity: n }] }, ctx).errors;
    expect(errs).toEqual([{ code: 'ORDER_CUP_LIMIT_EXCEEDED', params: { max: 20 } }]);
  });
});

describe('quoteOrder with discount', () => {
  it('A3: PROMO_10_PERCENT on ฿200.00', () => {
    const q = quoteOrder({ lines: [tea, coffee], discount: { presetCode: 'PROMO_10_PERCENT' } }, ctx).unwrap();
    expect(q.discount!.preset.code).toBe('PROMO_10_PERCENT');
    expect([q.subtotal, q.discount!.amount, q.total, q.vat, q.beforeVat].map(String)).toEqual(['200.00', '20.00', '180.00', '11.78', '168.22']);
  });
  it('A4: PROMO_30_BAHT on ฿200.00', () => {
    const q = quoteOrder({ lines: [tea, coffee], discount: { presetCode: 'PROMO_30_BAHT' } }, ctx).unwrap();
    expect([q.total, q.vat, q.beforeVat].map(String)).toEqual(['170.00', '11.12', '158.88']);
  });
  it('A7: STAFF_15 on ฿115.00', () => {
    const large = { base: 'COFFEE', size: 'SIZE_LARGE', addOns: [{ code: 'VANILLA', count: 2 }, { code: 'WHIPPED_CREAM', count: 1 }], quantity: 1 };
    const q = quoteOrder({ lines: [large], discount: { presetCode: 'STAFF_15' } }, ctx).unwrap();
    expect([q.discount!.amount, q.total, q.vat, q.beforeVat].map(String)).toEqual(['17.25', '97.75', '6.39', '91.36']);
  });
  it('min spend not met on ฿195.00', () => {
    const small = { base: 'COFFEE', size: 'SIZE_SMALL', addOns: [], quantity: 1 };
    expect(quoteOrder({ lines: [{ ...tea, quantity: 1 }, coffee, small], discount: { presetCode: 'PROMO_30_BAHT' } }, ctx).errors)
      .toEqual([{ code: 'DISCOUNT_MIN_SPEND_NOT_MET', params: { minSubtotal: '200.00' } }]);
  });
  it('no discount → no discount field, total = subtotal', () => {
    const q = quoteOrder({ lines: [tea] }, ctx).unwrap();
    expect(q.discount).toBeUndefined();
    expect(q.total.toString()).toBe(q.subtotal.toString());
  });
  it('line errors hide discount errors', () =>
    expect(quoteOrder({ lines: [{ ...tea, base: 'NOPE' }], discount: { presetCode: 'NOPE' } }, ctx).errors.map((e) => e.code))
      .toEqual(['MENU_ITEM_UNAVAILABLE']));
});
