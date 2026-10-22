import type { DomainError } from './errors';

export class Result<T> {
  private constructor(
    readonly ok: boolean,
    readonly value: T | undefined,
    readonly errors: DomainError[],
  ) {}

  static ok<T>(value: T): Result<T> {
    return new Result<T>(true, value, []);
  }

  static err<T>(errors: DomainError[]): Result<T> {
    return new Result<T>(false, undefined, errors);
  }

  unwrap(): T {
    if (!this.ok) throw new Error(`Result is an error: ${this.errors.map((e) => e.code).join(', ')}`);
    return this.value as T;
  }
}
