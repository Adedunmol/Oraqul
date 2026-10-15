// UTC on purpose: the server and the browser must print the same day, or hydration breaks.
const day = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Oct 8" from an ISO timestamp. */
export function formatDay(iso: string): string {
  return day.format(new Date(iso));
}

export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n} ${n === 1 ? one : many}`;
