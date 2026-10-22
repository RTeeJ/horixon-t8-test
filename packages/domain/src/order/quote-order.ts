import type { DomainError } from '../errors';
import type { DrinkComponent } from '../drink/describe';
import { components, describe } from '../drink/describe';
import { DrinkBuilder } from '../drink/drink-builder';
import type { Limits } from '../drink/drink-builder';
import type { Menu } from '../menu/menu';
import { Money } from '../money/money';
import { extractVat } from '../money/vat';
import { Result } from '../result';
import { resolveDiscount } from '../discount/preset';
import type { DiscountPreset } from '../discount/preset';

export interface LineInput {
  base: string;
  size: string;
  addOns: { code: string; count: number }[];
  quantity: number;
}

export interface OrderInput {
  lines: LineInput[];
  discount?: { presetCode: string };
}

export interface QuoteContext {
  menu: Menu;
  vatRateBps: number;
  limits: Limits;
  presets: DiscountPreset[];
}

export interface QuotedLine {
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
  descriptionEn: string;
  descriptionTh: string;
  components: DrinkComponent[];
}

export interface OrderQuote {
  lines: QuotedLine[];
  subtotal: Money;
  discount?: { preset: DiscountPreset; amount: Money };
  total: Money;
  vat: Money;
  beforeVat: Money;
  vatRateBps: number;
}

/** Validates every line (V6, V7) and prices the order: subtotal -> discount -> total -> VAT (R§6, R§8, R§9). */
export function quoteOrder(input: OrderInput, ctx: QuoteContext): Result<OrderQuote> {
  if (input.lines.length === 0) return Result.err([{ code: 'ORDER_EMPTY' }]);

  const errors: DomainError[] = [];
  const built: { line: LineInput; drink: ReturnType<ReturnType<DrinkBuilder['build']>['unwrap']> }[] = [];
  let cups = 0;

  // Validate everything first; price only once the order is known to be valid,
  // so absurd quantities can never overflow Money.
  input.lines.forEach((line, index) => {
    const validQty = Number.isInteger(line.quantity) && line.quantity >= 1;
    if (validQty) cups += line.quantity;
    else errors.push({ code: 'INVALID_QUANTITY', line: index, params: { field: 'quantity' } });

    const builder = DrinkBuilder.on(ctx.menu, ctx.limits).base(line.base).size(line.size);
    for (const a of line.addOns) builder.add(a.code, a.count);
    const result = builder.build();
    if (!result.ok) {
      errors.push(...result.errors.map((e) => ({ ...e, line: index })));
      return;
    }
    if (validQty) built.push({ line, drink: result.unwrap() });
  });

  if (cups > ctx.limits.maxCups) {
    errors.push({ code: 'ORDER_CUP_LIMIT_EXCEEDED', params: { max: ctx.limits.maxCups } });
  }
  if (errors.length > 0) return Result.err(errors);

  const lines: QuotedLine[] = built.map(({ line, drink }) => {
    const unitPrice = drink.cost();
    return {
      quantity: line.quantity,
      unitPrice,
      lineTotal: unitPrice.times(line.quantity),
      descriptionEn: describe(drink, 'en'),
      descriptionTh: describe(drink, 'th'),
      components: components(drink),
    };
  });

  const subtotal = lines.reduce((sum, l) => sum.add(l.lineTotal), Money.zero());
  let discount: OrderQuote['discount'];
  if (input.discount) {
    const resolved = resolveDiscount(input.discount.presetCode, ctx.presets, subtotal, lines);
    if (!resolved.ok) return Result.err(resolved.errors);
    discount = resolved.unwrap();
  }
  const total = discount ? subtotal.subtract(discount.amount) : subtotal;
  const { vat, beforeVat } = extractVat(total, ctx.vatRateBps);
  return Result.ok({ lines, subtotal, ...(discount && { discount }), total, vat, beforeVat, vatRateBps: ctx.vatRateBps });
}
