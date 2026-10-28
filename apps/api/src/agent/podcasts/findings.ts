import {
  findTasteOutputSchema,
  normalizeTitle,
  resolveTagsOutputSchema,
  scoreRivalsOutputSchema,
  searchEntityOutputSchema,
  type TopicPlacement,
  tools,
  topicMapOutputSchema,
  topicVerdict,
} from '@oraqul/engine';
import { podcastsPlan } from '@oraqul/packs';
import type { FanBase } from '@oraqul/schema';
import { brandPools } from '../launch/brands.js';
import type { BriefLabels } from '../launch/brief.js';
import { slug } from '../launch/brief.js';
import {
  agesPhrase,
  BRAND_BAND,
  capitalise,
  entity,
  type GroundDeps,
  type Grounded,
  type GroundKit,
  type GroundSpec,
  ground as groundLaunch,
  type GroundInput as LaunchGroundInput,
  list,
  type Voice,
} from '../launch/findings.js';
import { normalise } from '../router/decide.js';
import type { PodcastsQueryPlan } from './planner.js';
import type { PodcastsRead } from './read.js';
import { regionCities } from './regions.js';

export type { GroundDeps, Grounded } from '../launch/findings.js';

const {
  CROSS_PROMO_SHOWS,
  CROSSOVER_GROUNDED,
  MIN_GENRE_SHOWS,
  GUESTS_GROUNDED,
  MAX_CITIES_PER_QUERY,
  TAG_SPACES,
  TOPIC_RIVALS,
  TOPICS_SHOWN,
} = podcastsPlan;

// Most calls the brand query makes, so it cannot spend the run.
const MAX_BRAND_CALLS = 4;

export type GroundInput = LaunchGroundInput<PodcastsRead, PodcastsQueryPlan>;

const compsVerdict: Voice['compsVerdict'] = {
  holds: 'Your show and its comparable shows point to one audience.',
  weak: 'Your show and its comparable shows lean on one title for the result, so another comp of your own would firm it up.',
  breaks: 'Your show and its comparable shows point to different audiences.',
  cant: 'Your show and its comparable shows could not be compared as one audience.',
};

/** When the team named no market, the markets are the usual ones for a launch and the text says so. */
const voiceFor = (read: PodcastsRead): Voice => ({
  audience: "the show's audience",
  yourAudience: "your show's audience",
  chosenAudience: "the comparable shows' listeners",
  theseComps: 'this show',
  compsVerdict,
  yourPlaces:
    read.places.length || read.regions.length
      ? 'your markets'
      : 'the markets a launch like this usually checks',
});

const labels = (): BriefLabels => ({
  marketNoun: 'show',
  compsClaim: 'The show and its comparable shows describe one audience',
  sales: {
    item: 'Downloads, chart positions and ad revenue',
    reason: 'Qloo has taste data, not downloads. Add your own numbers when you fix a plan.',
  },
});

/**
 * Stage 1 (spec §4.4). Each finding is streamed to the chat as it lands. Numbers and verdicts are
 * computed here or in the engine, never by the model.
 * Verified live on one true crime brief (2026-10-20, docs/backend/qloo.md). Other subjects and
 * markets are not probed one by one: thin Qloo data shows as a gap or lower confidence.
 */
export function ground(deps: GroundDeps, input: GroundInput): Promise<Grounded> {
  return groundLaunch(deps, input, {
    voice: voiceFor(input.read),
    labels,
    queryOrder: podcastsPlan.podcastsQueryKeys,
    runQueries,
    // With no market named, the usual markets are ranked as the plan's markets.
    standInPlaces: (_read, plan) => plan.worthALook,
  } satisfies GroundSpec<PodcastsRead, PodcastsQueryPlan>);
}

interface Tag {
  id: string;
  name: string;
}

interface Show {
  name: string;
  entityId: string;
}

/** "Your show's listeners" only when the team named every comp itself. */
const listenersOf = (kit: Pick<GroundKit<PodcastsRead, PodcastsQueryPlan>, 'capped'>) =>
  kit.capped ? "the comparable shows' listeners" : "your show's listeners";

async function runQueries(kit: GroundKit<PodcastsRead, PodcastsQueryPlan>): Promise<void> {
  const { deps, read, plan, gaps, want, jobs, taste } = kit;
  const agesText = read.ages.length ? ` ${agesPhrase(read.ages)}` : '';
  const crowd = listenersOf(kit);
  const tags = await resolve(deps, plan, want);

  // A region word with no cities in Qloo's table cannot be ranked, so the plan says so.
  for (const region of read.regions) {
    if (regionCities([region]).length === 0) {
      gaps.push({
        item: `Market: ${region}`,
        why: 'The city table has no cities for this market, so it was not ranked.',
      });
    }
  }

  // The shows the audience already hears, asked once. Cross promotion ranks them, and the topic
  // map compares the audience with them when the team named no rival.
  let found: Promise<Show[]> | null = null;
  const discovered = (): Promise<Show[]> => {
    found ??= discoverShows(kit, tags.genre, tags.fallback);
    return found;
  };

  if (want('crosspromo')) jobs.push(crossPromotion(kit, discovered));
  if (want('topics')) jobs.push(topicMap(kit, discovered));

  if (want('brands')) {
    // The brands Qloo likes best are the biggest names, which would never sponsor a new show. So
    // the model names brands that could, Qloo finds them, and Qloo ranks only those.
    const pools = await brandPools(kit, tags.brands, plan.brandCities);
    if (pools.length > 0) {
      for (const { city, pool } of pools.slice(0, MAX_CITIES_PER_QUERY)) {
        jobs.push(
          taste(
            'brands',
            `Sponsors in ${city}`,
            `f-brands-${slug(city)}`,
            { type: 'urn:entity:brand', city, only: pool },
            (names) =>
              `In ${city}, among brands that could realistically sponsor a new show, ${crowd} like ${names} best.`,
            { city },
          ),
        );
      }
    } else {
      // No usable candidates: ask Qloo by category, in each named city or once with no city.
      const where = plan.brandCities.length ? plan.brandCities : [null];
      const pairs = tags.brands.flatMap((tag) => where.map((city) => ({ tag, city })));
      for (const { tag, city } of pairs.slice(0, MAX_BRAND_CALLS)) {
        jobs.push(
          taste(
            'brands',
            `${capitalise(tag.name)} brands${city ? ` in ${city}` : ''}`,
            `f-brands-${slug(tag.name)}${city ? `-${slug(city)}` : ''}`,
            { type: 'urn:entity:brand', tags: [tag.id], city, popularity: BRAND_BAND },
            (names) =>
              `${city ? `In ${city}, the` : 'The'} mid-size ${tag.name.toLowerCase()} brands that rank highest with ${crowd} are ${names}.`,
            { city: city ?? null, tags: [tag.name] },
          ),
        );
      }
      if (tags.brands.length === 0) {
        gaps.push({ item: 'Sponsors', why: 'Qloo had no brand category for the ones asked.' });
      }
    }
  }

  if (want('guests')) {
    if (GUESTS_GROUNDED) {
      jobs.push(
        taste(
          'guests',
          'Guests',
          'f-guests',
          { type: 'urn:entity:person', ages: read.ages },
          (names) => `The people that rank highest with ${crowd}${agesText} are ${names}.`,
          { ages: read.ages },
        ),
      );
    } else {
      gaps.push({
        item: 'Guests',
        why: 'Qloo has no verified data on hosts and guests, so guests are planned from launch practice and not measured.',
      });
    }
  }

  if (want('crossover') && !CROSSOVER_GROUNDED) {
    gaps.push({
      item: 'Artists and series your audience follows',
      why: 'Qloo returns these lists with no subject context, so they drift to what is popular overall and were not asked.',
    });
  }

  if (want('crossover') && CROSSOVER_GROUNDED) {
    const city = plan.crossoverCity;
    for (const [id, type, noun] of [
      ['f-crossover-music', 'urn:entity:artist', 'artists'],
      ['f-crossover-series', 'urn:entity:tv_show', 'series'],
    ] as const) {
      jobs.push(
        taste(
          'crossover',
          capitalise(noun),
          id,
          { type, city, ages: read.ages },
          (names) =>
            `The ${noun} that rank highest with ${crowd}${agesText}${city ? ` in ${city}` : ''} are ${names}.`,
          { city, ages: read.ages },
        ),
      );
    }
  }
}

/** The shows Qloo says the audience hears most in the genre, or none when there is no genre tag. */
async function discoverShows(
  kit: GroundKit<PodcastsRead, PodcastsQueryPlan>,
  genre: Tag | null,
  fallback: Tag | null,
): Promise<Show[]> {
  const { deps, read, plan, gaps } = kit;
  if (!genre) {
    gaps.push({
      item: 'Shows your audience hears',
      why: plan.genre
        ? `Qloo has no podcast tag for "${plan.genre}", so shows were not asked: without one the list drifts to what is popular overall.`
        : 'No podcast genre fits the brief, so shows were not asked: without one the list drifts to what is popular overall.',
    });
    return [];
  }
  const ask = async (tag: Tag) => {
    const run = await kit.safely('Shows your audience hears', () =>
      tools.findTaste.run(deps.tools, {
        entityIds: kit.ids,
        type: 'urn:entity:podcast',
        tags: [tag.id],
        city: plan.showCity,
        ages: read.ages,
        take: CROSS_PROMO_SHOWS,
        exclude: [],
      }),
    );
    return run
      ? findTasteOutputSchema
          .parse(run.data)
          .candidates.map((c) => ({ name: c.name, entityId: c.entityId }))
      : [];
  };
  const narrow = await ask(genre);
  // A narrow genre such as soccer is a small pool, so a broader one fills the list when it is short.
  if (narrow.length >= MIN_GENRE_SHOWS || !fallback) return narrow;
  const broad = await ask(fallback);
  return [...narrow, ...broad.filter((b) => !narrow.some((n) => n.entityId === b.entityId))].slice(
    0,
    CROSS_PROMO_SHOWS,
  );
}

/** Finds each show the team named in Qloo by exact name, and says so in a gap when it cannot. */
async function resolveShows(
  kit: GroundKit<PodcastsRead, PodcastsQueryPlan>,
  names: string[],
  what: string,
): Promise<Show[]> {
  const found = await Promise.all(
    names.slice(0, TOPIC_RIVALS + 2).map(async (name) => {
      const run = await kit.safely(`${what} ${name}`, () =>
        tools.searchEntity.run(kit.deps.tools, { name, types: ['urn:entity:podcast'] }),
      );
      if (!run) return null;
      const candidates = searchEntityOutputSchema.parse(run.data).candidates;
      const top = candidates.filter((c) => normalizeTitle(c.name) === normalizeTitle(name));
      // A show is usually written without its full title ("Casefile" for "Casefile True Crime"), as
      // a brand is, so with no exact match the most popular title that starts with it stands in.
      const fuller = candidates
        .filter((c) => normalizeTitle(c.name).startsWith(`${normalizeTitle(name)} `))
        .sort((x, y) => (y.popularity ?? 0) - (x.popularity ?? 0))[0];
      const only = top.length === 1 ? top[0] : top.length === 0 ? fuller : undefined;
      if (!only) {
        kit.gaps.push({
          item: `${what} ${name}`,
          why:
            top.length > 1
              ? 'Several shows share this name, so none was chosen.'
              : 'Qloo did not find it by name.',
        });
        return null;
      }
      return { name, entityId: only.entityId } satisfies Show;
    }),
  );
  return found.flatMap((s) => s ?? []);
}

/**
 * Cross promotion (spec §4.4): the shows the audience already hears, with any show the team named
 * scored in the same call, so it shows as a ranked row. Scores compare only within one call.
 */
async function crossPromotion(
  kit: GroundKit<PodcastsRead, PodcastsQueryPlan>,
  discovered: () => Promise<Show[]>,
): Promise<void> {
  const { deps, read, plan, gaps, brief } = kit;
  const [mine, hears] = await Promise.all([
    resolveShows(kit, read.crossPromo, 'Swap with'),
    discovered(),
  ]);
  const ids = [...new Set([...hears.map((s) => s.entityId), ...mine.map((s) => s.entityId)])];
  if (ids.length === 0) {
    if (read.crossPromo.length === 0) {
      gaps.push({ item: 'Cross promotion shows', why: 'Qloo returned nothing for this audience.' });
    }
    return;
  }

  const scored = await kit.safely('Cross promotion shows', () =>
    tools.scoreRivals.run(deps.tools, {
      entityIds: kit.ids,
      type: 'urn:entity:podcast',
      rivals: ids.slice(0, 12),
      leaveOneOut: false,
    }),
  );
  if (!scored) return;
  const out = scoreRivalsOutputSchema.parse(scored.data);
  const [call] = scored.receipts;
  const ranked = out.rivals
    .filter((r) => r.overlap !== null)
    .sort((a, b) => (b.overlap ?? 0) - (a.overlap ?? 0));
  if (!call || ranked.length === 0) {
    gaps.push({
      item: 'Cross promotion shows',
      why: 'Qloo did not score these for this audience.',
    });
    return;
  }

  const isMine = (id: string) => mine.some((s) => s.entityId === id);
  const kept = [
    ...ranked.filter((r) => !isMine(r.entityId)).slice(0, CROSS_PROMO_SHOWS),
    ...ranked.filter((r) => isMine(r.entityId)),
  ].sort((a, b) => (b.overlap ?? 0) - (a.overlap ?? 0));

  const rows: FanBase[] = kept.map((r) => {
    const id = `fan-podcast-${slug(r.name)}`;
    const overlap = r.overlap ?? 0;
    brief.lineReceipts.push({
      ...call,
      lineId: id,
      rule: `Overlap is the affinity Qloo gives ${r.name} for these listeners × 100, scored with the other shows in one call, so it compares only within these shows. Confidence ${out.why}.`,
      confidence: out.confidence,
    });
    brief.reasons.set(id, out.why);
    return {
      id,
      name: r.name,
      medium: 'podcast',
      // Qloo scores each show once, so a swap partner shows as a ranked row. It does not move.
      before: overlap,
      after: overlap,
      evidence: `Podcast · ${overlap} of 100 overlap with your listeners`,
      ...(isMine(r.entityId) ? { note: 'Your pick' } : {}),
    };
  });
  brief.brief.fan = rows;

  const city = plan.showCity;
  const top = kept.filter((r) => !isMine(r.entityId));
  kit.add(
    {
      id: 'f-crosspromo',
      query: 'crosspromo',
      text: `The shows that rank highest with ${listenersOf(kit)}${read.ages.length ? ` ${agesPhrase(read.ages)}` : ''}${city ? ` in ${city}` : ''} are ${list(top.slice(0, 3).map((r) => r.name))}.`,
      entities: ranked.map((r) => entity(r.name, (r.overlap ?? 0) / 100, 'Podcast', r.entityId)),
      numbers: Object.fromEntries(ranked.map((r) => [`overlap ${r.name}`, r.overlap ?? 0])),
      verdict: null,
      confidence: out.confidence,
      why: out.why,
      context: { city, ages: read.ages },
    },
    call,
  );

  for (const s of mine) {
    const place = ranked.findIndex((r) => r.entityId === s.entityId);
    if (place === -1) {
      gaps.push({ item: `Swap with ${s.name}`, why: 'Qloo did not score it for this audience.' });
      continue;
    }
    kit.add(
      {
        id: `f-promo-${slug(s.name)}`,
        query: 'crosspromo',
        // Two or three scores do not make a ranking, so a small group reports the overlap.
        text:
          ranked.length >= 3
            ? `${s.name} ranks ${place + 1} of ${ranked.length} among the shows asked about for ${listenersOf(kit)}.`
            : `${s.name} overlaps ${ranked[place]?.overlap ?? 0} of 100 with ${listenersOf(kit)}, scored with ${ranked.length - 1} other shows.`,
        entities: [entity(s.name, (ranked[place]?.overlap ?? 0) / 100, 'Podcast', s.entityId)],
        numbers: { place: place + 1, of: ranked.length },
        verdict: null,
        confidence: out.confidence,
        why: out.why,
      },
      call,
    );
  }
}

const sameTopic = (a: string, b: string) => {
  const x = normalise(a);
  const y = normalise(b);
  return x === y || x.includes(y) || y.includes(x);
};

/**
 * The topic map (spec §4.4, §5): what your audience lean to that the rival shows' audiences do not,
 * from one comparison call. Each topic the team wants to own is tested against it as an assumption
 * of its own (spec §5.8).
 */
async function topicMap(
  kit: GroundKit<PodcastsRead, PodcastsQueryPlan>,
  discovered: () => Promise<Show[]>,
): Promise<void> {
  const { deps, read, gaps, brief } = kit;
  const named = await resolveShows(kit, read.rivals, 'Rival');
  const rivals = named.length ? named : await discovered();
  const rivalIds = [...new Set(rivals.map((r) => r.entityId))].slice(0, TOPIC_RIVALS);
  if (rivalIds.length === 0) {
    gaps.push({
      item: 'Topic map',
      why: 'There were no rival shows to compare your audience with, so no topic map was made.',
    });
    return;
  }
  const run = await kit.safely('Topics against rival shows', () =>
    tools.topicMap.run(deps.tools, { entityIds: kit.ids, rivalIds, take: TOPICS_SHOWN }),
  );
  if (!run) return;
  const out = topicMapOutputSchema.parse(run.data);
  const [call] = run.receipts;
  if (!call || (out.yours.length === 0 && out.shared.length === 0 && out.rivals.length === 0)) {
    gaps.push({ item: 'Topic map', why: 'Qloo returned no topics for these audiences.' });
    return;
  }

  const basis = named.length ? 'the rival shows you named' : 'shows in the same genre';
  const topics = [
    ...out.yours.map((t) => ({ ...t, ownership: 'distinct' as const })),
    ...out.shared.map((t) => ({ ...t, weight: 1, ownership: 'shared' as const })),
  ];
  brief.brief.topics = topics.map((t) => {
    const id = `topic-${slug(t.name)}`;
    brief.lineReceipts.push({
      ...call,
      lineId: id,
      rule: `${out.why ? `Confidence ${out.why}. ` : ''}A topic is yours when its weight against a typical rival topic is above 1, from one comparison with ${basis}.`,
      confidence: out.confidence,
    });
    brief.reasons.set(id, out.why);
    return {
      id,
      name: t.name,
      ownership: t.ownership,
      weight: t.weight,
      evidence:
        t.ownership === 'distinct'
          ? `Your shows carry it and ${basis} do not`
          : `Both your listeners and ${basis} lean to it`,
    };
  });

  const yours = out.yours.slice(0, 3).map((t) => t.name.toLowerCase());
  kit.add(
    {
      id: 'f-topics',
      query: 'topics',
      text: yours.length
        ? `Compared with ${basis}, the topics your listeners lean to that rivals do not are ${list(yours)}.`
        : `Compared with ${basis}, no topic stood out as only your listeners'.`,
      entities: [
        ...out.yours.map((t) => entity(t.name, null, `yours · ${t.weight}×`)),
        ...out.shared.map((t) => entity(t.name, null, 'shared')),
        ...out.rivals.map((t) => entity(t.name, null, 'rivals')),
      ],
      numbers: Object.fromEntries(out.yours.map((t) => [`weight ${t.name}`, t.weight])),
      verdict: null,
      confidence: out.confidence,
      why: out.why,
    },
    call,
  );

  const placementOf = (name: string): TopicPlacement | null =>
    out.yours.some((t) => sameTopic(t.name, name))
      ? 'yours'
      : out.shared.some((t) => sameTopic(t.name, name))
        ? 'shared'
        : out.rivals.some((t) => sameTopic(t.name, name))
          ? 'rivals'
          : null;

  for (const name of read.topics) {
    const id = `a-topic-${slug(name)}`;
    const result = topicVerdict(placementOf(name));
    const cant = result.verdict === 'cant';
    const fix = out.yours.length
      ? `Keep ${name}, and lead with ${list(out.yours.slice(0, 2).map((t) => t.name))} too: your listeners lean to those more than the rival shows' listeners.`
      : `Keep ${name}, and look for an angle on it that the rival shows do not take.`;
    brief.brief.assumptions.push({
      id,
      text: `${capitalise(name)} is a topic your show can own`,
      verdict: result.verdict,
      why: result.why,
      fix: result.verdict === 'holds' ? '' : fix,
      unstated: false,
    });
    brief.lineReceipts.push({
      ...call,
      lineId: id,
      rule: cant ? `Could not test: ${result.why}` : `${result.why} Confidence ${out.why}.`,
      confidence: cant ? 'lower' : out.confidence,
    });
    brief.reasons.set(id, cant ? 'lower: this line could not be tested' : out.why);
    if (result.verdict === 'weak' || result.verdict === 'breaks') {
      brief.brief.risks.push({
        id: `risk-${id}`,
        text: `${capitalise(name)} is a topic your show can own`,
        signal: result.why,
        action: fix,
      });
    }
    kit.add(
      {
        id: `f-${id}`,
        query: 'topics',
        text: {
          holds: `${capitalise(name)} is a topic your listeners lean to more than the listeners of ${basis}.`,
          weak: `${capitalise(name)} is a topic your listeners and ${basis} both lean to, so it is not yours alone.`,
          breaks: `${capitalise(name)} is a topic ${basis} lean to more than your listeners.`,
          cant: `${capitalise(name)} could not be compared with ${basis}.`,
        }[result.verdict],
        entities: [],
        verdict: result.verdict,
        confidence: cant ? 'lower' : out.confidence,
        why: cant ? 'lower: this line could not be tested' : out.why,
      },
      call,
    );
  }
}

// Every phrase the plan needs, resolved to Qloo tags in one tool run. Unmatched ones drop out.
async function resolve(
  deps: GroundDeps,
  plan: PodcastsQueryPlan,
  want: (key: string) => boolean,
): Promise<{ genre: Tag | null; fallback: Tag | null; brands: Tag[] }> {
  type Ask = { phrase: string; space: keyof typeof TAG_SPACES };
  const asks: Ask[] = [
    ...((want('crosspromo') || want('topics')) && plan.genre
      ? [plan.genre, ...(plan.genreFallback ? [plan.genreFallback] : [])].map((phrase) => ({
          phrase,
          space: 'podcastGenre' as const,
        }))
      : []),
    ...(want('brands')
      ? plan.brandCategories.slice(0, 2).map((phrase) => ({ phrase, space: 'brands' as const }))
      : []),
  ];
  if (asks.length === 0) return { genre: null, fallback: null, brands: [] };
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
  const byPhrase = (p: string | null) => {
    const i = asks.findIndex((a) => a.space === 'podcastGenre' && a.phrase === p);
    return i === -1 ? null : tagFor(i);
  };
  return {
    genre: byPhrase(plan.genre),
    fallback: byPhrase(plan.genreFallback),
    brands: of('brands'),
  };
}
