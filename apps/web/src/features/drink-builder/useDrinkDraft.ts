import { useMemo, useState } from 'react';
import { DrinkBuilder, DEFAULT_LIMITS, type Beverage, type LineInput, type Menu, type Result } from '@coffee/domain';

export type DraftLine = Omit<LineInput, 'quantity'>;

export function useDrinkDraft(menu: Menu) {
  const [base, setBase] = useState<string>();
  const [size, setSize] = useState<string>();
  const [addOns, setAddOns] = useState<Record<string, number>>({});

  const result: Result<Beverage> = useMemo(() => {
    const b = DrinkBuilder.on(menu);
    if (base) b.base(base);
    if (size) b.size(size);
    for (const [code, count] of Object.entries(addOns)) b.add(code, count);
    return b.build();
  }, [menu, base, size, addOns]);

  const addOnTotal = Object.values(addOns).reduce((a, c) => a + c, 0);

  return {
    base,
    size,
    addOns,
    addOnTotal,
    setBase,
    setSize,
    canIncrement: (code: string) =>
      addOnTotal < DEFAULT_LIMITS.maxAddOns && (addOns[code] ?? 0) < DEFAULT_LIMITS.maxSameAddOn,
    increment: (code: string) =>
      setAddOns((a) => ({ ...a, [code]: (a[code] ?? 0) + 1 })),
    decrement: (code: string) =>
      setAddOns((a) => {
        const { [code]: n = 0, ...rest } = a;
        return n > 1 ? { ...rest, [code]: n - 1 } : rest;
      }),
    reset: () => {
      setBase(undefined);
      setSize(undefined);
      setAddOns({});
    },
    result,
    toLineInput: (): DraftLine => ({
      base: base ?? '',
      size: size ?? '',
      addOns: Object.entries(addOns).map(([code, count]) => ({ code, count })),
    }),
  };
}

export type DrinkDraft = ReturnType<typeof useDrinkDraft>;
