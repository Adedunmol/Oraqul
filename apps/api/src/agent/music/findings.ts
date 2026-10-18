import {
  bestRoute,
  type RouteStop,
  resolveTagsOutputSchema,
  routeScore,
  routeVerdict,
  tools,
} from '@oraqul/engine';
import { musicPlan } from '@oraqul/packs';
import type { Confidence } from '@oraqul/schema';
import type { BriefLabels } from '../launch/brief.js';
import { round2, slug } from '../launch/brief.js';
import {
  agesPhrase,
  brandPool,
  capitalise,
  entity,
  type GroundDeps,
  type Grounded,
  type GroundKit,
  type GroundSpec,
  ground as groundLaunch,
  type GroundInput as LaunchGroundInput,
  list,
  plural,
  type Voice,
} from '../launch/findings.js';
import { normalise } from '../router/decide.js';
import type { MusicQueryPlan } from './planner.js';
import type { MusicRead } from './read.js';

export type { GroundDeps, Grounded } from '../launch/findings.js';

const { RECENT_FILMS, RECENT_SHOWS, TAG_SPACES, MAX_CITIES_PER_QUERY } = musicPlan;

// Most calls the brand and community queries make between them, so they cannot spend the run.
const MAX_BRAND_CALLS = 4;
const MAX_COMMUNITY_CALLS = 8;

export type GroundInput = LaunchGroundInput<MusicRead, MusicQueryPlan>;

const VOICE: Voice = {
  audience: "the artist's audience",
  yourAudience: "your artist's audience",
  theseComps: 'this artist',
  compsVerdict: {
    holds: 'Your artist and its sound-alikes point to one audience.',
    weak: 'Your artist and its sound-alikes lean on one name for the result, so another sound-alike of your own would firm it up.',
    breaks: 'Your artist and its sound-alikes point to different audiences.',
    cant: 'Your artist and its sound-alikes could not be compared as one audience.',
  },
};

const labels = (): BriefLabels => ({
  marketNoun: 'artist',
  compsClaim: 'The artist and its sound-alikes describe one audience',
  sales: {
    item: 'Streams, ticket sales and revenue',
    reason: 'Qloo has taste data, not sales. Add your own numbers when you fix a plan.',
  },
});

/**
 * Stage 1 (spec §4.2). Each finding is streamed to the chat as it lands. Numbers and verdicts are
 * computed here or in the engine, never by the model.
 */
export function ground(deps: GroundDeps, input: GroundInput): Promise<Grounded> {
  return groundLaunch(deps, input, {
    voice: VOICE,
    labels,
    queryOrder: musicPlan.musicQueryKeys,
    runQueries,
  } satisfies GroundSpec<MusicRead, MusicQueryPlan>);
}

const rank: Record<Confidence, number> = { lower: 0, medium: 1, high: 2 };

async function runQueries(kit: GroundKit<MusicRead, MusicQueryPlan>): Promise<void> {
  const { deps, read, plan, gaps, want, jobs, taste } = kit;
  const agesText = read.ages.length ? ` ${agesPhrase(read.ages)}` : '';
  const crowd = VOICE.audience;
  routeFinding(kit);
  const tags = await resolve(deps, plan, want);

  if (want('support')) {
    const scene = tags.support;
    if (!scene) {
      gaps.push({
        item: 'Support acts',
        why: plan.scene
          ? `Qloo has no music tag for "${plan.scene}", so artists were not asked: without a scene the list drifts to what is popular overall.`
          : 'No music scene fits the brief, so artists were not asked: without a scene the list drifts to what is popular overall.',
      });
    } else {
      for (const city of plan.supportCities.slice(0, MAX_CITIES_PER_QUERY)) {
        jobs.push(
          taste(
            'support',
            `Support acts in ${city}`,
            `f-support-${slug(city)}`,
            { type: 'urn:entity:artist', tags: [scene.id], city, ages: read.ages },
            (names) =>
              `In ${city}, the ${scene.name} artists that rank highest with ${crowd}${agesText} are ${names}.`,
            { city, tags: [scene.name], ages: read.ages },
          ),
        );
      }
    }
  }

  if (want('brands')) {
    // Brands Qloo likes best are the biggest names, which would never say yes to an independent
    // artist. So the model names brands that could, Qloo finds them, and Qloo ranks only those.
    const pools = (
      await Promise.all(
        plan.brandCandidates.map(async ({ city, names }) => ({
          city,
          pool: await brandPool(deps, names),
        })),
      )
    ).filter((p) => p.pool.length >= 2);
    if (pools.length > 0) {
      for (const { city, pool } of pools.slice(0, MAX_CITIES_PER_QUERY)) {
        jobs.push(
          taste(
            'brands',
            `Partner brands in ${city}`,
            `f-brands-${slug(city)}`,
            { type: 'urn:entity:brand', city, only: pool },
            (names) =>
              `In ${city}, among brands that could realistically partner with an artist like this, ${crowd} likes ${names} best.`,
            { city },
          ),
        );
      }
    } else {
      // No usable candidates: ask Qloo by category.
      const pairs = tags.brands.flatMap((tag) => plan.brandCities.map((city) => ({ tag, city })));
      for (const { tag, city } of pairs.slice(0, MAX_BRAND_CALLS)) {
        jobs.push(
          taste(
            'brands',
            `${capitalise(tag.name)} brands in ${city}`,
            `f-brands-${slug(tag.name)}-${slug(city)}`,
            { type: 'urn:entity:brand', tags: [tag.id], city },
            (names) =>
              `In ${city}, the ${tag.name.toLowerCase()} brands that rank highest with ${crowd} are ${names}.`,
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
          `The ${genre ? `${genre.name.toLowerCase()} ` : ''}podcasts that rank highest with ${crowd}${city ? ` in ${city}` : ''} are ${names}.`,
        { city, tags: genre ? [genre.name] : [] },
      ),
    );
  }

  if (want('shows')) {
    const from = kit.year - RECENT_SHOWS;
    for (const city of plan.showCities.slice(0, MAX_CITIES_PER_QUERY)) {
      jobs.push(
        taste(
          'shows',
          `Series in ${city}`,
          `f-shows-${slug(city)}`,
          { type: 'urn:entity:tv_show', city, yearFrom: from },
          (names) =>
            `In ${city}, the series since ${from} that rank highest with ${crowd} are ${names}.`,
          { city, yearFrom: from },
        ),
      );
    }
  }

  if (want('films')) {
    const from = kit.year - RECENT_FILMS;
    const genre = tags.films;
    if (!plan.country && !genre) {
      gaps.push({
        item: 'Sync and placement',
        why: 'No country or genre to filter recent films by, and an open list drifts to what is popular overall.',
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
            `The ${plan.country ? `films from ${what}` : `${what.toLowerCase()} films`} since ${from} that rank highest with ${crowd} are ${names}.`,
          { country: plan.country, yearFrom: from, tags: genre ? [genre.name] : [] },
        ),
      );
    }
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
            `In ${city}, the ${plural(tag.name)} that rank highest with ${crowd} are ${names}.`,
          { city, tags: [tag.name] },
        ),
      );
    }
  }
}

/**
 * Scores the team's tour order against the strongest order, from the lifts of the same heatmap
 * call that ranked the cities (spec §5.4). It is an assumption of its own, so the Assumptions tab
 * and an audit test it like the age band. Cities that could not be ranked are left out.
 */
export function routeFinding(
  kit: Pick<GroundKit<MusicRead, MusicQueryPlan>, 'brief' | 'read' | 'add'>,
): void {
  const { brief, read } = kit;
  const ranked = new Map(brief.teamOrder.map((p) => [normalise(p.place), p]));
  const stops = read.places.flatMap((place) => {
    const row = ranked.get(normalise(place));
    return row && row.lift !== null ? [{ place: row.place, lift: row.lift, row }] : [];
  });
  const first = stops[0];
  if (stops.length < 2 || !first) return;
  const base = brief.lineReceipts.find((r) => r.lineId === `place-${slug(first.place)}`);
  if (!base) return;

  const plain: RouteStop[] = stops.map(({ place, lift }) => ({ place, lift }));
  const actual = routeScore(plain.map((s) => s.lift));
  const best = bestRoute(plain);
  const result = routeVerdict(actual, best.score);
  const share = best.score > 0 ? Math.min(100, Math.round((100 * actual) / best.score)) : 0;
  const lowest = [...stops].sort((a, b) => rank[a.row.confidence] - rank[b.row.confidence])[0];
  const confidence = lowest?.row.confidence ?? base.confidence;
  const why = lowest?.row.why ?? '';
  const same = best.order.join() === plain.map((s) => s.place).join();
  const text = same
    ? `Your tour order (${list(plain.map((s) => s.place))}) is already the strongest order for this audience.`
    : `Played in your order (${list(plain.map((s) => s.place))}), the tour reaches ${share}% of the strength of the strongest order (${list(best.order)}).`;
  const fix =
    result.verdict === 'holds' || same
      ? ''
      : `Keep your order, or try ${best.order.join(', then ')}, which opens with the cities where the audience is strongest.`;

  brief.brief.assumptions.push({
    id: 'a-route',
    text: 'The tour order is the strongest',
    verdict: result.verdict,
    why: result.why,
    fix,
    unstated: false,
  });
  brief.lineReceipts.push({
    ...base,
    lineId: 'a-route',
    rule: `${result.why} Confidence ${why}.`,
    confidence,
  });
  brief.reasons.set('a-route', why);
  if (result.verdict === 'weak' || result.verdict === 'breaks') {
    brief.brief.risks.push({
      id: 'risk-a-route',
      text: 'The tour order is the strongest',
      signal: result.why,
      action: fix,
    });
  }

  const byPlace = new Map(stops.map((s) => [s.place, s.row]));
  kit.add(
    {
      id: 'f-a-route',
      query: 'markets',
      text,
      entities: best.order.map((place) => {
        const row = byPlace.get(place);
        return entity(place, row?.affinity ?? null, null);
      }),
      numbers: { 'share of the strongest order': share, 'route score': round2(actual) },
      verdict: result.verdict,
      confidence,
      why,
    },
    base,
  );
}

interface Tag {
  id: string;
  name: string;
}

// Every phrase the plan needs, resolved to Qloo tags in one tool run. Unmatched ones drop out.
async function resolve(
  deps: GroundDeps,
  plan: MusicQueryPlan,
  want: (key: string) => boolean,
): Promise<{
  support: Tag | null;
  podcasts: Tag | null;
  films: Tag | null;
  brands: Tag[];
  community: Tag[];
}> {
  type Ask = { phrase: string; space: keyof typeof TAG_SPACES };
  const asks: Ask[] = [
    ...(want('support') && plan.scene ? [{ phrase: plan.scene, space: 'support' as const }] : []),
    ...(want('podcasts') && plan.podcastGenre
      ? [{ phrase: plan.podcastGenre, space: 'podcasts' as const }]
      : []),
    ...(want('films') && !plan.country && plan.filmGenre
      ? [{ phrase: plan.filmGenre, space: 'films' as const }]
      : []),
    ...(want('brands')
      ? plan.brandCategories.slice(0, 2).map((phrase) => ({ phrase, space: 'brands' as const }))
      : []),
    ...(want('community')
      ? plan.communityPlaces.slice(0, 2).map((phrase) => ({ phrase, space: 'community' as const }))
      : []),
  ];
  const empty = { support: null, podcasts: null, films: null, brands: [], community: [] };
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
    support: of('support')[0] ?? null,
    podcasts: of('podcasts')[0] ?? null,
    films: of('films')[0] ?? null,
    brands: of('brands'),
    community: of('community'),
  };
}
