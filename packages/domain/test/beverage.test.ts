import { Money } from '../src/money/money';
import { Menu } from '../src/menu/menu';
import { BaseBeverage, AddOnDecorator, SizeDecorator } from '../src/drink/beverage';
import { FixedSurchargeRule } from '../src/drink/size-pricing';
import type { SizePricingRule } from '../src/drink/size-pricing';
import { SEED_MENU } from './fixtures';

const menu = Menu.fromItems(SEED_MENU);
const item = (code: string) => {
  const found = menu.get(code);
  if (!found) throw new Error(`fixture missing ${code}`);
  return found;
};

const COFFEE = item('COFFEE');
const TEA = item('TEA');
const VANILLA = item('VANILLA');
const WHIPPED_CREAM = item('WHIPPED_CREAM');
const SIZE_LARGE = item('SIZE_LARGE');

describe('beverage decorators', () => {
  it('composes Coffee + 2x Vanilla + Whipped Cream + Large to 115.00 with ingredients in order', () => {
    const drink = new SizeDecorator(
      new AddOnDecorator(
        new AddOnDecorator(
          new AddOnDecorator(new BaseBeverage(COFFEE), VANILLA),
          VANILLA,
        ),
        WHIPPED_CREAM,
      ),
      SIZE_LARGE,
      new FixedSurchargeRule(),
    );

    expect(drink.cost().toString()).toBe('115.00');
    expect(drink.ingredients().map((i) => i.code)).toEqual([
      'COFFEE', 'VANILLA', 'VANILLA', 'WHIPPED_CREAM', 'SIZE_LARGE',
    ]);
  });

  it('BaseBeverage costs and lists only its base item', () => {
    const tea = new BaseBeverage(TEA);

    expect(tea.cost().toString()).toBe('40.00');
    expect(tea.ingredients().map((i) => i.code)).toEqual(['TEA']);
  });

  it('SizeDecorator delegates its price to the injected SizePricingRule (the seam)', () => {
    const stub: SizePricingRule = { apply: jest.fn(() => Money.of('1.00')) };
    const drink = new SizeDecorator(new BaseBeverage(COFFEE), SIZE_LARGE, stub);

    expect(drink.cost().toString()).toBe('1.00');
    expect(stub.apply).toHaveBeenCalledTimes(1);
    const [innerCost, sizeArg] = (stub.apply as jest.Mock).mock.calls[0];
    expect(innerCost.toString()).toBe('50.00');
    expect(sizeArg.code).toBe('SIZE_LARGE');
  });

  it('FixedSurchargeRule adds the size price to the inner cost', () => {
    const rule = new FixedSurchargeRule();

    expect(rule.apply(Money.of('50.00'), SIZE_LARGE).toString()).toBe('80.00');
    expect(rule.apply(Money.of('50.00'), item('SIZE_SMALL')).toString()).toBe('50.00');
  });
});
