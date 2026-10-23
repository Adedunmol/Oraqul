import { citiesNear, cityCountry, cityNames } from '@oraqul/engine';
import { brandCategoriesFor, filmPlan } from '@oraqul/packs';
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
import type { FilmRead } from './read.js';

export { orderCities };

const { FILM_QUERIES, MAX_CITIES_PER_QUERY } = filmPlan;
type FilmQueryKey = filmPlan.FilmQueryKey;

/**
 * What to ask Qloo, after code has checked it: which catalog queries run and the context that
 * shapes each. Phrases are resolved to Qloo tags before any query uses them.
 */
export const queryPlanSchema = z.object({
  queries: z.array(z.enum(filmPlan.filmQueryKeys)),
  /** The team's cities with the home market first, then the rest in the team's order. */
  cities: z.array(z.string()),
  /** Table cities near the team's, ranked in the same call, only ever shown as "Worth a look". */
  worthALook: z.array(z.string()),
  /** The launch's country of origin, for the release country filter. */
  country: z.string().nullable(),
  musicScene: z.string().nullable(),
  musicCities: z.array(z.string()),
  showCities: z.array(z.string()),
  brandCategories: z.array(z.string()),
  brandCities: z.array(z.string()),
  /** A genre phrase for films when there is no country to filter by. */
  filmGenre: z.string().nullable(),
  podcastGenre: z.string().nullable(),
  podcastCity: z.string().nullable(),
  communityPlaces: z.array(z.string()),
  communityCities: z.array(z.string()),
  /** Cities the games query asks about: the home market and one away. */
  gameCities: z.array(z.string()),
  venuePlaces: z.array(z.string()),
  venueCities: z.array(z.string()),
  /**
   * Neighbourhoods inside the team's cities with their centres, to read from the same heatmap
   * (no extra Qloo call). The model names them; Qloo says which the audience is strongest in.
   */
  areas: z.array(
    z.object({ city: z.string(), name: z.string(), latitude: z.number(), longitude: z.number() }),
  ),
  /**
   * Brands that could realistically partner with an independent film, per city. Qloo ranks only
   * these, so a giant that would never say yes cannot be the answer.
   */
  brandCandidates: z.array(z.object({ city: z.string(), names: z.array(z.string()) })),
});
export type QueryPlan = z.infer<typeof queryPlanSchema> & QueryPlanCore;

export type QueryPlanInput = LaunchPlanInput<FilmRead>;
export type QueryPlanner = LaunchQueryPlanner<FilmRead, QueryPlan>;

/** Which catalog queries a plan with these modules runs (spec §4.1). */
export function queriesFor(modules: LaunchModuleKey[], read: FilmRead): FilmQueryKey[] {
  return filmPlan.filmQueryKeys.filter((key) => {
    const spec = FILM_QUERIES[key];
    if (key === 'cinemas') return read.route !== 'streaming';
    return spec.for === 'core' || modules.includes(spec.for);
  });
}

/** The defaults: the pack's tables applied to the brief. Also the scripted planner's answer. */
export function defaultPlan(input: QueryPlanInput): QueryPlan {
  const { read, modules } = input;
  const country = read.country ?? input.compsCountry;
  const cities = orderCities(read.places, country);
  const home = cities.filter((c) => country !== null && cityCountry(c) === country);
  const away = cities.filter((c) => !home.includes(c));
  const scene = country ? (filmPlan.MUSIC_SCENES[country.toLowerCase()] ?? null) : null;
  const genre = read.genre ?? read.logline ?? '';
  return {
    queries: queriesFor(modules, read),
    cities,
    worthALook: citiesNear(cities, 4),
    country,
    musicScene: scene,
    // Every city the team chose gets the same questions, so none is left with less than another.
    musicCities: cities,
    showCities: cities,
    brandCategories: brandCategoriesFor('film'),
    brandCities: [home[0] ?? cities[0], away[0]]
      .filter((c): c is string => !!c)
      .filter((c, i, all) => all.indexOf(c) === i),
    filmGenre: country ? null : (read.genre ?? null),
    podcastGenre: filmPlan.PODCAST_GENRES.find((g) => g.match.test(genre))?.phrase ?? null,
    podcastCity: away[0] ?? cities[0] ?? null,
    communityPlaces: filmPlan.COMMUNITY_PLACES,
    communityCities: cities,
    gameCities: [home[0] ?? cities[0], away[0]]
      .filter((c): c is string => !!c)
      .filter((c, i, all) => all.indexOf(c) === i),
    venuePlaces: filmPlan.VENUE_PLACES,
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
  musicScene: phrase.nullable(),
  musicCities: z.array(z.string()).max(5),
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

export const QUERY_PLAN_SYSTEM = `You shape the questions Oraqul asks Qloo, a taste data API, for a film or series launch. Oraqul describes the launch by its comps (comparable titles) and asks what their audience likes. On its own that drifts to what is popular overall; context makes it sharp. You pick the context from your knowledge of the launch's culture and markets.

You are given the brief and default choices. Return the choices, changed only where your knowledge of this launch makes them sharper.

- musicScene: the music genre the launch's audience in its home market and diaspora plays, as a short genre name ("afrobeats", "amapiano", "k-pop", "drill", "reggaeton"). Null if none fits.
- musicCities, showCities, brandCities, communityCities, podcastCity: only cities from the team's list. Up to ${MAX_CITIES_PER_QUERY}. Put the cities where the answer matters most first: the home market for music and brands, diaspora markets for series and community.
- brandCategories: short brand category names whose brands operate in these cities and fit a release tie-in ("telecom", "beverage", "rideshare", "banking"). Never luxury.
- filmGenre: a genre name for the recent-films query, only when there is no country of origin.
- podcastGenre: a podcast genre that fits the launch ("true crime", "comedy", "pop culture").
- communityPlaces: kinds of place where this audience gathers in the diaspora cities ("church", "university", "event venue").
- areas: for each of the team's cities, up to 5 neighbourhoods or districts where this community lives, goes out or gathers (for Nigerian diaspora: Peckham, Croydon and Thamesmead in London; Sugar Land and Alief in Houston; Stonecrest and Lithonia in Atlanta), each with the latitude and longitude of its centre. Real, well-known places only, inside the city. Qloo then says which the audience is strongest in.
- brandCandidates: for each of the team's cities, up to 4 brands that operate in that city and could realistically partner with an independent film as an in-kind or co-promotion tie-in: telecoms, ride-hailing, fintech, food delivery, drinks and challenger brands. Write each as the company's usual name ("MTN", "Bolt"). Never a global giant that does not do small tie-ins (soft-drink and fast-food majors, car and luxury brands). Qloo then ranks only these, per city, for the audience.
- worthALook: up to 4 other cities from the city table where this audience may be strong. They are only shown as alternatives, never in place of the team's cities.
- country: the launch's country of origin as a full name, or null.

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
      `Launch: ${input.title} (${read.format ?? 'film or series'})`,
      read.genre ? `Genre: ${read.genre}` : '',
      read.logline ? `About: ${read.logline}` : '',
      read.country ? `Country of origin: ${read.country}` : '',
      read.language ? `Language: ${read.language}` : '',
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
export function checkPlan(chosen: z.infer<typeof modelPlanSchema>, defaults: QueryPlan): QueryPlan {
  const team = (list: string[]) => teamCities(list, defaults.cities);
  const keep = (list: string[], fallback: string[]) => {
    const kept = [...new Set(team(list))].slice(0, MAX_CITIES_PER_QUERY);
    return kept.length ? kept : fallback;
  };
  return {
    ...defaults,
    country: defaults.country ?? chosen.country,
    musicScene: phrases([chosen.musicScene ?? ''])[0] ?? defaults.musicScene,
    musicCities: keep(chosen.musicCities, defaults.musicCities),
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

export class FallbackQueryPlanner extends LaunchFallbackPlanner<FilmRead, QueryPlan> {}
