import { citiesNear, cityCountry, cityNames } from '@oraqul/engine';
import { brandCategoriesFor, podcastsPlan } from '@oraqul/packs';
import type { LaunchModuleKey } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import {
  brandChoiceSchema,
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
import { formatOf, kindOf, platformsOf } from './launch-kind.js';
import type { PodcastsRead } from './read.js';
import { regionCities } from './regions.js';

const { PODCASTS_QUERIES, MAX_CITIES_PER_QUERY, KIND_PROFILES } = podcastsPlan;
type PodcastsQueryKey = podcastsPlan.PodcastsQueryKey;

/**
 * What to ask Qloo, after code has checked it: which catalog queries run and the context that
 * shapes each. Phrases are resolved to Qloo tags before any query uses them.
 */
export interface PodcastsQueryPlan extends QueryPlanCore {
  queries: PodcastsQueryKey[];
  /** The producer's country. Podcasts have no release country filter, so it only orders cities. */
  country: string | null;
  kind: podcastsPlan.LaunchKind;
  format: podcastsPlan.Format;
  platforms: podcastsPlan.Platform[];
  /** Cities the team's region words stand for. They are ranked, never the team's own cities. */
  regionCities: string[];
  /**
   * The cities the per-city queries (brands, crossover, live shows) ask about: the team's own, or
   * with none the cities its regions stand for, or the kind's usual markets.
   */
  askCities: string[];
  /** A podcast genre phrase. It narrows the shows asked for and the shows the topic map compares. */
  genre: string | null;
  /** A broader genre asked when `genre` lists too few shows. */
  genreFallback: string | null;
  /** The one city the show lists are asked in. */
  showCity: string | null;
  brandCategories: string[];
  brandCities: string[];
  crossoverCity: string | null;
}

export type QueryPlanInput = LaunchPlanInput<PodcastsRead>;
export type QueryPlanner = LaunchQueryPlanner<PodcastsRead, PodcastsQueryPlan>;

/** Which catalog queries a plan with these modules runs (spec §4.4). */
export function queriesFor(modules: LaunchModuleKey[]): PodcastsQueryKey[] {
  return podcastsPlan.podcastsQueryKeys.filter((key) => {
    const spec = PODCASTS_QUERIES[key];
    return spec.for === 'core' || modules.includes(spec.for);
  });
}

/** The defaults: the pack's tables applied to the brief. Also the scripted planner's answer. */
export function defaultPlan(input: QueryPlanInput): PodcastsQueryPlan {
  const { read, modules } = input;
  const country = read.country ?? input.compsCountry;
  const cities = orderCities(read.places, country);
  const kind = kindOf(read).kind;
  const home = cities.filter((c) => country !== null && cityCountry(c) === country);
  const away = cities.filter((c) => !home.includes(c));
  // Cities a region word stands for are ranked, but never become the team's own assumptions.
  const regional = regionCities(read.regions).filter(
    (c) => !cities.some((t) => t.toLowerCase() === c.toLowerCase()),
  );
  const worthALook = [
    ...new Set([
      ...regional,
      ...(cities.length ? citiesNear(cities, 4) : []),
      ...(cities.length || regional.length ? [] : KIND_PROFILES[kind].defaultCities),
    ]),
  ].slice(0, 8);
  const askCities = cities.length ? cities : worthALook.slice(0, MAX_CITIES_PER_QUERY);
  // The markets and who the show is made for tell "football" in Lagos from "football" in Dallas.
  const market = [...read.regions, ...read.places, read.audienceNote, read.country]
    .filter(Boolean)
    .join(' ');
  // What the person said the show is about comes first; the title is only a last resort.
  const genre =
    (read.genre ? podcastsPlan.genrePhrase(`${read.genre} ${market}`) : null) ??
    podcastsPlan.genrePhrase(`${input.title} ${market}`);
  return {
    queries: queriesFor(modules),
    cities,
    // With no cities named, the usual markets are ranked and shown as the plan's markets.
    worthALook,
    country,
    kind,
    format: formatOf(read).format,
    regionCities: regional,
    askCities,
    platforms: platformsOf(read),
    genre,
    genreFallback: podcastsPlan.genreFallback(genre),
    showCity: away[0] ?? askCities[0] ?? null,
    brandCategories: brandCategoriesFor('podcasts'),
    brandCities: (cities.length ? [home[0] ?? cities[0], away[0]] : askCities.slice(0, 2))
      .filter((c): c is string => !!c)
      .filter((c, i, all) => all.indexOf(c) === i),
    crossoverCity: home[0] ?? askCities[0] ?? null,
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
  genre: phrase.nullable(),
  showCity: z.string().nullable(),
  crossoverCity: z.string().nullable(),
  brandCategories: z.array(phrase).max(3),
  brandCities: z.array(z.string()).max(4),
  worthALook: z.array(z.string()).max(4),
  brandCandidates: z.array(brandChoiceSchema).max(5),
});

export const QUERY_PLAN_SYSTEM = `You shape the questions Oraqul asks Qloo, a taste data API, for a podcast launch. Oraqul describes the launch by the show and its comparable shows and asks what their listeners like. On its own that drifts to what is popular overall; context makes it sharp. You pick the context from your knowledge of the show's subject and markets.

You are given the brief and default choices. Return the choices, changed only where your knowledge of this launch makes them sharper.

- genre: a podcast genre phrase that fits the show ("true crime", "comedy", "news", "business", "sports", "technology", "health", "music", "education", "tv and film"). It narrows the shows asked for. Null keeps the default.
- showCity, crossoverCity, brandCities: only cities from "Cities to ask about". Up to ${MAX_CITIES_PER_QUERY}.
- brandCategories: short brand category names whose brands fit a podcast sponsorship ("beverage", "telecom", "food delivery", "banking"). Never luxury.
- brandCandidates: for each of the cities to ask about, up to 4 brands that operate there and could realistically sponsor a new independent show: challenger banks, telecoms, food and drink, apps, local retailers. Write each as the company's usual name. Never a global giant that does no small sponsorships. Qloo then ranks only these, per city, for the listeners.
- worthALook: up to 4 other cities from the city table where this audience may be strong. They are only shown as alternatives, never in place of the team's cities.

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
      `Launch: ${input.title} (${defaults.kind}, ${defaults.format}, on ${defaults.platforms.join(', ')})`,
      read.genre ? `Subject: ${read.genre}` : '',
      read.style ? `Style: ${read.style}` : '',
      read.country ? `Producer country: ${read.country}` : '',
      `Team's cities: ${defaults.cities.join(', ') || 'none'}`,
      `Cities to ask about: ${defaults.askCities.join(', ') || 'none'}`,
      read.regions.length ? `Team's regions: ${read.regions.join(', ')}` : '',
      read.audienceNote ? `Made for: ${read.audienceNote}` : '',
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
  defaults: PodcastsQueryPlan,
): PodcastsQueryPlan {
  const team = (list: string[]) => teamCities(list, defaults.askCities);
  const keep = (list: string[], fallback: string[]) => {
    const kept = [...new Set(team(list))].slice(0, MAX_CITIES_PER_QUERY);
    return kept.length ? kept : fallback;
  };
  return {
    ...defaults,
    genre: phrases([chosen.genre ?? ''])[0] ?? defaults.genre,
    genreFallback: podcastsPlan.genreFallback(phrases([chosen.genre ?? ''])[0] ?? defaults.genre),
    showCity: team(chosen.showCity ? [chosen.showCity] : [])[0] ?? defaults.showCity,
    crossoverCity:
      team(chosen.crossoverCity ? [chosen.crossoverCity] : [])[0] ?? defaults.crossoverCity,
    brandCategories: phrases(chosen.brandCategories).length
      ? phrases(chosen.brandCategories)
      : defaults.brandCategories,
    brandCities: keep(chosen.brandCities, defaults.brandCities),
    // With no team cities the regions are the plan's markets, so the model cannot swap them.
    worthALook:
      defaults.cities.length && defaults.regionCities.length === 0
        ? checkWorth(chosen.worthALook, defaults.cities, defaults.worthALook)
        : defaults.worthALook,
    brandCandidates: checkBrandCandidates(chosen.brandCandidates, defaults.askCities),
  };
}

export class FallbackQueryPlanner extends LaunchFallbackPlanner<PodcastsRead, PodcastsQueryPlan> {}
