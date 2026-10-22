const bangkokDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Business date 'YYYY-MM-DD' in Asia/Bangkok (R§10.1). */
export function businessDate(now: Date): string {
  return bangkokDate.format(now);
}

/** Calendar arithmetic on a 'YYYY-MM-DD' string. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** How many days back the order list reaches (R§14). */
export const ORDER_HISTORY_DAYS = 7;

/** `[today, today − 1, …, today − ORDER_HISTORY_DAYS]`. */
export function historyDates(today: string): string[] {
  return Array.from({ length: ORDER_HISTORY_DAYS + 1 }, (_, i) => addDays(today, -i));
}
