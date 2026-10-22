import { Money, roundHalfUpDiv } from './money';

/** Extract VAT included in a VAT-inclusive total. rateBps: 700 = 7%. */
export function extractVat(total: Money, rateBps: number): { vat: Money; beforeVat: Money } {
  const rate = BigInt(rateBps);
  const vatSatang = roundHalfUpDiv(BigInt(total.toSatang()) * rate, 10000n + rate);
  const vat = Money.fromSatang(Number(vatSatang));
  return { vat, beforeVat: total.subtract(vat) };
}
