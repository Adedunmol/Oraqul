import { cityBox, cityCountry, cityNames } from '@oraqul/engine';
import type { LaunchModuleKey } from '@oraqul/schema';
import { z } from 'zod';
import { normalise } from '../router/decide.js';
import type { LaunchRead } from './read-core.js';

/** The part of a query plan every category's pipeline reads: its cities and the Qloo shape. */
export interface QueryPlanCore {
  /** Which catalog queries run, by key. */
  queries: string[];
  /** The team's cities with the home market first, then the rest in the team's order. */
  cities: string[];
  /** Table cities near the team's, ranked in the same call, only ever shown as "Worth a look". */
  worthALook: string[];
  /** The launch's country of origin, for the release country filter. */
  country: string | null;
  /**
   * Neighbourhoods inside the team's cities with their centres, to read from the same heatmap
   * (no extra Qloo call). The model names them; Qloo says which the audience is strongest in.
   */
  areas: { city: string; name: string; latitude: number; longitude: number }[];
  /**
   * Brands that could realistically partner with an independent launch, per city. Qloo ranks only
   * these, so a giant that would never say yes cannot be the answer.
   */
  brandCandidates: { city: string; names: string[] }[];
}

export interface QueryPlanInput<R extends LaunchRead = LaunchRead> {
  title: string;
  read: R;
  modules: LaunchModuleKey[];
  /** The comps' most common release country, from their Qloo matches. */
  compsCountry: string | null;
}

export interface QueryPlanner<
  R extends LaunchRead = LaunchRead,
  P extends QueryPlanCore = QueryPlanCore,
> {
  plan(input: QueryPlanInput<R>): Promise<{ plan: P; tokens: number }>;
}

/** The team's cities, home market first: the country of origin leads, then the team's order. */
export function orderCities(places: string[], country: string | null): string[] {
  if (!country) return places;
  const home = places.filter((p) => cityCountry(p) === country);
  return [...home, ...places.filter((p) => !home.includes(p))];
}

// Short words only, so no sentence or personal detail can reach Qloo through a phrase. Checked
// in code, not in the schema: some providers reject a text pattern in a schema.
const PHRASE = /^[\p{L}\p{N} &'-]{1,40}$/u;
/** A model-written phrase: at most 40 characters. */
export const phrase = z.string().max(40);

export function phrases(list: string[]): string[] {
  return list.map((p) => p.trim()).filter((p) => PHRASE.test(p));
}

const MAX_AREAS_PER_CITY = 5;
const MAX_BRAND_CANDIDATES = 4;
export const MAX_WORTH = 4;

/** What the model may say about neighbourhoods and brands, in the shape both planners share. */
export const areaChoiceSchema = z.object({
  city: z.string(),
  name: phrase,
  latitude: z.number(),
  longitude: z.number(),
});
export const brandChoiceSchema = z.object({ city: z.string(), names: z.array(phrase).max(4) });

/** Keeps only the team's own cities from a model's list, in its order, with no repeats. */
export function teamCities(list: string[], cities: string[]): string[] {
  return list.flatMap((c) => cities.find((t) => normalise(t) === normalise(c)) ?? []);
}

/** "Worth a look" must be table cities the team did not name. */
export function checkWorth(chosen: string[], cities: string[], fallback: string[]): string[] {
  const table = cityNames();
  const worth = chosen
    .flatMap((c) => table.find((t) => normalise(t) === normalise(c)) ?? [])
    .filter((c) => !cities.some((t) => normalise(t) === normalise(c)));
  return worth.length ? [...new Set(worth)].slice(0, MAX_WORTH) : fallback;
}

// Keeps a neighbourhood only when its city is one of the team's, its name is a short plain name,
// and its centre is inside that city's box, so a wrong coordinate cannot read another place.
export function checkAreas(
  chosen: z.infer<typeof areaChoiceSchema>[],
  cities: string[],
): QueryPlanCore['areas'] {
  const kept: QueryPlanCore['areas'] = [];
  for (const area of chosen) {
    const city = cities.find((c) => normalise(c) === normalise(area.city));
    const box = city ? cityBox(city) : null;
    if (!city || !box || phrases([area.name]).length === 0) continue;
    const inside =
      area.longitude >= box.west &&
      area.longitude <= box.east &&
      area.latitude >= box.south &&
      area.latitude <= box.north;
    const same = (a: { city: string; name: string }) =>
      a.city === city && normalise(a.name) === normalise(area.name);
    if (!inside || kept.some(same)) continue;
    if (kept.filter((a) => a.city === city).length >= MAX_AREAS_PER_CITY) continue;
    kept.push({ city, name: area.name.trim(), latitude: area.latitude, longitude: area.longitude });
  }
  return kept;
}

export function checkBrandCandidates(
  chosen: z.infer<typeof brandChoiceSchema>[],
  cities: string[],
): QueryPlanCore['brandCandidates'] {
  return chosen.flatMap(({ city, names }) => {
    const team = cities.find((c) => normalise(c) === normalise(city));
    const seen = new Set<string>();
    // The first spelling of a name is the one kept.
    const kept = phrases(names)
      .filter((n) => !seen.has(normalise(n)) && seen.add(normalise(n)))
      .slice(0, MAX_BRAND_CANDIDATES);
    return team && kept.length ? [{ city: team, names: kept }] : [];
  });
}

export class FallbackQueryPlanner<R extends LaunchRead, P extends QueryPlanCore>
  implements QueryPlanner<R, P>
{
  constructor(
    private readonly primary: QueryPlanner<R, P>,
    private readonly fallback: QueryPlanner<R, P>,
    private readonly onError: (err: unknown) => void,
  ) {}

  async plan(input: QueryPlanInput<R>) {
    try {
      return await this.primary.plan(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.plan(input);
    }
  }
}
