import { cartReducer, type CartLine } from './cart-reducer';

const recipe = (addOns: { code: string; count: number }[]) => ({ base: 'COFFEE', size: 'SIZE_LARGE', addOns });

describe('cartReducer', () => {
  it('merges identical recipes added with add-ons in different orders (A15)', () => {
    const key = 'Large Coffee, Vanilla, Whipped Cream';
    let s: CartLine[] = [];
    s = cartReducer(s, {
      type: 'add',
      key,
      recipe: recipe([
        { code: 'VANILLA', count: 1 },
        { code: 'WHIPPED_CREAM', count: 1 },
      ]),
    });
    s = cartReducer(s, {
      type: 'add',
      key,
      recipe: recipe([
        { code: 'WHIPPED_CREAM', count: 1 },
        { code: 'VANILLA', count: 1 },
      ]),
    });
    expect(s).toHaveLength(1);
    expect(s[0].quantity).toBe(2);
  });

  it('setQuantity to 0 removes the line; remove and clear work', () => {
    const base: CartLine[] = [
      { key: 'a', recipe: recipe([]), quantity: 2 },
      { key: 'b', recipe: recipe([]), quantity: 1 },
    ];
    expect(cartReducer(base, { type: 'setQuantity', key: 'a', quantity: 0 }).map((l) => l.key)).toEqual(['b']);
    expect(cartReducer(base, { type: 'setQuantity', key: 'a', quantity: 5 })[0].quantity).toBe(5);
    expect(cartReducer(base, { type: 'remove', key: 'b' }).map((l) => l.key)).toEqual(['a']);
    expect(cartReducer(base, { type: 'clear' })).toEqual([]);
  });
});
