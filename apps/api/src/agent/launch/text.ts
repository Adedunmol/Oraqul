import { type AgeBand, BAND_RANGES } from './read-core.js';

export function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

export function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function plural(word: string): string {
  const lower = word.toLowerCase();
  if (/(ch|sh|s|x)$/.test(lower)) return `${lower}es`;
  if (/[^aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ies`;
  return `${lower}s`;
}

/** The team's age bands as a phrase: "aged 34 and under", "aged 25 to 44". */
export function agesPhrase(bands: AgeBand[]): string {
  if (bands.length === 0) return 'any age';
  const low = Math.min(...bands.map((b) => BAND_RANGES[b][0]));
  const high = Math.max(...bands.map((b) => BAND_RANGES[b][1]));
  if (low === 0) return `aged ${high} and under`;
  if (high >= 200) return `aged ${low} and over`;
  return `aged ${low} to ${high}`;
}

const DATED = [
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b[A-Za-z]{3,9}\.? \d{1,2},? \d{4}\b/,
  /\b\d{1,2} [A-Za-z]{3,9}\.? \d{4}\b/,
];

/** A release date as `YYYY-MM-DD`, only when the window names a day. A month or a quarter is not. */
export function releaseDate(window: string | null): string | null {
  const written = window ? DATED.map((p) => window.match(p)?.[0]).find(Boolean) : null;
  if (!written) return null;
  const t = Date.parse(`${written} UTC`);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}
