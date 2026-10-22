import { Menu } from '../src/menu/menu';
import type { MenuItem } from '../src/menu/menu';
import { BaseBeverage, AddOnDecorator, SizeDecorator } from '../src/drink/beverage';
import type { Beverage } from '../src/drink/beverage';
import { FixedSurchargeRule } from '../src/drink/size-pricing';
import { components, describe as describeDrink } from '../src/drink/describe';
import { SEED_MENU } from './fixtures';

const menu = Menu.fromItems(SEED_MENU);
const item = (code: string): MenuItem => {
  const found = menu.get(code);
  if (!found) throw new Error(`fixture missing ${code}`);
  return found;
};

const build = (base: string, addOns: string[], size = 'SIZE_LARGE'): Beverage => {
  let b: Beverage = new BaseBeverage(item(base));
  for (const code of addOns) b = new AddOnDecorator(b, item(code));
  return new SizeDecorator(b, item(size), new FixedSurchargeRule());
};

describe('describe()', () => {
  it('groups and counts add-ons (Coffee + Vanilla x2 + Whipped Cream)', () => {
    const d = build('COFFEE', ['VANILLA', 'VANILLA', 'WHIPPED_CREAM']);
    expect(describeDrink(d, 'en')).toBe('Large Coffee, 2x Vanilla, Whipped Cream');
    expect(describeDrink(d, 'th')).toBe('กาแฟ แก้วใหญ่, 2x วานิลลา, วิปครีม');
  });

  it('orders by category then sortOrder regardless of click order', () => {
    const d = build('COFFEE', ['CINNAMON', 'VANILLA', 'WHIPPED_CREAM', 'VANILLA']);
    expect(describeDrink(d, 'en')).toBe('Large Coffee, 2x Vanilla, Whipped Cream, Cinnamon');
  });

  it('is independent of click order within a category', () => {
    expect(describeDrink(build('COFFEE', ['CARAMEL', 'VANILLA']), 'en')).toBe('Large Coffee, Vanilla, Caramel');
    expect(describeDrink(build('COFFEE', ['VANILLA', 'CARAMEL']), 'en')).toBe('Large Coffee, Vanilla, Caramel');
  });

  it('puts extras before syrups', () => {
    const d = build('LATTE', ['VANILLA', 'WHIPPED_CREAM', 'EXTRA_COFFEE_SHOT', 'VANILLA']);
    expect(describeDrink(d, 'en')).toBe('Large Latte, Extra Coffee Shot, 2x Vanilla, Whipped Cream');
  });

  it('describes a plain Small Tea', () => {
    const d = build('TEA', [], 'SIZE_SMALL');
    expect(describeDrink(d, 'en')).toBe('Small Tea');
    expect(describeDrink(d, 'th')).toBe('ชา แก้วเล็ก');
  });
});

describe('components()', () => {
  it('returns base, size, then distinct add-ons with counts and positions', () => {
    const d = build('LATTE', ['VANILLA', 'WHIPPED_CREAM', 'EXTRA_COFFEE_SHOT', 'VANILLA']);
    expect(components(d).map((c) => [c.item.code, c.count, c.position])).toEqual([
      ['LATTE', 1, 0],
      ['SIZE_LARGE', 1, 1],
      ['EXTRA_COFFEE_SHOT', 1, 2],
      ['VANILLA', 2, 3],
      ['WHIPPED_CREAM', 1, 4],
    ]);
  });
});
