import { businessDate } from '../src/common/clock';

describe('businessDate (Asia/Bangkok)', () => {
  it('stays on the same day at 23:59:59 Bangkok', () => {
    expect(businessDate(new Date('2026-10-21T16:59:59Z'))).toBe('2026-10-21');
  });
  it('rolls over at midnight Bangkok (17:00Z)', () => {
    expect(businessDate(new Date('2026-10-21T17:00:00Z'))).toBe('2026-10-22');
  });
});
