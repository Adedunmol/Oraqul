import { citiesInCountry } from '@oraqul/engine';
import { gamesPlan } from '@oraqul/packs';
import { normalise } from '../router/decide.js';

/**
 * The table cities a region word stands for. The pack knows named regions (Europe, Southeast
 * Asia); any country the city table has a city in works too, so a country needs no entry here.
 */
export function regionCities(words: readonly string[], max = 8): string[] {
  const named = gamesPlan.citiesForRegions(words, max);
  const byCountry = words.flatMap((w) => citiesInCountry(w));
  return [...new Set([...named, ...byCountry])].slice(0, max);
}

/** Whether a word names a region we can rank: a named region, or a country with a table city. */
export function isRegionWord(word: string): boolean {
  return normalise(word) in gamesPlan.REGION_CITIES || citiesInCountry(word).length > 0;
}
