/** Integer division rounded half up (halves round away from zero for negatives). */
export function roundHalfUpDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('denominator must be positive');
  const negative = numerator < 0n;
  const n = negative ? -numerator : numerator;
  const q = (2n * n + denominator) / (2n * denominator);
  return negative ? -q : q;
}

const DECIMAL = /^-?\d+(\.\d{1,2})?$/;

export class Money {
  private constructor(private readonly satang: number) {}

  static of(decimal: string): Money {
    if (typeof decimal !== 'string' || !DECIMAL.test(decimal)) {
      throw new Error(`Invalid money amount: ${JSON.stringify(decimal)}`);
    }
    const negative = decimal.startsWith('-');
    const [whole, frac = ''] = decimal.replace('-', '').split('.');
    const abs = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
    return Money.fromSatang(negative ? -abs : abs);
  }

  static fromSatang(satang: number): Money {
    if (!Number.isSafeInteger(satang)) throw new Error(`Invalid satang value: ${satang}`);
    return new Money(satang === 0 ? 0 : satang);
  }

  static zero(): Money {
    return new Money(0);
  }

  add(o: Money): Money {
    return Money.fromSatang(this.satang + o.satang);
  }

  subtract(o: Money): Money {
    return Money.fromSatang(this.satang - o.satang);
  }

  times(n: number): Money {
    if (!Number.isInteger(n)) throw new Error(`Money.times requires an integer, got ${n}`);
    return Money.fromSatang(this.satang * n);
  }

  compare(o: Money): -1 | 0 | 1 {
    return this.satang < o.satang ? -1 : this.satang > o.satang ? 1 : 0;
  }

  equals(o: Money): boolean {
    return this.satang === o.satang;
  }

  isZero(): boolean {
    return this.satang === 0;
  }

  toSatang(): number {
    return this.satang;
  }

  toString(): string {
    const abs = Math.abs(this.satang);
    const frac = String(abs % 100).padStart(2, '0');
    return `${this.satang < 0 ? '-' : ''}${Math.floor(abs / 100)}.${frac}`;
  }

  format(): string {
    const abs = Math.abs(this.satang);
    const num = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs / 100);
    return `${this.satang < 0 ? '-' : ''}฿${num}`;
  }
}
