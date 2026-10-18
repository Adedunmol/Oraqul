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
