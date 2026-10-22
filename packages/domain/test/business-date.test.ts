import { addDays, businessDate, historyDates } from '../src/time/business-date';

it('uses the Bangkok date after 17:00 UTC', () => expect(businessDate(new Date('2026-10-21T17:30:00Z'))).toBe('2026-10-22'));
it('adds days across months', () => expect(addDays('2026-11-01', -1)).toBe('2026-10-31'));
it('lists today and 7 days back', () => expect(historyDates('2026-10-22')).toEqual(
  ['2026-10-22', '2026-10-21', '2026-10-20', '2026-10-19', '2026-10-18', '2026-10-17', '2026-10-16', '2026-10-15']));
