import type { Money } from '../money/money';
import type { MenuItem } from '../menu/menu';
import type { SizePricingRule } from './size-pricing';

export interface Beverage {
  cost(): Money;
  /** Base first, then everything wrapped around it. */
  ingredients(): readonly MenuItem[];
}

/** Coffee, Tea, Milk, Latte... (data). */
export class BaseBeverage implements Beverage {
  constructor(private readonly base: MenuItem) {}

  cost(): Money {
    return this.base.price;
  }

  ingredients(): readonly MenuItem[] {
    return [this.base];
  }
}

export abstract class BeverageDecorator implements Beverage {
  constructor(protected readonly inner: Beverage) {}

  abstract cost(): Money;

  ingredients(): readonly MenuItem[] {
    return this.inner.ingredients();
  }
}

/** Every extra, syrup and topping (data). "Double vanilla" is two layers. */
export class AddOnDecorator extends BeverageDecorator {
  constructor(inner: Beverage, private readonly addOn: MenuItem) {
    super(inner);
  }

  cost(): Money {
    return this.inner.cost().add(this.addOn.price);
  }

  ingredients(): readonly MenuItem[] {
    return [...this.inner.ingredients(), this.addOn];
  }
}

/** Always the outermost layer, so its rule sees the full price of everything inside. */
export class SizeDecorator extends BeverageDecorator {
  constructor(
    inner: Beverage,
    private readonly size: MenuItem,
    private readonly rule: SizePricingRule,
  ) {
    super(inner);
  }

  cost(): Money {
    return this.rule.apply(this.inner.cost(), this.size);
  }

  ingredients(): readonly MenuItem[] {
    return [...this.inner.ingredients(), this.size];
  }
}
