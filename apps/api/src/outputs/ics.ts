// A calendar file (RFC 5545) of a plan's dates. Titles and dates only: notes, findings and receipts
// never go in, because the subscribable feed is read by a calendar app with nothing but a token.

export interface IcsEvent {
  /** Stable across downloads, so a calendar app updates an event instead of duplicating it. */
  uid: string;
  /** `YYYY-MM-DD` */
  date: string;
  /** Last day, inclusive. Defaults to `date`. */
  endDate?: string;
  title: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// Date.parse rolls 2027-02-30 over to March, so a real day is one that survives the round trip.
export const isIsoDay = (value: string | null | undefined): value is string => {
  if (typeof value !== 'string' || !ISO_DAY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const compact = (day: string) => day.replaceAll('-', '');

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const escapeText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, ';').replace(/,/g, '\\,');

/** Content lines are folded at 75 octets, continuing with a space, never inside a UTF-8 character. */
export function fold(line: string): string {
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = Buffer.byteLength(char);
    const limit = out.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function buildIcs(input: { name: string; events: IcsEvent[]; now?: Date }): string {
  const stamp = (input.now ?? new Date())
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Oraqul//Launch calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(input.name)}`,
  ];
  const seen = new Set<string>();
  for (const event of input.events) {
    if (!isIsoDay(event.date) || seen.has(event.uid)) continue;
    seen.add(event.uid);
    const last =
      event.endDate && isIsoDay(event.endDate) && event.endDate >= event.date
        ? event.endDate
        : event.date;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}@oraqul`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(event.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(last))}`,
      `SUMMARY:${escapeText(event.title)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
