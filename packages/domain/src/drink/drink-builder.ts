import type { DomainError } from '../errors';
import type { Category, Menu, MenuItem } from '../menu/menu';
import { ADDON_CATEGORIES } from '../menu/menu';
import { Result } from '../result';
import { AddOnDecorator, BaseBeverage, SizeDecorator } from './beverage';
import type { Beverage } from './beverage';
import { FixedSurchargeRule } from './size-pricing';
import type { SizePricingRule } from './size-pricing';

export interface Limits {
  maxAddOns: number;
  maxSameAddOn: number;
  maxCups: number;
}

export const DEFAULT_LIMITS: Limits = { maxAddOns: 10, maxSameAddOn: 5, maxCups: 20 };

type Slot = 'BASE' | 'SIZE' | 'ADDON';

interface AddOnEntry {
  count: number;
  badCount: boolean;
}

/** Collects clicks, then validates V1–V5 in one pass and returns every error (R§6). */
export class DrinkBuilder {
  private baseCode: string | undefined;
  private sizeCode: string | undefined;
  // Map keeps first-added order, which is the order add-ons are wrapped and errors reported.
  private readonly addOns = new Map<string, AddOnEntry>();

  private constructor(
    private readonly menu: Menu,
    private readonly limits: Limits,
    private readonly sizeRule: SizePricingRule,
  ) {}

  static on(menu: Menu, limits: Limits = DEFAULT_LIMITS, sizeRule: SizePricingRule = new FixedSurchargeRule()): DrinkBuilder {
    return new DrinkBuilder(menu, limits, sizeRule);
  }

  base(code: string): this {
    this.baseCode = code;
    return this;
  }

  size(code: string): this {
    this.sizeCode = code;
    return this;
  }

  add(code: string, times = 1): this {
    const entry = this.addOns.get(code) ?? { count: 0, badCount: false };
    if (Number.isInteger(times) && times >= 1) entry.count += times;
    else entry.badCount = true;
    this.addOns.set(code, entry);
    return this;
  }

  build(): Result<Beverage> {
    const errors: DomainError[] = [];

    const base = this.resolve(this.baseCode, 'BASE', 'BASE_REQUIRED', errors);
    const size = this.resolve(this.sizeCode, 'SIZE', 'SIZE_REQUIRED', errors);

    const valid: Array<{ item: MenuItem; count: number }> = [];
    let total = 0;
    for (const [code, entry] of this.addOns) {
      const item = this.lookup(code, 'ADDON', errors);
      if (entry.badCount) errors.push({ code: 'INVALID_QUANTITY', params: { field: 'addOns.count', code } });
      if (!item) continue;
      if (entry.count > this.limits.maxSameAddOn) {
        errors.push({ code: 'ADDON_REPEAT_LIMIT_EXCEEDED', params: { code, max: this.limits.maxSameAddOn } });
      }
      total += entry.count;
      valid.push({ item, count: entry.count });
    }
    if (total > this.limits.maxAddOns) {
      errors.push({ code: 'ADDON_LIMIT_EXCEEDED', params: { max: this.limits.maxAddOns } });
    }

    if (errors.length > 0 || !base || !size) return Result.err(errors);

    let drink: Beverage = new BaseBeverage(base);
    // Expand only after all limits passed, so a huge count never allocates.
    for (const { item, count } of valid) {
      for (let i = 0; i < count; i++) drink = new AddOnDecorator(drink, item);
    }
    return Result.ok(new SizeDecorator(drink, size, this.sizeRule));
  }

  private resolve(
    code: string | undefined,
    slot: 'BASE' | 'SIZE',
    required: 'BASE_REQUIRED' | 'SIZE_REQUIRED',
    errors: DomainError[],
  ): MenuItem | undefined {
    if (code === undefined) {
      errors.push({ code: required });
      return undefined;
    }
    return this.lookup(code, slot, errors);
  }

  private lookup(code: string, slot: Slot, errors: DomainError[]): MenuItem | undefined {
    const item = this.menu.get(code);
    if (item && slotOf(item.category) === slot) return item;
    const params: Record<string, string> = { code };
    if (item) params.expected = slot;
    errors.push({ code: 'MENU_ITEM_UNAVAILABLE', params });
    return undefined;
  }
}

function slotOf(c: Category): Slot {
  return (ADDON_CATEGORIES as readonly string[]).includes(c) ? 'ADDON' : c === 'BASE' ? 'BASE' : 'SIZE';
}
