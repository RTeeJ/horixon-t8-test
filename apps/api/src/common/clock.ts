export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** A clock that only moves when told to: the test harness and the demo-order seed set it per step. */
export class FixedClock implements Clock {
  constructor(public current: Date) {}
  now(): Date { return this.current; }
  set(d: Date): void { this.current = d; }
}

export { businessDate } from '@coffee/domain';
