import { Menu } from '../src/menu/menu';
import { DrinkBuilder } from '../src/drink/drink-builder';
import { describe as describeDrink } from '../src/drink/describe';
import { SEED_MENU } from './fixtures';

const b = () => DrinkBuilder.on(Menu.fromItems(SEED_MENU));

describe('DrinkBuilder', () => {
  it('builds A1', () => {
    const d = b().base('COFFEE').size('SIZE_LARGE').add('VANILLA', 2).add('WHIPPED_CREAM').build().unwrap();
    expect(d.cost().toString()).toBe('115.00');
  });
  it('reports missing base and size together', () =>
    expect(b().add('VANILLA').build().errors.map((e) => e.code)).toEqual(['BASE_REQUIRED', 'SIZE_REQUIRED']));
  it('rejects unknown codes', () =>
    expect(b().base('COFFEE').size('SIZE_SMALL').add('HAZELNUT').build().errors)
      .toEqual([{ code: 'MENU_ITEM_UNAVAILABLE', params: { code: 'HAZELNUT' } }]));
  it('rejects an unknown base with only MENU_ITEM_UNAVAILABLE', () =>
    expect(b().base('NOPE').size('SIZE_SMALL').build().errors)
      .toEqual([{ code: 'MENU_ITEM_UNAVAILABLE', params: { code: 'NOPE' } }]));
  it('rejects a code in the wrong slot', () =>
    expect(b().base('VANILLA').size('SIZE_SMALL').build().errors)
      .toEqual([{ code: 'MENU_ITEM_UNAVAILABLE', params: { code: 'VANILLA', expected: 'BASE' } }]));
  it('rejects a size used as add-on', () =>
    expect(b().base('TEA').size('SIZE_SMALL').add('SIZE_LARGE').build().errors[0])
      .toEqual({ code: 'MENU_ITEM_UNAVAILABLE', params: { code: 'SIZE_LARGE', expected: 'ADDON' } }));
  it('allows exactly 10 add-ons, rejects 11 (A8)', () => {
    expect(b().base('TEA').size('SIZE_SMALL').add('VANILLA', 5).add('CARAMEL', 5).build().ok).toBe(true);
    expect(b().base('TEA').size('SIZE_SMALL').add('VANILLA', 5).add('CARAMEL', 5).add('CINNAMON').build().errors)
      .toEqual([{ code: 'ADDON_LIMIT_EXCEEDED', params: { max: 10 } }]);
  });
  it('rejects the same add-on 6 times, even split across calls (A9)', () =>
    expect(b().base('TEA').size('SIZE_SMALL').add('VANILLA', 3).add('VANILLA', 3).build().errors)
      .toEqual([{ code: 'ADDON_REPEAT_LIMIT_EXCEEDED', params: { code: 'VANILLA', max: 5 } }]));
  it.each([0, -1, 1.5, NaN])('rejects add-on count %p', (n) =>
    expect(b().base('TEA').size('SIZE_SMALL').add('VANILLA', n).build().errors[0].code).toBe('INVALID_QUANTITY'));
  it('reports a bad count once per code with its params', () =>
    expect(b().base('TEA').size('SIZE_SMALL').add('VANILLA', 0).add('VANILLA', -1).build().errors)
      .toEqual([{ code: 'INVALID_QUANTITY', params: { field: 'addOns.count', code: 'VANILLA' } }]));
  it('calling base() twice keeps the last one', () =>
    expect(b().base('TEA').base('COFFEE').size('SIZE_SMALL').build().unwrap().cost().toString()).toBe('50.00'));
  it('orders errors: base, size, add-ons in first-added order, then total', () => {
    const errs = b().base('X').size('Y').add('A', 1).add('VANILLA', 6).add('CARAMEL', 5).build().errors;
    expect(errs.map((e) => [e.code, e.params?.code])).toEqual([
      ['MENU_ITEM_UNAVAILABLE', 'X'], ['MENU_ITEM_UNAVAILABLE', 'Y'], ['MENU_ITEM_UNAVAILABLE', 'A'],
      ['ADDON_REPEAT_LIMIT_EXCEEDED', 'VANILLA'], ['ADDON_LIMIT_EXCEEDED', undefined],
    ]);
  });
  it('wraps size last regardless of call order', () => {
    const d = b().size('SIZE_LARGE').add('VANILLA').base('COFFEE').build().unwrap();
    expect(d.ingredients().map((i) => i.code)).toEqual(['COFFEE', 'VANILLA', 'SIZE_LARGE']);
    expect(describeDrink(d, 'en')).toBe('Large Coffee, Vanilla');
  });
  it('returns promptly for a huge count without expanding layers', () => {
    const errs = b().base('TEA').size('SIZE_SMALL').add('VANILLA', 1e9).build().errors;
    expect(errs).toEqual([
      { code: 'ADDON_REPEAT_LIMIT_EXCEEDED', params: { code: 'VANILLA', max: 5 } },
      { code: 'ADDON_LIMIT_EXCEEDED', params: { max: 10 } },
    ]);
  });
  it('rejects an inactive menu item', () => {
    const menu = Menu.fromItems(SEED_MENU.map((i) => (i.code === 'TEA' ? { ...i, isActive: false } : i)));
    expect(DrinkBuilder.on(menu).base('TEA').size('SIZE_SMALL').build().errors)
      .toEqual([{ code: 'MENU_ITEM_UNAVAILABLE', params: { code: 'TEA' } }]);
  });
  it('reads non-default limits', () => {
    const d = DrinkBuilder.on(Menu.fromItems(SEED_MENU), { maxAddOns: 2, maxSameAddOn: 1, maxCups: 20 });
    expect(d.base('TEA').size('SIZE_SMALL').add('VANILLA', 2).build().errors)
      .toEqual([
        { code: 'ADDON_REPEAT_LIMIT_EXCEEDED', params: { code: 'VANILLA', max: 1 } },
      ]);
    expect(DrinkBuilder.on(Menu.fromItems(SEED_MENU), { maxAddOns: 2, maxSameAddOn: 5, maxCups: 20 })
      .base('TEA').size('SIZE_SMALL').add('VANILLA', 3).build().errors)
      .toEqual([{ code: 'ADDON_LIMIT_EXCEEDED', params: { max: 2 } }]);
  });
});
