import type { ActualRow, ActualsPreview } from '@oraqul/schema';
import { isIsoDay } from '../outputs/ics.js';

const MAX_ROWS = 2000;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A day written as 2027-03-12, 2027/03/12, 12 Mar 2027 or Mar 12, 2027. A slash date such as
 * 03/04/2027 is refused: it is a different day in different countries, and a wrong day shifts the
 * pace read, so the person is asked to write it unambiguously.
 */
export function parseDay(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, ' ');
  let iso: string | null = null;
  let m = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) iso = `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  m = text.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,9}),? (\d{4})$/i);
  if (!iso && m) {
    const month = MONTHS.indexOf((m[2] ?? '').slice(0, 3).toLowerCase());
    if (month >= 0) iso = `${m[3]}-${pad(month + 1)}-${pad(Number(m[1]))}`;
  }
  m = text.match(/^([a-z]{3,9}) (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/i);
  if (!iso && m) {
    const month = MONTHS.indexOf((m[1] ?? '').slice(0, 3).toLowerCase());
    if (month >= 0) iso = `${m[3]}-${pad(month + 1)}-${pad(Number(m[2]))}`;
  }
  return iso && isIsoDay(iso) ? iso : null;
}

export function parseValue(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/[\s,%]/g, '')
    .replace(/^[$£€₦]/, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** Splits one line on a comma, tab or semicolon, keeping quoted fields whole. */
export function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i] ?? '';
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      out.push(field);
      field = '';
    } else field += c;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

function delimiterOf(lines: string[]): string {
  const sample = lines.slice(0, 5).join('\n');
  for (const d of ['\t', ';', ',']) if (sample.includes(d)) return d;
  return ' ';
}

const looksLikeHeader = (cells: string[]) =>
  cells.length > 0 && parseDay(cells[0] ?? '') === null && !cells.some((c) => parseDay(c));

function guess(columns: string[]): NonNullable<ActualsPreview['mapping']> {
  const find = (re: RegExp, not: string[] = []) =>
    columns.find((c) => re.test(c) && !not.includes(c)) ?? null;
  const date = find(/date|day/i) ?? columns[0] ?? '';
  const city = find(/city|place|market|region|territory/i, [date]);
  const channel = find(/channel|source|platform/i, [date, city ?? '']);
  const value =
    find(
      /value|count|total|sales|tickets|screenings|presales|saves|downloads|wishlists|number|amount/i,
      [date, city ?? '', channel ?? ''],
    ) ??
    columns.find((c) => c !== date && c !== city && c !== channel) ??
    '';
  return { date, value, city, channel };
}

/**
 * Reads pasted lines or CSV into dated figures. Only the date, the value and, if mapped, the city
 * and channel columns are kept: anything else in a file is dropped here, before it is saved.
 */
export function parseActuals(
  text: string,
  mapping: ActualsPreview['mapping'] = null,
): ActualsPreview {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Pasted lines may mix a comma and a tab, so each is split on its own; a file with a header is
  // split the way its header is.
  const headDelimiter = delimiterOf(lines.slice(0, 1));
  const splitWith = (l: string, d: string) => (d === ' ' ? l.split(/\s+/) : splitLine(l, d));
  const first = lines[0] ? splitWith(lines[0], headDelimiter) : [];
  const header = first.length > 1 && looksLikeHeader(first);
  const split = (l: string) => splitWith(l, header ? headDelimiter : delimiterOf([l]));
  const columns = header ? first : null;
  const used = header ? (mapping ?? guess(first)) : null;

  const at = (name: string | null | undefined, cells: string[]) => {
    if (!name || !columns) return undefined;
    const i = columns.indexOf(name);
    return i >= 0 ? cells[i] : undefined;
  };

  const rows: ActualRow[] = [];
  const errors: ActualsPreview['errors'] = [];
  lines.slice(header ? 1 : 0).forEach((line, n) => {
    const lineNo = n + 1 + (header ? 1 : 0);
    if (rows.length >= MAX_ROWS) {
      if (errors.length === 0 || errors.at(-1)?.line !== -1) {
        errors.push({ line: -1, message: `Only the first ${MAX_ROWS} rows are read.` });
      }
      return;
    }
    const cells = split(line);
    const dateText = used ? at(used.date, cells) : cells[0];
    const valueText = used ? at(used.value, cells) : cells[1];
    const onDate = dateText === undefined ? null : parseDay(dateText);
    if (!onDate) {
      errors.push({
        line: lineNo,
        message: `Could not read “${dateText ?? ''}” as a day. Write it as 2027-03-12 or 12 Mar 2027.`,
      });
      return;
    }
    const value = valueText === undefined ? null : parseValue(valueText);
    if (value === null) {
      errors.push({ line: lineNo, message: `Could not read “${valueText ?? ''}” as a number.` });
      return;
    }
    rows.push({
      onDate,
      value,
      city: (used ? at(used.city, cells) : cells[2]) ?? '',
      channel: (used ? at(used.channel, cells) : cells[3]) ?? '',
    });
  });
  return { columns, mapping: used, rows, errors };
}
