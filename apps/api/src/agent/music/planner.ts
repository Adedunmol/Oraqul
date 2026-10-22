import { citiesNear, cityCountry, cityNames } from '@oraqul/engine';
import { musicPlan } from '@oraqul/packs';
import type { LaunchModuleKey } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import {
  areaChoiceSchema,
  brandChoiceSchema,
  checkAreas,
  checkBrandCandidates,
  checkWorth,
  FallbackQueryPlanner as LaunchFallbackPlanner,
  type QueryPlanInput as LaunchPlanInput,
  type QueryPlanner as LaunchQueryPlanner,
  orderCities,
  phrase,
  phrases,
  type QueryPlanCore,
  teamCities,
} from '../launch/planner.js';
import type { MusicRead } from './read.js';

const { MUSIC_QUERIES, MAX_CITIES_PER_QUERY } = musicPlan;
type MusicQueryKey = musicPlan.MusicQueryKey;

/**
 * What to ask Qloo, after code has checked it: which catalog queries run and the context that
 * shapes each. Phrases are resolved to Qloo tags before any query uses them.
 */
export interface MusicQueryPlan extends QueryPlanCore {
  queries: MusicQueryKey[];
  /** The artist's country, for the release country filter on films. */
  country: string | null;
  /** The sound, as a phrase to resolve to a music tag. No scene: support acts are not asked. */
  scene: string | null;
  supportCities: string[];
  showCities: string[];
  brandCategories: string[];
  brandCities: string[];
  /** A genre phrase for films when there is no country to filter by. */
  filmGenre: string | null;
  podcastGenre: string | null;
  podcastCity: string | null;
  communityPlaces: string[];
  communityCities: string[];
  venuePlaces: string[];
  venueCities: string[];
}

export type QueryPlanInput = LaunchPlanInput<MusicRead>;
export type QueryPlanner = LaunchQueryPlanner<MusicRead, MusicQueryPlan>;

/** Which catalog queries a plan with these modules runs (spec §4.2). */
export function queriesFor(modules: LaunchModuleKey[]): MusicQueryKey[] {
  return musicPlan.musicQueryKeys.filter((key) => {
    const spec = MUSIC_QUERIES[key];
    return spec.for === 'core' || modules.includes(spec.for);
  });
}

/** The defaults: the pack's tables applied to the brief. Also the scripted planner's answer. */
export function defaultPlan(input: QueryPlanInput): MusicQueryPlan {
  const { read, modules } = input;
  const country = read.country ?? input.compsCountry;
  const cities = orderCities(read.places, country);
  const home = cities.filter((c) => country !== null && cityCountry(c) === country);
  const away = cities.filter((c) => !home.includes(c));
  const scene =
    phrases([read.genre ?? ''])[0] ??
    (country ? (musicPlan.MUSIC_SCENES[country.toLowerCase()] ?? null) : null);
  const genre = read.genre ?? '';
  return {
    queries: queriesFor(modules),
    cities,
    worthALook: citiesNear(cities, 4),
    country,
    scene,
    // Every city the team chose gets the same questions, so none is left with less than another.
    supportCities: cities,
    showCities: cities,
    brandCategories: musicPlan.BRAND_CATEGORIES,
    brandCities: [home[0] ?? cities[0], away[0]]
      .filter((c): c is string => !!c)
      .filter((c, i, all) => all.indexOf(c) === i),
    filmGenre: country ? null : (read.genre ?? null),
    podcastGenre: musicPlan.PODCAST_GENRES.find((g) => g.match.test(genre))?.phrase ?? null,
    podcastCity: away[0] ?? cities[0] ?? null,
    communityPlaces: musicPlan.MUSIC_COMMUNITY_PLACES,
    communityCities: cities,
    venuePlaces: musicPlan.MUSIC_VENUE_PLACES,
    venueCities: cities,
    areas: [],
    brandCandidates: [],
  };
}

export class ScriptedQueryPlanner implements QueryPlanner {
  async plan(input: QueryPlanInput) {
    return { plan: defaultPlan(input), tokens: 0 };
  }
}

// What the model may change about the defaults. Flat and nullable, for every provider.
const modelPlanSchema = z.object({
  scene: phrase.nullable(),
  supportCities: z.array(z.string()).max(5),
  showCities: z.array(z.string()).max(5),
  brandCategories: z.array(phrase).max(3),
  brandCities: z.array(z.string()).max(4),
  filmGenre: phrase.nullable(),
  podcastGenre: phrase.nullable(),
  podcastCity: z.string().nullable(),
  communityPlaces: z.array(phrase).max(3),
  communityCities: z.array(z.string()).max(5),
  worthALook: z.array(z.string()).max(4),
  country: z.string().nullable(),
  areas: z.array(areaChoiceSchema).max(20),
  brandCandidates: z.array(brandChoiceSchema).max(5),
});

export const QUERY_PLAN_SYSTEM = `You shape the questions Oraqul asks Qloo, a taste data API, for a music release or tour. Oraqul describes the launch by its artist and sound-alike artists and asks what their audience likes. On its own that drifts to what is popular overall; context makes it sharp. You pick the context from your knowledge of the artist's scene and markets.

You are given the brief and default choices. Return the choices, changed only where your knowledge of this launch makes them sharper.

- scene: the music genre of the artist's sound, as a short genre name ("afrobeats", "amapiano", "k-pop", "drill", "reggaeton"). Null if none fits.
- supportCities, showCities, brandCities, communityCities, podcastCity: only cities from the team's list. Up to ${MAX_CITIES_PER_QUERY}. Put the cities where the answer matters most first: the home market for support acts and brands, diaspora markets for series and campuses.
- brandCategories: short brand category names whose brands operate in these cities and fit a release or tour tie-in ("telecom", "beverage", "rideshare", "banking"). Never luxury.
- filmGenre: a genre name for the recent-films query, only when there is no country of origin.
- podcastGenre: a podcast genre that fits the artist ("music", "comedy", "pop culture").
- communityPlaces: kinds of place where this audience gathers ("university").
- areas: for each of the team's cities, up to 5 neighbourhoods or districts where this scene lives, goes out or gathers, each with the latitude and longitude of its centre. Real, well-known places only, inside the city. Qloo then says which the audience is strongest in.
- brandCandidates: for each of the team's cities, up to 4 brands that operate in that city and could realistically partner with an independent artist as an in-kind or co-promotion tie-in: telecoms, ride-hailing, fintech, food delivery, drinks and challenger brands. Write each as the company's usual name ("MTN", "Bolt"). Never a global giant that does not do small tie-ins (soft-drink and fast-food majors, car and luxury brands). Qloo then ranks only these, per city, for the audience.
- worthALook: up to 4 other cities from the city table where this audience may be strong. They are only shown as alternatives, never in place of the team's cities.
- country: the artist's country as a full name, or null.

Never name a person. Never use words from the brief that describe a private individual.`;

export class ModelQueryPlanner implements QueryPlanner {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async plan(input: QueryPlanInput) {
    const defaults = defaultPlan(input);
    const { read } = input;
    const brief = [
      `Launch: ${input.title} (${read.releaseType ?? 'release or tour'})`,
      read.genre ? `Sound: ${read.genre}` : '',
      read.featuredActs.length ? `Featured acts: ${read.featuredActs.join(', ')}` : '',
      read.country ? `Country: ${read.country}` : '',
      `Team's cities: ${defaults.cities.join(', ') || 'none'}`,
      read.ages.length ? `Age bands: ${read.ages.join(', ')}` : '',
      `City table: ${cityNames().join(', ')}`,
      `Defaults: ${JSON.stringify(defaults)}`,
    ].filter(Boolean);
    const { output, usage } = await generateText({
      model: this.model,
      system: QUERY_PLAN_SYSTEM,
      prompt: brief.join('\n'),
      output: Output.object({ schema: modelPlanSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { plan: checkPlan(output, defaults), tokens: usage.totalTokens ?? 0 };
  }
}

/**
 * Keeps the model's choices only where code allows them: cities must be the team's, "Worth a
 * look" must be table cities the team did not name, and a list left empty keeps the default.
 */
export function checkPlan(
  chosen: z.infer<typeof modelPlanSchema>,
  defaults: MusicQueryPlan,
): MusicQueryPlan {
  const team = (list: string[]) => teamCities(list, defaults.cities);
  const keep = (list: string[], fallback: string[]) => {
    const kept = [...new Set(team(list))].slice(0, MAX_CITIES_PER_QUERY);
    return kept.length ? kept : fallback;
  };
  return {
    ...defaults,
    country: defaults.country ?? chosen.country,
    scene: phrases([chosen.scene ?? ''])[0] ?? defaults.scene,
    supportCities: keep(chosen.supportCities, defaults.supportCities),
    showCities: keep(chosen.showCities, defaults.showCities),
    brandCategories: phrases(chosen.brandCategories).length
      ? phrases(chosen.brandCategories)
      : defaults.brandCategories,
    brandCities: keep(chosen.brandCities, defaults.brandCities),
    filmGenre: phrases([chosen.filmGenre ?? ''])[0] ?? defaults.filmGenre,
    podcastGenre: phrases([chosen.podcastGenre ?? ''])[0] ?? defaults.podcastGenre,
    podcastCity: team(chosen.podcastCity ? [chosen.podcastCity] : [])[0] ?? defaults.podcastCity,
    communityPlaces: phrases(chosen.communityPlaces).length
      ? phrases(chosen.communityPlaces)
      : defaults.communityPlaces,
    communityCities: keep(chosen.communityCities, defaults.communityCities),
    worthALook: checkWorth(chosen.worthALook, defaults.cities, defaults.worthALook),
    areas: checkAreas(chosen.areas, defaults.cities),
    brandCandidates: checkBrandCandidates(chosen.brandCandidates, defaults.cities),
  };
}

export class FallbackQueryPlanner extends LaunchFallbackPlanner<MusicRead, MusicQueryPlan> {}
