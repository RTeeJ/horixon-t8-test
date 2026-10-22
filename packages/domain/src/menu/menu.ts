import { Money } from '../money/money';

export type Category = 'BASE' | 'SIZE' | 'EXTRA' | 'SYRUP' | 'TOPPING';
export const ADDON_CATEGORIES = ['EXTRA', 'SYRUP', 'TOPPING'] as const;

export interface MenuItemData {
  id: string;
  code: string;
  category: Category;
  nameEn: string;
  nameTh: string;
  price: string;
  isActive: boolean;
  sortOrder: number;
}

export interface MenuItem {
  id: string;
  code: string;
  category: Category;
  nameEn: string;
  nameTh: string;
  price: Money;
  sortOrder: number;
}

export class Menu {
  private constructor(private readonly byCode: Map<string, MenuItem>) {}

  /** Inactive items are dropped here, so they can never be priced or ordered. */
  static fromItems(items: MenuItemData[]): Menu {
    const map = new Map<string, MenuItem>();
    for (const d of items) {
      if (!d.isActive) continue;
      map.set(d.code, {
        id: d.id, code: d.code, category: d.category, nameEn: d.nameEn,
        nameTh: d.nameTh, price: Money.of(d.price), sortOrder: d.sortOrder,
      });
    }
    return new Menu(map);
  }

  get(code: string): MenuItem | undefined {
    return this.byCode.get(code);
  }

  byCategory(c: Category): MenuItem[] {
    return [...this.byCode.values()].filter((i) => i.category === c).sort((a, b) => a.sortOrder - b.sortOrder);
  }
}
