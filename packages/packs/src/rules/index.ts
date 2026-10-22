import type { Category } from '@oraqul/schema';
import { BOOKS_RULES } from './books';
import { FILM_RULES } from './film';
import { GAMES_RULES } from './games';
import { MUSIC_RULES } from './music';
import { PODCASTS_RULES } from './podcasts';
import { COUNTRY_CHANNELS } from './shared';
import type { RuleLibrary } from './types';

export * from './shared';
export type { Benchmark, Rule, RuleLibrary, RuleSource, SignalRule } from './types';
export { BOOKS_RULES, FILM_RULES, GAMES_RULES, MUSIC_RULES, PODCASTS_RULES };

export const rules: Record<Category, RuleLibrary> = {
  film: FILM_RULES,
  music: MUSIC_RULES,
  books: BOOKS_RULES,
  podcasts: PODCASTS_RULES,
  games: GAMES_RULES,
};

/** The channels that lead in a market: the country's own first, then the category's. */
export function leadChannels(category: Category, country: string | null): string[] {
  const own = country ? (COUNTRY_CHANNELS[country.toLowerCase()] ?? []) : [];
  const all = [...own, ...rules[category].channels.value];
  return all.filter((c, i) => all.indexOf(c) === i);
}
