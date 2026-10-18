import {
  audienceOutputSchema,
  findTasteOutputSchema,
  QlooBudgetError,
  QlooError,
  rankPlacesOutputSchema,
  resolveTagsOutputSchema,
  type TasteType,
  type ToolContext,
  themeTagsOutputSchema,
  tools,
  toReceipt,
} from '@oraqul/engine';
import { filmPlan } from '@oraqul/packs';
import type {
  Confidence,
  Finding,
  FindingContext,
  FindingEntity,
  Receipt,
  ThreadEvent,
  Verdict,
} from '@oraqul/schema';
import type { z } from 'zod';
import { buildBrief, type FilmBrief, round2, slug, type Tested } from './brief.js';
import type { QueryPlan } from './planner.js';
import { type AgeBand, BAND_RANGES, type FilmRead } from './read.js';

const { CINEMA_TAG, RECENT_FILMS, RECENT_SHOWS, TAG_SPACES, MAX_CITIES_PER_QUERY } = filmPlan;
type FilmQueryKey = filmPlan.FilmQueryKey;

/** Candidates a finding keeps for the writer to pick from. Its sentence names the first three. */
const KEEP = 6;
const NAMED = 3;
/** Most calls the brand and community queries make between them, so they cannot spend the run. */
const MAX_BRAND_CALLS = 4;
/** Churches and campuses, for each of up to four cities. */
const MAX_COMMUNITY_CALLS = 8;

export interface GroundDeps {
  tools: ToolContext;
  emit(event: ThreadEvent): void;
  keep(made: Receipt[]): void;
}

export interface GroundInput {
  read: FilmRead;
  anchors: { entityId: string; name: string; popularity: number | null }[];
  dropped: { name: string; why: string }[];
  plan: QueryPlan;
  year: number;
}

export interface Grounded {
  findings: Finding[];
  /** One receipt per finding, a copy of its call with `lineId` set to the finding's id. */
  receipts: Receipt[];
  brief: FilmBrief;
  /** What could not be asked or came back empty, for the Gaps section. */
  gaps: { item: string; why: string }[];
  /** True when the call budget ran out before every query ran. */
  budgetOut: boolean;
}

const rank: Record<Confidence, number> = { lower: 0, medium: 1, high: 2 };

/**
 * Stage 1 (spec §4.1): run the plan's queries and turn each result into a finding, a sentence
 * built by code from one call. Each finding is streamed into the chat as it lands. Numbers and
 * verdicts are computed here or in the engine, never by the model.
 */
export async function ground(deps: GroundDeps, input: GroundInput): Promise<Grounded> {
  const { read, plan } = input;
  const ids = input.anchors.map((a) => a.entityId);
  const findings: Finding[] = [];
  const receipts: Receipt[] = [];
  const gaps: Grounded['gaps'] = [];
  let budgetOut = false;

  const add = (
    finding: Omit<Finding, 'callIds' | 'numbers' | 'context'> & {
      numbers?: Record<string, number>;
      context?: Partial<FindingContext>;
    },
    call: Receipt,
  ) => {
    const full: Finding = {
      ...finding,
      numbers: { ...numbersIn(finding.text), ...(finding.numbers ?? {}) },
      context: {
        city: null,
        ages: [],
        tags: [],
        country: null,
        yearFrom: null,
        audience: null,
        ...finding.context,
      },
      callIds: [call.callId],
    };
    findings.push(full);
    receipts.push({
      ...call,
      lineId: full.id,
      rule: `${full.text} ${call.rule}`,
      confidence: full.confidence,
    });
    deps.emit({ type: 'finding', finding: full });
  };

  // Core: the comps' audience and the team's cities, in parallel.
  const places = [...plan.cities, ...plan.worthALook].slice(0, 30);
  const [audience, ranked] = await Promise.all([
    test(deps, 'audienceBySegment', { entityIds: ids }, audienceOutputSchema),
    places.length
      ? test(deps, 'rankPlaces', { entityIds: ids, places }, rankPlacesOutputSchema)
      : Promise.resolve<Tested<z.infer<typeof rankPlacesOutputSchema>>>({
          data: null,
          why: 'No cities were given, so none could be ranked.',
        }),
  ]);
  const brief = buildBrief({
    read,
    anchors: input.anchors,
    dropped: input.dropped,
    audience,
    places: ranked,
    worthALook: plan.worthALook,
  });
  coreFindings(brief, read, add, gaps, audience, ranked);

  const want = (key: FilmQueryKey) => plan.queries.includes(key);
  const ages = read.ages;
  const agesText = read.ages.length ? ` ${agesPhrase(read.ages)}` : '';

  try {
    const tags = await resolve(deps, plan, want);

    if (want('themes')) {
      const run = await safely(deps, gaps, 'Themes and archetypes', () =>
        tools.themeTags.run(deps.tools, { entityIds: ids, kinds: ['theme'] }),
      );
      if (run) {
        const out = themeTagsOutputSchema.parse(run.data);
        const [call] = run.receipts;
        const themes = out.kinds.find((k) => k.kind === 'theme')?.tags ?? [];
        const archetypes = out.kinds.find((k) => k.kind === 'archetype')?.tags ?? [];
        if (call && themes.length) {
          add(
            {
              id: 'f-themes',
              query: 'themes',
              text: `Your comps share the themes ${list(themes.slice(0, 4).map((t) => t.name.toLowerCase()))}${archetypes.length ? `, and the archetypes ${list(archetypes.slice(0, 3).map((t) => t.name))}` : ''}.`,
              entities: [...themes, ...archetypes].map((t) => entity(t.name, t.affinity, null)),
              verdict: null,
              confidence: out.confidence,
              why: out.why,
            },
            call,
          );
        } else {
          gaps.push({ item: 'Themes', why: 'Qloo returned no themes for the comps.' });
        }
      }
    }

    const taste = async (
      key: FilmQueryKey,
      label: string,
      id: string,
      shape: {
        type: TasteType;
        tags?: string[];
        city?: string | null;
        country?: string | null;
        yearFrom?: number | null;
        ages?: string[];
      },
      sentence: (names: string) => string,
      context: Partial<FindingContext>,
    ) => {
      const run = await safely(deps, gaps, label, () =>
        tools.findTaste.run(deps.tools, {
          entityIds: ids,
          take: KEEP,
          ...shape,
          exclude: [],
        }),
      );
      if (!run) return;
      const parsed = findTasteOutputSchema.parse(run.data);
      const out =
        shape.type === 'urn:entity:place'
          ? { ...parsed, candidates: parsed.candidates.filter(isVenue) }
          : parsed;
      const [call] = run.receipts;
      if (!call || out.candidates.length === 0) {
        gaps.push({
          item: label,
          why: 'Qloo returned nothing for this audience with this context.',
        });
        return;
      }
      add(
        {
          id,
          query: key,
          text: sentence(list(out.candidates.slice(0, NAMED).map((c) => c.name))),
          entities: out.candidates.map((c) => entity(c.name, c.affinity, c.detail, c.entityId)),
          verdict: null,
          confidence: out.confidence,
          why: out.why,
          context,
        },
        call,
      );
    };

    const jobs: Promise<void>[] = [];

    if (want('shows')) {
      const from = input.year - RECENT_SHOWS;
      for (const city of plan.showCities.slice(0, MAX_CITIES_PER_QUERY)) {
        jobs.push(
          taste(
            'shows',
            `Series in ${city}`,
            `f-shows-${slug(city)}`,
            { type: 'urn:entity:tv_show', city, yearFrom: from },
            (names) =>
              `In ${city}, the series since ${from} that rank highest with your comps' audience are ${names}.`,
            { city, yearFrom: from },
          ),
        );
      }
    }

    if (want('cinemas') && tags.cinemas) {
      for (const city of plan.cities.slice(0, MAX_CITIES_PER_QUERY)) {
        jobs.push(
          taste(
            'cinemas',
            `Cinemas in ${city}`,
            `f-cinemas-${slug(city)}`,
            { type: 'urn:entity:place', tags: [tags.cinemas.id], city },
            (names) =>
              `In ${city}, the cinemas that rank highest with your comps' audience are ${names}.`,
            { city, tags: [tags.cinemas.name] },
          ),
        );
      }
    }

    if (want('music')) {
      const scene = tags.music;
      if (!scene) {
        gaps.push({
          item: 'Music and soundtrack',
          why: plan.musicScene
            ? `Qloo has no music tag for "${plan.musicScene}", so artists were not asked: without a scene the list drifts to what is popular overall.`
            : 'No music scene fits the brief, so artists were not asked: without a scene the list drifts to what is popular overall.',
        });
      } else {
        for (const city of plan.musicCities.slice(0, MAX_CITIES_PER_QUERY)) {
          jobs.push(
            taste(
              'music',
              `Artists in ${city}`,
              `f-music-${slug(city)}`,
              { type: 'urn:entity:artist', tags: [scene.id], city, ages },
              (names) =>
                `In ${city}, the ${scene.name} artists that rank highest with your comps' audience${agesText} are ${names}.`,
              { city, tags: [scene.name], ages: read.ages },
            ),
          );
        }
      }
    }

    if (want('brands')) {
      const pairs = tags.brands.flatMap((tag) => plan.brandCities.map((city) => ({ tag, city })));
      for (const { tag, city } of pairs.slice(0, MAX_BRAND_CALLS)) {
        jobs.push(
          taste(
            'brands',
            `${capitalise(tag.name)} brands in ${city}`,
            `f-brands-${slug(tag.name)}-${slug(city)}`,
            { type: 'urn:entity:brand', tags: [tag.id], city },
            (names) =>
              `In ${city}, the ${tag.name.toLowerCase()} brands that rank highest with your comps' audience are ${names}.`,
            { city, tags: [tag.name] },
          ),
        );
      }
      if (tags.brands.length === 0) {
        gaps.push({
          item: 'Brand partners',
          why: 'Qloo had no brand category for the ones asked.',
        });
      }
    }

    if (want('films')) {
      const from = input.year - RECENT_FILMS;
      const genre = tags.films;
      if (!plan.country && !genre) {
        gaps.push({
          item: 'Trailer pairings',
          why: 'No country of origin or genre to filter recent films by, and an open list drifts to what is popular overall.',
        });
      } else {
        const what = plan.country ?? genre?.name ?? '';
        jobs.push(
          taste(
            'films',
            'Recent films',
            'f-films',
            {
              type: 'urn:entity:movie',
              yearFrom: from,
              ...(plan.country ? { country: plan.country } : { tags: genre ? [genre.id] : [] }),
            },
            (names) =>
              `The ${plan.country ? `films from ${what}` : `${what.toLowerCase()} films`} since ${from} that rank highest with your comps' audience are ${names}.`,
            { country: plan.country, yearFrom: from, tags: genre ? [genre.name] : [] },
          ),
        );
      }
    }

    if (want('podcasts')) {
      const genre = tags.podcasts;
      const city = plan.podcastCity;
      jobs.push(
        taste(
          'podcasts',
          'Podcasts',
          'f-podcasts',
          { type: 'urn:entity:podcast', tags: genre ? [genre.id] : [], city },
          (names) =>
            `The ${genre ? `${genre.name.toLowerCase()} ` : ''}podcasts that rank highest with your comps' audience${city ? ` in ${city}` : ''} are ${names}.`,
          { city, tags: genre ? [genre.name] : [] },
        ),
      );
    }

    if (want('community')) {
      const pairs = tags.community.flatMap((tag) =>
        plan.communityCities.map((city) => ({ tag, city })),
      );
      for (const { tag, city } of pairs.slice(0, MAX_COMMUNITY_CALLS)) {
        jobs.push(
          taste(
            'community',
            `${capitalise(plural(tag.name))} in ${city}`,
            `f-community-${slug(tag.name)}-${slug(city)}`,
            { type: 'urn:entity:place', tags: [tag.id], city },
            (names) =>
              `In ${city}, the ${plural(tag.name)} that rank highest with your comps' audience are ${names}.`,
            { city, tags: [tag.name] },
          ),
        );
      }
    }

    await Promise.all(jobs);
  } catch (err) {
    if (!(err instanceof QlooBudgetError)) throw err;
    budgetOut = true;
    gaps.push({
      item: 'The rest of the queries',
      why: 'The Qloo call budget for this run ran out before every query ran.',
    });
  }

  findings.sort((a, b) => order(a.query) - order(b.query) || a.id.localeCompare(b.id));
  return { findings, receipts, brief, gaps, budgetOut };
}

/** Findings for the audience, the team's cities and the team's decisions, from the brief. */
function coreFindings(
  b: FilmBrief,
  read: FilmRead,
  add: (
    f: Omit<Finding, 'callIds' | 'numbers' | 'context'> & {
      numbers?: Record<string, number>;
      context?: Partial<FindingContext>;
    },
    call: Receipt,
  ) => void,
  gaps: Grounded['gaps'],
  audience: Tested<z.infer<typeof audienceOutputSchema>>,
  ranked: Tested<z.infer<typeof rankPlacesOutputSchema>>,
) {
  const receiptOf = (lineId: string) => b.lineReceipts.find((r) => r.lineId === lineId);
  const reason = (lineId: string) => b.reasons.get(lineId) ?? '';

  const segments = b.brief.audience;
  const top = segments.filter((s) => s.id !== 'aud-female' && s.id !== 'aud-male').slice(0, 2);
  const women = segments.find((s) => s.id === 'aud-female');
  const men = segments.find((s) => s.id === 'aud-male');
  const firstReceipt = segments[0] ? receiptOf(segments[0].id) : undefined;
  if (firstReceipt && top.length) {
    add(
      {
        id: 'f-audience',
        query: 'audience',
        text: `Your comps' audience is strongest among people ${top.map((s) => s.name.toLowerCase().replace(/^aged /, 'aged ')).join(', then ')}${women && men && Math.abs(women.affinity - men.affinity) >= 6 ? `, and leans ${women.affinity > men.affinity ? 'female' : 'male'}` : ''}.`,
        numbers: Object.fromEntries(segments.map((x) => [x.name, x.affinity])),
        entities: [],
        verdict: null,
        confidence: firstReceipt.confidence,
        why: reason(segments[0]?.id ?? ''),
        // The same in plain words, for lines a reader sees.
        context: {
          audience: `people ${top.map((s) => s.name.toLowerCase().replace(/^aged /, '')).join(', then ')}${women && men && Math.abs(women.affinity - men.affinity) >= 6 ? `, leaning ${women.affinity > men.affinity ? 'female' : 'male'}` : ''}`,
        },
      },
      firstReceipt,
    );
  } else if (!audience.data) {
    gaps.push({ item: 'Audience by age and gender', why: audience.why });
  }

  for (const a of b.brief.assumptions) {
    const call = receiptOf(a.id);
    if (!call) continue;
    const text = plainVerdict(a.id, a.verdict, a.text, read);
    add(
      {
        id: `f-${a.id}`,
        query: a.id.startsWith('a-place') ? 'markets' : 'audience',
        text,
        entities: [],
        verdict: a.verdict,
        confidence: call.confidence,
        why: reason(a.id),
      },
      call,
    );
  }

  const placeCall = b.teamOrder[0] ? receiptOf(`place-${slug(b.teamOrder[0].place)}`) : undefined;
  if (placeCall && b.teamOrder.length) {
    const [first, ...rest] = b.teamOrder;
    const lowest = [...b.teamOrder].sort((x, y) => rank[x.confidence] - rank[y.confidence])[0];
    add(
      {
        id: 'f-markets',
        query: 'markets',
        text: `Among your cities, your comps' audience is strongest in ${first?.place}${rest.length ? `, then ${list(rest.map((p) => p.place))}` : ''}.`,
        entities: b.teamOrder.map((p) => entity(p.place, p.affinity, null)),
        numbers: Object.fromEntries(
          b.teamOrder.map((p) => [`lift ${p.place}`, round2(p.lift ?? 0)]),
        ),
        verdict: null,
        confidence: lowest?.confidence ?? placeCall.confidence,
        why: lowest?.why ?? '',
      },
      placeCall,
    );
    if (b.worth.length && ranked.data) {
      const weakest = b.teamOrder.at(-1);
      add(
        {
          id: 'f-worth-a-look',
          query: 'markets',
          text: `${list(b.worth.map((p) => p.place))} ${b.worth.length > 1 ? 'have' : 'has'} a stronger audience for these comps than ${weakest?.place ?? 'your weakest city'}.`,
          entities: b.worth.map((p) => entity(p.place, p.affinity, null)),
          numbers: Object.fromEntries(b.worth.map((p) => [`lift ${p.place}`, round2(p.lift ?? 0)])),
          verdict: null,
          confidence: b.worth.reduce<Confidence>(
            (low, p) => (rank[p.confidence] < rank[low] ? p.confidence : low),
            'high',
          ),
          why: 'Ranked in the same heatmap call as your cities.',
        },
        ranked.receipt,
      );
    }
  } else if (read.places.length) {
    gaps.push({
      item: 'Your cities',
      why: ranked.data
        ? 'None of your cities is in the city table, so none could be ranked.'
        : ranked.why,
    });
  }
}

/** A verdict in the words a marketing team would use. The technical reason stays on the finding. */
function plainVerdict(id: string, verdict: Verdict, subject: string, read: FilmRead): string {
  if (id === 'a-age') {
    const band = agesPhrase(read.ages);
    return {
      holds: `Your target (${band}) is where the comps' audience is strongest.`,
      weak: `Your target (${band}) is a smaller part of the comps' audience than older groups.`,
      breaks: `The comps' audience skews older than your target (${band}).`,
      cant: `Your target (${band}) could not be compared with the comps' audience.`,
    }[verdict];
  }
  if (id === 'a-gender') {
    const who = read.gender === 'female' ? 'women' : 'men';
    return {
      holds: `The comps' audience does lean towards ${who}.`,
      weak: `The comps' audience is fairly even, with only a slight lean towards ${who}.`,
      breaks: `The comps' audience leans away from ${who}.`,
      cant: `The gender of the comps' audience could not be compared.`,
    }[verdict];
  }
  if (id === 'a-comps') {
    return {
      holds: 'Your comps point to one audience.',
      weak: 'Your comps lean on one title for the result, so another comp of your own would firm it up.',
      breaks: 'Your comps point to different audiences.',
      cant: 'Your comps could not be compared as one audience.',
    }[verdict];
  }
  const city = subject.replace(/ is a strong market.*$/, '');
  return {
    holds: `${city} is one of the strongest cities for this audience.`,
    weak: `${city} is an average city for this audience.`,
    breaks: `${city} has a smaller audience for these comps than your other cities.`,
    cant: `${city} could not be compared with your other cities.`,
  }[verdict];
}

interface Tag {
  id: string;
  name: string;
}

/** Every phrase the plan needs, resolved to Qloo tags in one tool run. Unmatched ones drop out. */
async function resolve(
  deps: GroundDeps,
  plan: QueryPlan,
  want: (key: FilmQueryKey) => boolean,
): Promise<{
  music: Tag | null;
  podcasts: Tag | null;
  films: Tag | null;
  cinemas: Tag | null;
  brands: Tag[];
  community: Tag[];
}> {
  type Ask = { phrase: string; space: keyof typeof TAG_SPACES };
  const asks: Ask[] = [
    ...(want('music') && plan.musicScene
      ? [{ phrase: plan.musicScene, space: 'music' as const }]
      : []),
    ...(want('podcasts') && plan.podcastGenre
      ? [{ phrase: plan.podcastGenre, space: 'podcasts' as const }]
      : []),
    ...(want('films') && !plan.country && plan.filmGenre
      ? [{ phrase: plan.filmGenre, space: 'films' as const }]
      : []),
    ...(want('cinemas') ? [{ phrase: CINEMA_TAG, space: 'cinemas' as const }] : []),
    ...(want('brands')
      ? plan.brandCategories.slice(0, 2).map((phrase) => ({ phrase, space: 'brands' as const }))
      : []),
    ...(want('community')
      ? plan.communityPlaces.slice(0, 2).map((phrase) => ({ phrase, space: 'community' as const }))
      : []),
  ];
  const empty = {
    music: null,
    podcasts: null,
    films: null,
    cinemas: null,
    brands: [],
    community: [],
  };
  if (asks.length === 0) return empty;
  const run = await tools.resolveTags.run(deps.tools, {
    phrases: asks.map(({ phrase, space }) => ({
      phrase,
      prefix: TAG_SPACES[space].prefix,
      parent: TAG_SPACES[space].parent,
    })),
  });
  deps.keep(run.receipts);
  const found = resolveTagsOutputSchema.parse(run.data).tags;
  const tagFor = (i: number): Tag | null => {
    const t = found[i];
    return t?.tagId ? { id: t.tagId, name: t.name ?? t.phrase } : null;
  };
  const of = (space: Ask['space']) =>
    asks.flatMap((a, i) => (a.space === space ? (tagFor(i) ?? []) : []));
  return {
    music: of('music')[0] ?? null,
    podcasts: of('podcasts')[0] ?? null,
    films: of('films')[0] ?? null,
    cinemas: of('cinemas')[0] ?? null,
    brands: of('brands'),
    community: of('community'),
  };
}

/** Runs one core test. A failed call is "could not test" with its receipt, never a filled-in value. */
async function test<S extends z.ZodType>(
  deps: GroundDeps,
  name: 'audienceBySegment' | 'rankPlaces',
  input: Record<string, unknown>,
  schema: S,
): Promise<Tested<z.infer<S>>> {
  try {
    const { data, receipts } = await tools[name].run(deps.tools, input);
    deps.keep(receipts);
    const [receipt] = receipts;
    if (!receipt) return { data: null, why: 'No call was made, so nothing could be tested.' };
    return { data: schema.parse(data), receipt };
  } catch (err) {
    if (!(err instanceof QlooError)) throw err;
    keepFailure(deps, err);
    return { data: null, why: `The Qloo call failed (${err.kind}), so this could not be tested.` };
  }
}

/** A query that failed becomes a gap with its receipt. A spent budget stops every query. */
async function safely<T extends { receipts: Receipt[] }>(
  deps: GroundDeps,
  gaps: Grounded['gaps'],
  label: string,
  run: () => Promise<T>,
): Promise<T | null> {
  try {
    const out = await run();
    deps.keep(out.receipts);
    return out;
  } catch (err) {
    if (err instanceof QlooBudgetError || !(err instanceof QlooError)) throw err;
    keepFailure(deps, err);
    gaps.push({ item: label, why: `The Qloo call failed (${err.kind}), so this was not asked.` });
    return null;
  }
}

function keepFailure(deps: GroundDeps, err: QlooError) {
  deps.keep([
    toReceipt(err.call, {
      returned: err.call.returned,
      rule: `Could not test: ${err.message}`,
      confidence: 'lower',
      source: deps.tools.source,
    }),
  ]);
}

// A place list for a category also returns landmarks and businesses that merely carry the tag
// (live, 2026-10-17: Leicester Square, The O2 and Westminster Abbey at popularity 1.0, a luxury
// hotel and a mall among Lagos cinemas). Neither is somewhere to screen a film or hold an event
// with a community, so code leaves them out before the writer sees the list.
const LANDMARK_POPULARITY = 0.999;
const NOT_A_VENUE = /\b(hotel|mall|shopping|flea|market|resort|spa|square)\b/i;

function isVenue(c: { name: string; popularity: number | null }): boolean {
  return (c.popularity ?? 0) < LANDMARK_POPULARITY && !NOT_A_VENUE.test(c.name);
}

function entity(
  name: string,
  affinity: number | null,
  detail: string | null,
  entityId: string | null = null,
): FindingEntity {
  return { entityId, name, affinity, detail };
}

/** Every number written in a finding's text, so a line may quote any of them. */
function numbersIn(text: string): Record<string, number> {
  return Object.fromEntries(
    [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map((m, i) => [`n${i}`, Number(m[0])]),
  );
}

export function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function plural(word: string): string {
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

const QUERY_ORDER: string[] = [...filmPlan.filmQueryKeys];
function order(query: string): number {
  const at = QUERY_ORDER.indexOf(query);
  return at === -1 ? QUERY_ORDER.length : at;
}
