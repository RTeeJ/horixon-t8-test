import type { MenuItem } from '../menu/menu';
import { ADDON_CATEGORIES } from '../menu/menu';
import type { Beverage } from './beverage';

export type Lang = 'en' | 'th';

export interface DrinkComponent {
  item: MenuItem;
  count: number;
  position: number;
}

/** Base (0), size (1), then each distinct add-on with its count: EXTRA, SYRUP, TOPPING, then sortOrder. */
export function components(b: Beverage): DrinkComponent[] {
  const all = b.ingredients();
  const base = all.find((i) => i.category === 'BASE');
  const size = all.find((i) => i.category === 'SIZE');
  if (!base || !size) throw new Error('beverage must have a base and a size');

  const counts = new Map<string, DrinkComponent>();
  for (const i of all) {
    if (i.category === 'BASE' || i.category === 'SIZE') continue;
    const existing = counts.get(i.code);
    if (existing) existing.count += 1;
    else counts.set(i.code, { item: i, count: 1, position: 0 });
  }
  const rank = (i: MenuItem) => (ADDON_CATEGORIES as readonly string[]).indexOf(i.category);
  const addOns = [...counts.values()].sort(
    (a, c) => rank(a.item) - rank(c.item) || a.item.sortOrder - c.item.sortOrder,
  );

  return [
    { item: base, count: 1, position: 0 },
    { item: size, count: 1, position: 1 },
    ...addOns,
  ].map((c, position) => ({ ...c, position }));
}

export function describe(b: Beverage, lang: Lang): string {
  const name = (i: MenuItem) => (lang === 'en' ? i.nameEn : i.nameTh);
  const [base, size, ...addOns] = components(b);
  const head = lang === 'en' ? `${name(size.item)} ${name(base.item)}` : `${name(base.item)} ${name(size.item)}`;
  const parts = addOns.map((c) => (c.count > 1 ? `${c.count}x ${name(c.item)}` : name(c.item)));
  return [head, ...parts].join(', ');
}
