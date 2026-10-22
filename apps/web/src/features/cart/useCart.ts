import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  DEFAULT_LIMITS,
  isPresetEligible,
  quoteOrder,
  type DiscountPreset,
  type Menu,
  type Money,
  type OrderInput,
  type OrderQuote,
  type QuotedLine,
  type Result,
} from '@coffee/domain';
import { cartReducer, type CartAction, type CartLine } from './cart-reducer';

export const CART_KEY = 'pos.cart';
export const CART_DISCOUNT_KEY = 'pos.cart.discount';
export const VAT_RATE_BPS = 700;

function isLine(v: unknown): v is CartLine {
  const l = v as CartLine;
  return (
    typeof l?.key === 'string' &&
    Number.isInteger(l.quantity) &&
    l.quantity >= 1 &&
    typeof l.recipe?.base === 'string' &&
    typeof l.recipe?.size === 'string' &&
    Array.isArray(l.recipe.addOns) &&
    l.recipe.addOns.every((a: { code?: unknown; count?: unknown } | null) => typeof a?.code === 'string' && Number.isFinite(a?.count))
  );
}

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) && parsed.every(isLine) ? parsed : [];
  } catch {
    return [];
  }
}

function loadDiscount(): string | null {
  try {
    return localStorage.getItem(CART_DISCOUNT_KEY) || null;
  } catch {
    return null;
  }
}

export function clearStoredCart(): void {
  try {
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(CART_DISCOUNT_KEY);
  } catch {
    /* storage unavailable */
  }
}

export type DiscountNotice = { kind: 'minSpend'; preset: DiscountPreset } | { kind: 'unavailable' };

export interface Cart {
  lines: CartLine[];
  /** Code of the chosen preset, kept even while presets are not loaded. */
  presetCode: string | null;
  /** Chooses a preset (or `null` for none) and clears any removal notice. */
  setDiscount: (code: string | null) => void;
  /** Why a chosen preset was removed automatically, until the user chooses again. */
  discountNotice: DiscountNotice | null;
  /** Subtotal of the lines without discount; null when the lines are empty or invalid. */
  baseSubtotal: Money | null;
  /** What "Place order" sends: the lines, plus the discount only when it is loaded and eligible. */
  input: OrderInput;
  dispatch: (action: CartAction) => void;
  /** Whole-order quote for validation and totals (display only; the server is authoritative). */
  quote: Result<OrderQuote>;
  /** Per-line price/description, undefined when that line is invalid (e.g. item no longer on the menu). */
  lineViews: (QuotedLine | undefined)[];
}

export function useCart(menu: Menu, presets: DiscountPreset[] | undefined): Cart {
  const [lines, rawDispatch] = useReducer(cartReducer, undefined, load);
  const [presetCode, setPresetCode] = useState<string | null>(loadDiscount);
  const [discountNotice, setDiscountNotice] = useState<DiscountNotice | null>(null);

  // Emptying the cart (after a successful order) also forgets the discount.
  const dispatch = useCallback((action: CartAction) => {
    if (action.type === 'clear') setPresetCode(null);
    rawDispatch(action);
  }, []);

  const setDiscount = useCallback((code: string | null) => {
    setPresetCode(code);
    setDiscountNotice(null);
  }, []);

  useEffect(() => {
    try {
      if (lines.length === 0) localStorage.removeItem(CART_KEY);
      else localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable */
    }
  }, [lines]);

  useEffect(() => {
    try {
      if (presetCode === null) localStorage.removeItem(CART_DISCOUNT_KEY);
      else localStorage.setItem(CART_DISCOUNT_KEY, presetCode);
    } catch {
      /* storage unavailable */
    }
  }, [presetCode]);

  const orderLines = useMemo(() => lines.map((l) => ({ ...l.recipe, quantity: l.quantity })), [lines]);

  const baseSubtotal = useMemo(() => {
    const r = quoteOrder({ lines: orderLines }, { menu, vatRateBps: VAT_RATE_BPS, limits: DEFAULT_LIMITS, presets: [] });
    return r.ok ? r.unwrap().subtotal : null;
  }, [orderLines, menu]);

  // Removal rules; waits for the presets so a slow or failed load never throws the choice away.
  useEffect(() => {
    if (presets === undefined || presetCode === null) return;
    if (lines.length === 0) {
      setPresetCode(null);
      return;
    }
    const preset = presets.find((p) => p.code === presetCode);
    if (!preset) {
      setPresetCode(null);
      setDiscountNotice({ kind: 'unavailable' });
    } else if (baseSubtotal !== null && !isPresetEligible(preset, baseSubtotal)) {
      setPresetCode(null);
      setDiscountNotice({ kind: 'minSpend', preset });
    }
  }, [presets, presetCode, lines.length, baseSubtotal]);

  const input = useMemo<OrderInput>(() => {
    const preset = presets?.find((p) => p.code === presetCode);
    const applied = preset && baseSubtotal !== null && isPresetEligible(preset, baseSubtotal);
    return applied ? { lines: orderLines, discount: { presetCode: preset.code } } : { lines: orderLines };
  }, [orderLines, presets, presetCode, baseSubtotal]);

  const quote = useMemo(
    () => quoteOrder(input, { menu, vatRateBps: VAT_RATE_BPS, limits: DEFAULT_LIMITS, presets: presets ?? [] }),
    [input, menu, presets],
  );

  const lineViews = useMemo(
    () =>
      lines.map((l) => {
        // The cup limit is an order-level rule, so lift it for per-line display.
        const r = quoteOrder(
          { lines: [{ ...l.recipe, quantity: l.quantity }] },
          { menu, vatRateBps: VAT_RATE_BPS, limits: { ...DEFAULT_LIMITS, maxCups: Infinity }, presets: [] },
        );
        return r.ok ? r.unwrap().lines[0] : undefined;
      }),
    [lines, menu],
  );

  return { lines, presetCode, setDiscount, discountNotice, baseSubtotal, input, dispatch, quote, lineViews };
}
