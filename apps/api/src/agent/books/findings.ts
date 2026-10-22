import {
  audienceOutputSchema,
  bookProfilesOutputSchema,
  compAgeVerdict,
  findTasteOutputSchema,
  rankPlacesOutputSchema,
  resolveBundleOutputSchema,
  resolveTagsOutputSchema,
  scoreRivalsOutputSchema,
  seriesOf,
  themeTagsOutputSchema,
  tools,
} from '@oraqul/engine';
import { booksPlan } from '@oraqul/packs';
import type { Confidence, FitLine, Receipt } from '@oraqul/schema';
import type { z } from 'zod';
import { ageLabel, round2, slug } from '../launch/brief.js';
import {
  agesPhrase,
  BRAND_BAND,
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
  type Voice,
} from '../launch/findings.js';
import { normalise } from '../router/decide.js';
import type { BooksQueryPlan } from './planner.js';
import type { BooksRead } from './read.js';
import { regionCities } from './regions.js';

export type { GroundDeps, Grounded } from '../launch/findings.js';

const {
  BOOKSHOP_PHRASE,
  BRIDGE_PER_MEDIUM,
  CREATORS_GROUNDED,
  MAX_CITIES_PER_QUERY,
  PODCASTS_SHOWN,
  SHELF_BOOKS,
  SHELF_YEARS,
  TAG_SPACES,
} = booksPlan;

// Most calls the brand query makes, so it cannot spend the run.
const MAX_BRAND_CALLS = 4;

export type GroundInput = LaunchGroundInput<BooksRead, BooksQueryPlan>;

const compsVerdict: Voice['compsVerdict'] = {
  holds: 'Your book and its comparable books point to one readership.',
  weak: 'Your book and its comparable books lean on one title for the result, so another comp of your own would firm it up.',
  breaks: 'Your book and its comparable books point to different readerships.',
  cant: 'Your book and its comparable books could not be compared as one readership.',
};

/** When the team named no market, the markets are the usual ones for a launch and the text says so. */
const voiceFor = (read: BooksRead): Voice => ({
  audience: "the book's readers",
  yourAudience: "your book's readers",
  theseComps: 'this book',
  compsVerdict,
  yourPlaces:
    read.places.length || read.regions.length
      ? 'your markets'
      : 'the markets a launch like this usually checks',
});

const labels = () => ({
  marketNoun: 'book',
  compsClaim: 'The book and its comparable books describe one readership',
  sales: {
    item: 'Sales, pre-orders and chart positions',
    reason: 'Qloo has taste data, not sales. Add your own numbers when you fix a plan.',
  },
});

/**
 * Stage 1 (spec §4.5). Each finding is streamed to the chat as it lands. Numbers and verdicts are
 * computed here or in the engine, never by the model.
 * Verified live on a literary fiction brief and a romantasy brief (docs/backend/qloo.md).
 * Other genres and markets are not probed one by one: thin Qloo data shows as a gap or lower
 * confidence. `qloo-books-probes.ts` re-checks the queries.
 */
export function ground(deps: GroundDeps, input: GroundInput): Promise<Grounded> {
  return groundLaunch(deps, input, {
    voice: voiceFor(input.read),
    labels,
    queryOrder: booksPlan.booksQueryKeys,
    runQueries: (kit) => runQueries(kit, input),
    // With no market named, the usual markets are ranked as the plan's markets.
    standInPlaces: (_read, plan) => plan.worthALook,
  } satisfies GroundSpec<BooksRead, BooksQueryPlan>);
}

type Kit = GroundKit<BooksRead, BooksQueryPlan>;

interface Tag {
  id: string;
  name: string;
}

interface Tags {
  genre: Tag | null;
  /** The "books" genre tag that podcasts about books carry. */
  books: Tag | null;
  brands: Tag[];
  bookshop: Tag | null;
}

/** The year the launch is for: the one in the window, or this year. */
export function launchYear(read: Pick<BooksRead, 'window'>, thisYear: number): number {
  const written = read.window?.match(/\b(20\d{2})\b/)?.[1];
  return written ? Number(written) : thisYear;
}

async function runQueries(kit: Kit, input: GroundInput): Promise<void> {
  const { deps, read, plan, gaps, want, jobs, taste } = kit;
  const crowd = "your book's readers";
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

  // The podcasts the readers hear, asked once: the bridge lists them beside series and films, and
  // the press section pitches them.
  let heard: Promise<Heard | null> | null = null;
  const podcasts = (): Promise<Heard | null> => {
    heard ??= podcastsHeard(kit, tags.books);
    return heard;
  };

  if (want('shelf')) jobs.push(shelfAndAges(kit, input, tags.genre));
  if (want('bridge')) jobs.push(bridge(kit, podcasts).then((titles) => filmConsult(kit, titles)));
  if (want('podcasts') && !want('bridge')) jobs.push(podcasts().then(() => undefined));

  if (want('themes')) jobs.push(themes(kit));

  if (want('brands')) {
    // The brands Qloo likes best are the biggest names, which would never partner with a new book.
    // So the model names brands that could, Qloo finds them, and Qloo ranks only those.
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
            `Brand partners in ${city}`,
            `f-brands-${slug(city)}`,
            { type: 'urn:entity:brand', city, only: pool },
            (names) =>
              `In ${city}, among brands that could realistically partner with a book launch, ${crowd} like ${names} best.`,
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
        gaps.push({
          item: 'Brand partners',
          why: 'Qloo had no brand category for the ones asked.',
        });
      }
    }
  }

  if (want('bookshops')) {
    if (tags.bookshop) {
      const bookshop = tags.bookshop;
      for (const city of plan.bookshopCities.slice(0, MAX_CITIES_PER_QUERY)) {
        jobs.push(
          taste(
            'bookshops',
            `Bookshops in ${city}`,
            `f-shops-${slug(city)}`,
            { type: 'urn:entity:place', tags: [bookshop.id], city },
            (names) => `In ${city}, the bookshops that rank highest with ${crowd} are ${names}.`,
            { city },
          ),
        );
      }
    } else {
      gaps.push({ item: 'Bookshops', why: 'Qloo had no bookshop category, so none were asked.' });
    }
  }

  if (want('creators') && !CREATORS_GROUNDED) {
    gaps.push({
      item: 'Creators and authors your readers follow',
      why: 'Qloo returned authors for one genre and voice actors for another, so the list does not fit every book and was not asked.',
    });
  }
}

interface Podcast {
  name: string;
  entityId: string;
  overlap: number;
}

type ShelfBook = { name: string; entityId: string; overlap: number; year: number | null };

/** Books that read as the same book to a reader: the author's own series, and omnibus entries. */
function isOwnSeries(name: string, own: Set<string>): boolean {
  const series = seriesOf(name);
  return (series !== null && own.has(normalise(series))) || name.includes(' / ');
}

/**
 * The shelf (spec §4.5): the recent books these readers pick up, which are the comps worth pitching
 * against. The comps the team named are then tested for how recent they are (spec §5.10).
 */
async function shelfAndAges(kit: Kit, input: GroundInput, genre: Tag | null): Promise<void> {
  const { deps, read, plan, gaps, brief } = kit;
  const profile = await profileOf(kit);
  const ownSeries = new Set(
    (profile?.books ?? []).flatMap((b) => (b.series ? [normalise(b.series)] : [])),
  );
  // A book cannot be published after today, so a launch in the future still looks back from now.
  const yearFrom = Math.min(launchYear(read, kit.year), kit.year) - SHELF_YEARS;

  const run = await kit.safely('Recent books your readers pick up', () =>
    tools.findTaste.run(deps.tools, {
      entityIds: kit.ids,
      type: 'urn:entity:book',
      tags: genre ? [genre.id] : [],
      city: plan.shelfCity,
      ages: read.ages,
      yearFrom,
      take: 10,
      exclude: [],
    }),
  );
  let shelf: ShelfBook[] = [];
  if (run) {
    const out = findTasteOutputSchema.parse(run.data);
    const [call] = run.receipts;
    // One book from a series is enough: its other books are the same pick to a reader.
    const seen = new Set<string>();
    shelf = out.candidates
      .filter((c) => c.affinity !== null && !isOwnSeries(c.name, ownSeries))
      .filter((c) => {
        const series = seriesOf(c.name);
        if (!series) return true;
        const key = normalise(series);
        return !seen.has(key) && !!seen.add(key);
      })
      .slice(0, SHELF_BOOKS)
      .map((c) => ({
        name: c.name,
        entityId: c.entityId,
        overlap: Math.round((c.affinity ?? 0) * 100),
        year: c.detail && /^\d{4}$/.test(c.detail) ? Number(c.detail) : null,
      }));
    if (!call || shelf.length === 0) {
      gaps.push({
        item: 'Recent books your readers pick up',
        why: 'Qloo returned no recent books for these readers.',
      });
    } else {
      brief.brief.shelf = shelf.map((b) => {
        const id = `shelf-${slug(b.name)}`;
        brief.lineReceipts.push({
          ...call,
          lineId: id,
          rule: `Overlap is the affinity Qloo gives ${b.name} for these readers × 100, from one list of books, so it compares only within these books. Confidence ${out.why}.`,
          confidence: out.confidence,
        });
        brief.reasons.set(id, out.why);
        return {
          id,
          name: b.name,
          overlap: b.overlap,
          evidence: `${b.year ? `${b.year} · ` : ''}${b.overlap} of 100 overlap with your readers`,
        };
      });
      const city = plan.shelfCity;
      kit.add(
        {
          id: 'f-shelf',
          query: 'shelf',
          text: `The recent books that rank highest with your book's readers${read.ages.length ? ` ${agesPhrase(read.ages)}` : ''}${city ? ` in ${city}` : ''} are ${list(shelf.slice(0, 3).map((b) => b.name))}.`,
          entities: shelf.map((b) =>
            entity(b.name, b.overlap / 100, b.year ? String(b.year) : null, b.entityId),
          ),
          numbers: Object.fromEntries(shelf.map((b) => [`overlap ${b.name}`, b.overlap])),
          verdict: null,
          confidence: out.confidence,
          why: out.why,
          context: { city, ages: read.ages, yearFrom },
        },
        call,
      );
    }
  }

  if (profile) compAges(kit, input, profile, shelf);
}

interface Profile {
  books: z.infer<typeof bookProfilesOutputSchema>['books'];
  call: Receipt;
  confidence: Confidence;
  why: string;
}

/** What Qloo lists for each anchor: its year, pages and series. One lookup. */
async function profileOf(kit: Kit): Promise<Profile | null> {
  const run = await kit.safely('How recent your comparable books are', () =>
    tools.bookProfiles.run(kit.deps.tools, { entityIds: kit.ids.slice(0, 20) }),
  );
  const call = run?.receipts[0];
  if (!run || !call) return null;
  const out = bookProfilesOutputSchema.parse(run.data);
  return { books: out.books, call, confidence: out.confidence, why: out.why };
}

/**
 * Spec §5.10: each comparable book the team named, against the year of the launch. The team's comp
 * stays in the plan; its fix names the recent books beside it.
 */
function compAges(kit: Kit, input: GroundInput, out: Profile, shelf: ShelfBook[]): void {
  const { read, brief } = kit;
  const call = out.call;
  const year = launchYear(read, kit.year);
  for (const name of read.comps) {
    const anchor = input.anchors.find((a) => normalise(a.name) === normalise(name));
    if (!anchor) continue;
    const book = out.books.find((b) => b.entityId === anchor.entityId);
    const result = compAgeVerdict(book?.publicationYear ?? null, year);
    const cant = result.verdict === 'cant';
    const id = `a-comp-age-${slug(name)}`;
    const fix = shelf.length
      ? `Keep ${name} as a reference, and pitch against ${list(shelf.slice(0, 2).map((b) => b.name))} too: they are recent books your readers pick up.`
      : `Keep ${name} as a reference, and add a book from the last five years beside it.`;
    brief.brief.assumptions.push({
      id,
      text: `${name} is recent enough to pitch against`,
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
        text: `${name} is recent enough to pitch against`,
        signal: result.why,
        action: fix,
      });
    }
    const published = book?.publicationYear;
    kit.add(
      {
        id: `f-${id}`,
        query: 'shelf',
        text: {
          holds: `${name} was published in ${published}, recent enough to pitch against.`,
          weak: `${name} was published in ${published}, a few years back.`,
          breaks: `${name} was published in ${published}, which reads as a classic more than a current comp.`,
          cant: `Qloo does not list a publication year for ${name}.`,
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

/** Finds each title in Qloo by exact name in one entity type. Of several, the best known is used. */
async function resolveTitles(
  kit: Kit,
  names: string[],
  type: 'urn:entity:tv_show' | 'urn:entity:movie',
  mine: boolean,
): Promise<{ name: string; entityId: string; mine: boolean }[]> {
  const found: { name: string; entityId: string; mine: boolean }[] = [];
  for (let i = 0; i < names.length; i += 8) {
    const run = await kit.safely('Screen titles', () =>
      tools.resolveBundle.run(kit.deps.tools, { names: names.slice(i, i + 8), types: [type] }),
    );
    if (!run) continue;
    for (const a of resolveBundleOutputSchema.parse(run.data).anchors) {
      if (a.status === 'found' && a.entityId) {
        found.push({ name: a.name, entityId: a.entityId, mine });
      } else if (a.status === 'ambiguous') {
        // Screen titles are often listed twice under one name (a series and its remake). The best
        // known one is the one a reader means.
        const best = [...a.candidates].sort((x, y) => (y.popularity ?? 0) - (x.popularity ?? 0))[0];
        if (best) found.push({ name: a.name, entityId: best.entityId, mine });
      }
    }
  }
  return found;
}

/**
 * The adaptation bridge (spec §4.5): series, films and podcasts that these readers also follow.
 * Qloo's open lists of series and films for a book audience drift, so the bridge ranks titles we
 * choose (the team's own and the planner's), in one scoring call per kind of media. Scores from
 * separate calls are never compared, so rows are only ranked within their own medium.
 */
async function bridge(kit: Kit, podcasts: () => Promise<Heard | null>): Promise<ScreenTitle[]> {
  const { read, plan, gaps, brief } = kit;
  const rows: FitLine[] = [];

  // A title the team named may be a series or a film, so it is looked up as a series first.
  const named = read.screenTitles;
  const asSeries = await resolveTitles(kit, named, 'urn:entity:tv_show', true);
  const rest = named.filter((n) => !asSeries.some((s) => normalise(s.name) === normalise(n)));
  const asFilm = await resolveTitles(kit, rest, 'urn:entity:movie', true);
  for (const n of rest.filter((n) => !asFilm.some((f) => normalise(f.name) === normalise(n)))) {
    gaps.push({
      item: `Screen title ${n}`,
      why: 'Qloo did not find it by one exact name, so it was not scored.',
    });
  }

  for (const [type, medium, noun, mine, names] of [
    ['urn:entity:tv_show', 'Series', 'series', asSeries, plan.screenSeries],
    ['urn:entity:movie', 'Film', 'films', asFilm, plan.screenFilms],
  ] as const) {
    const chosen = await resolveTitles(
      kit,
      names.filter((n) => !mine.some((m) => normalise(m.name) === normalise(n))),
      type,
      false,
    );
    const all = [...mine, ...chosen]
      .filter((t, i, list) => list.findIndex((x) => x.entityId === t.entityId) === i)
      .slice(0, BRIDGE_PER_MEDIUM + mine.length);
    if (all.length === 0) {
      // Nothing was asked for a kind of book with no screen story to compare, and that is no gap.
      if (names.length > 0) {
        gaps.push({ item: `Screen ${noun}`, why: `Qloo found none of the ${noun} asked about.` });
      }
      continue;
    }
    const scored = await kit.safely(`Screen ${noun}`, () =>
      tools.scoreRivals.run(kit.deps.tools, {
        entityIds: kit.ids,
        type,
        rivals: all.map((t) => t.entityId),
        leaveOneOut: false,
      }),
    );
    if (!scored) continue;
    const out = scoreRivalsOutputSchema.parse(scored.data);
    const [call] = scored.receipts;
    const ranked = out.rivals
      .filter((r) => r.overlap !== null)
      .sort((a, b) => (b.overlap ?? 0) - (a.overlap ?? 0));
    if (!call || ranked.length === 0) {
      gaps.push({ item: `Screen ${noun}`, why: 'Qloo did not score these for these readers.' });
      continue;
    }
    const isMine = (id: string) => mine.some((m) => m.entityId === id);
    for (const r of ranked) {
      const id = `bridge-${medium.toLowerCase()}-${slug(r.name)}`;
      const overlap = r.overlap ?? 0;
      brief.lineReceipts.push({
        ...call,
        lineId: id,
        rule: `Overlap is the affinity Qloo gives ${r.name} for these readers × 100, scored with the other ${noun} in one call, so it compares only within these ${noun}. Confidence ${out.why}.`,
        confidence: out.confidence,
      });
      brief.reasons.set(id, out.why);
      rows.push({
        id,
        name: r.name,
        fit: overlap,
        evidence: `${medium} · ${overlap} of 100 overlap with your readers`,
        medium,
        ...(isMine(r.entityId) ? { note: 'Your pick' } : {}),
      });
    }
    kit.add(
      {
        id: `f-bridge-${medium.toLowerCase()}`,
        query: 'bridge',
        text: `The ${noun} that rank highest with your book's readers, of those asked about, are ${list(ranked.slice(0, 3).map((r) => r.name))}.`,
        entities: ranked.map((r) => entity(r.name, (r.overlap ?? 0) / 100, medium, r.entityId)),
        numbers: Object.fromEntries(ranked.map((r) => [`overlap ${r.name}`, r.overlap ?? 0])),
        verdict: null,
        confidence: out.confidence,
        why: out.why,
      },
      call,
    );
    for (const t of mine) {
      const place = ranked.findIndex((r) => r.entityId === t.entityId);
      if (place === -1) {
        gaps.push({
          item: `Screen title ${t.name}`,
          why: 'Qloo did not score it for these readers.',
        });
        continue;
      }
      kit.add(
        {
          id: `f-screen-${slug(t.name)}`,
          query: 'bridge',
          // Two or three scores do not make a ranking, so a small group reports the overlap.
          text:
            ranked.length >= 3
              ? `${t.name} ranks ${place + 1} of ${ranked.length} among the ${noun} asked about for your book's readers.`
              : `${t.name} overlaps ${ranked[place]?.overlap ?? 0} of 100 with your book's readers, scored with ${ranked.length - 1} other ${noun}.`,
          entities: [entity(t.name, (ranked[place]?.overlap ?? 0) / 100, medium, t.entityId)],
          numbers: { place: place + 1, of: ranked.length },
          verdict: null,
          confidence: out.confidence,
          why: out.why,
        },
        call,
      );
    }
  }

  const heard = await podcasts();
  if (heard) {
    for (const p of heard.shows) {
      const id = `bridge-podcast-${slug(p.name)}`;
      brief.lineReceipts.push({
        ...heard.call,
        lineId: id,
        rule: `Overlap is the affinity Qloo gives ${p.name} for these readers × 100, from one list of podcasts, so it compares only within these podcasts. Confidence ${heard.why}.`,
        confidence: heard.confidence,
      });
      brief.reasons.set(id, heard.why);
      rows.push({
        id,
        name: p.name,
        fit: p.overlap,
        evidence: `Podcast · ${p.overlap} of 100 overlap with your readers`,
        medium: 'Podcast',
      });
    }
  }
  if (rows.length) brief.brief.bridge = rows;
  return [...asSeries, ...asFilm];
}

type ScreenTitle = { name: string; entityId: string; mine: boolean };

/**
 * The one bounded question the Books agent puts to the Film side (spec §3.4): for the first screen
 * title the team named, who watches it and where. It runs the Film agent's own tests on that
 * title, the audience skew and the city ranking, and cites their receipts, so the screen angle
 * rests on how the adaptation's audience compares with the readers' and not on the readers alone.
 */
async function filmConsult(kit: Kit, titles: ScreenTitle[]): Promise<void> {
  const title = titles.find((t) => t.mine);
  if (!title) return;
  const { brief } = kit;
  const audience = await kit.safely('Film consult: audience', () =>
    tools.audienceBySegment.run(kit.deps.tools, { entityIds: [title.entityId] }),
  );
  const out = audience ? audienceOutputSchema.parse(audience.data) : null;
  const [call] = audience?.receipts ?? [];
  const segment = out?.segments[0];
  const top = segment?.topAgeBand;
  if (out && call && segment && top) {
    const readers = Object.entries(brief.ages).sort(([, a], [, b]) => b - a)[0]?.[0];
    const women = segment.gender.female;
    const men = segment.gender.male;
    const skew =
      women !== undefined && men !== undefined && women !== men
        ? `, skewing towards ${women > men ? 'women' : 'men'}`
        : '';
    const against = readers
      ? top === readers
        ? `, the same age band as your book's readers`
        : `, where your book's readers peak at ${ageLabel(readers).toLowerCase()}`
      : '';
    kit.add(
      {
        id: `f-film-consult-audience-${slug(title.name)}`,
        query: 'bridge',
        text: `Asked as a screen title, ${title.name} draws its audience from ${ageLabel(top).toLowerCase()}${skew}${against}.`,
        entities: [entity(title.name, null, 'Film consult', title.entityId)],
        numbers: { [`affinity ${top}`]: round2(segment.age[top] ?? 0) },
        verdict: null,
        confidence: out.confidence,
        why: out.why,
      },
      call,
    );
  }

  const cities = brief.teamOrder.map((p) => p.place);
  if (cities.length === 0) return;
  const placed = await kit.safely('Film consult: cities', () =>
    tools.rankPlaces.run(kit.deps.tools, { entityIds: [title.entityId], places: cities }),
  );
  const ranked = placed
    ? rankPlacesOutputSchema
        .parse(placed.data)
        .places.filter((p) => p.status === 'ranked' && p.lift !== null)
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    : [];
  const [placeCall] = placed?.receipts ?? [];
  const first = ranked[0];
  if (!placeCall || !first) return;
  kit.add(
    {
      id: `f-film-consult-places-${slug(title.name)}`,
      query: 'bridge',
      text: `Of your cities, ${title.name}'s audience concentrates most in ${list(
        ranked.slice(0, 3).map((p) => `${p.place} (${round2(p.lift ?? 0)}x)`),
      )}.`,
      entities: ranked.map((p) => entity(p.place, p.affinity, null)),
      numbers: Object.fromEntries(ranked.map((p) => [`lift ${p.place}`, round2(p.lift ?? 0)])),
      verdict: null,
      confidence: first.confidence,
      why: first.why,
    },
    placeCall,
  );
}

interface Heard {
  shows: Podcast[];
  call: Receipt;
  confidence: Confidence;
  why: string;
}

/** The podcasts about books these readers hear, or none when no genre tag for them resolves. */
async function podcastsHeard(kit: Kit, booksTag: Tag | null): Promise<Heard | null> {
  const { deps, read, gaps } = kit;
  if (!booksTag) {
    gaps.push({
      item: 'Podcasts your readers hear',
      why: 'Qloo has no books tag for podcasts, so none were asked: without one the list drifts to what is popular overall.',
    });
    return null;
  }
  const run = await kit.safely('Podcasts your readers hear', () =>
    tools.findTaste.run(deps.tools, {
      entityIds: kit.ids,
      type: 'urn:entity:podcast',
      tags: [booksTag.id],
      city: null,
      ages: read.ages,
      take: PODCASTS_SHOWN,
      exclude: [],
    }),
  );
  if (!run) return null;
  const out = findTasteOutputSchema.parse(run.data);
  const [call] = run.receipts;
  const shows = out.candidates
    .filter((c) => c.affinity !== null)
    .map((c) => ({
      name: c.name,
      entityId: c.entityId,
      overlap: Math.round((c.affinity ?? 0) * 100),
    }));
  if (!call || shows.length === 0) {
    gaps.push({
      item: 'Podcasts your readers hear',
      why: 'Qloo returned no podcasts for these readers.',
    });
    return null;
  }
  kit.add(
    {
      id: 'f-podcasts',
      query: 'podcasts',
      text: `The podcasts about books that rank highest with your book's readers are ${list(shows.slice(0, 3).map((s) => s.name))}.`,
      entities: shows.map((s) => entity(s.name, s.overlap / 100, 'Podcast', s.entityId)),
      numbers: Object.fromEntries(shows.map((s) => [`overlap ${s.name}`, s.overlap])),
      verdict: null,
      confidence: out.confidence,
      why: out.why,
      context: { ages: read.ages },
    },
    call,
  );
  return { shows, call, confidence: out.confidence, why: out.why };
}

/** The themes and archetypes that describe the comps, for the positioning. */
async function themes(kit: Kit): Promise<void> {
  const { deps, gaps } = kit;
  const run = await kit.safely('Themes of your comparable books', () =>
    tools.themeTags.run(deps.tools, { entityIds: kit.ids, kinds: ['theme', 'archetype'] }),
  );
  if (!run) return;
  const out = themeTagsOutputSchema.parse(run.data);
  const wording: Record<string, (names: string) => string> = {
    theme: (names) => `Your comparable books share the themes ${names}.`,
    archetype: (names) => `The characters that readers meet in them are ${names}.`,
  };
  out.kinds.forEach((k, i) => {
    const call = run.receipts[i];
    if (!call || k.tags.length === 0) {
      gaps.push({ item: `Book ${k.kind}s`, why: 'Qloo returned none for the comparable books.' });
      return;
    }
    kit.add(
      {
        id: `f-themes-${k.kind}`,
        query: 'themes',
        text: (wording[k.kind] ?? ((n) => n))(
          list(k.tags.slice(0, 4).map((t) => t.name.toLowerCase())),
        ),
        entities: k.tags.map((t) => entity(t.name, t.affinity, null)),
        verdict: null,
        confidence: out.confidence,
        why: out.why,
      },
      call,
    );
  });
}

// Every phrase the plan needs, resolved to Qloo tags in one tool run. Unmatched ones drop out.
async function resolve(
  deps: GroundDeps,
  plan: BooksQueryPlan,
  want: (key: string) => boolean,
): Promise<Tags> {
  type Ask = { phrase: string; space: keyof typeof TAG_SPACES };
  const asks: Ask[] = [
    ...(want('shelf') && plan.genre ? [{ phrase: plan.genre, space: 'bookGenre' as const }] : []),
    ...(want('bridge') || want('podcasts')
      ? [{ phrase: 'books', space: 'bookGenre' as const }]
      : []),
    ...(want('brands')
      ? plan.brandCategories.slice(0, 2).map((phrase) => ({ phrase, space: 'brands' as const }))
      : []),
    ...(want('bookshops') ? [{ phrase: BOOKSHOP_PHRASE, space: 'bookshop' as const }] : []),
  ];
  if (asks.length === 0) return { genre: null, books: null, brands: [], bookshop: null };
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
  const at = (space: Ask['space'], phrase?: string) => {
    const i = asks.findIndex(
      (a) => a.space === space && (phrase === undefined || a.phrase === phrase),
    );
    return i === -1 ? null : tagFor(i);
  };
  return {
    genre: plan.genre ? at('bookGenre', plan.genre) : null,
    books: at('bookGenre', 'books'),
    brands: asks.flatMap((a, i) => (a.space === 'brands' ? (tagFor(i) ?? []) : [])),
    bookshop: at('bookshop'),
  };
}
