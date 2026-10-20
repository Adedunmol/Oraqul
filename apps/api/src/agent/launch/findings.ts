import {
  audienceOutputSchema,
  findTasteOutputSchema,
  QlooBudgetError,
  QlooError,
  rankPlacesOutputSchema,
  resolveBundleOutputSchema,
  type TasteType,
  type ToolContext,
  tools,
  toReceipt,
} from '@oraqul/engine';
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
import { normalise } from '../router/decide.js';
import {
  type BriefLabels,
  buildBrief,
  type LaunchBrief,
  round2,
  slug,
  type Tested,
} from './brief.js';
import type { QueryPlanCore } from './planner.js';
import type { LaunchRead } from './read-core.js';
import { agesPhrase, capitalise, list } from './text.js';

export { agesPhrase, capitalise, list, plural } from './text.js';

// Candidates a finding keeps for the writer to pick from. Its sentence names the first three.
export const KEEP = 6;
export const NAMED = 3;

export interface GroundDeps {
  tools: ToolContext;
  emit(event: ThreadEvent): void;
  keep(made: Receipt[]): void;
}

export interface GroundInput<R extends LaunchRead, P extends QueryPlanCore> {
  read: R;
  anchors: { entityId: string; name: string; popularity: number | null }[];
  dropped: { name: string; why: string }[];
  plan: P;
  year: number;
}

export interface Grounded {
  findings: Finding[];
  /** One receipt per finding, a copy of its call with `lineId` set to the finding's id. */
  receipts: Receipt[];
  brief: LaunchBrief;
  /** What could not be asked or came back empty, for the Gaps section. */
  gaps: { item: string; why: string }[];
  /** True when the call budget ran out before every query ran. */
  budgetOut: boolean;
}

type Add = (
  finding: Omit<Finding, 'callIds' | 'numbers' | 'context'> & {
    numbers?: Record<string, number>;
    context?: Partial<FindingContext>;
  },
  call: Receipt,
) => void;

/** How a category talks about the audience it measures. */
export interface Voice {
  /** "the comps' audience" */
  audience: string;
  /** "your comps' audience" */
  yourAudience: string;
  /** "these comps" */
  theseComps: string;
  /** What the unstated "the anchors describe one audience" test says, by verdict. */
  compsVerdict: Record<Verdict, string>;
  /** What the places are called in the markets finding. Defaults to "your cities". */
  yourPlaces?: string;
}

/** What a category adds to the shared grounding step. */
export interface GroundSpec<R extends LaunchRead, P extends QueryPlanCore> {
  voice: Voice;
  labels(read: R): BriefLabels;
  /** The order findings are listed in, by query key. */
  queryOrder: readonly string[];
  /** The category's own queries, run after the core ones. Push work onto `kit.jobs`. */
  runQueries(kit: GroundKit<R, P>): Promise<void>;
  /** Cities to rank as the team's when it named none. They are in `plan.worthALook`. */
  standInPlaces?(read: R, plan: P): string[];
}

/** The tools a category's queries use. */
export interface GroundKit<R extends LaunchRead, P extends QueryPlanCore> {
  deps: GroundDeps;
  read: R;
  plan: P;
  /** The Qloo ids of the anchors. */
  ids: string[];
  year: number;
  /** The audience, cities and assumptions already tested, which a category may extend. */
  brief: LaunchBrief;
  gaps: Grounded['gaps'];
  add: Add;
  want(key: string): boolean;
  /** Work started by the queries and awaited together. */
  jobs: Promise<void>[];
  /** Asks Qloo what the anchors' audience likes in one entity type and records a finding. */
  taste(
    key: string,
    label: string,
    id: string,
    shape: {
      type: TasteType;
      tags?: string[];
      city?: string | null;
      country?: string | null;
      yearFrom?: number | null;
      ages?: string[];
      /** Rank only these, so the answer is among candidates that could really say yes. */
      only?: string[];
    },
    sentence: (names: string) => string,
    context: Partial<FindingContext>,
  ): Promise<void>;
  /** Runs a query and turns a failed call into a gap with its receipt. */
  safely<T extends { receipts: Receipt[] }>(
    label: string,
    run: () => Promise<T>,
  ): Promise<T | null>;
}

const rank: Record<Confidence, number> = { lower: 0, medium: 1, high: 2 };

/**
 * Stage 1 (spec §4.1). Each finding is streamed to the chat as it lands. Numbers and verdicts are
 * computed here or in the engine, never by the model.
 */
export async function ground<R extends LaunchRead, P extends QueryPlanCore>(
  deps: GroundDeps,
  input: GroundInput<R, P>,
  spec: GroundSpec<R, P>,
): Promise<Grounded> {
  const { read, plan } = input;
  const ids = input.anchors.map((a) => a.entityId);
  const findings: Finding[] = [];
  const receipts: Receipt[] = [];
  const gaps: Grounded['gaps'] = [];
  let budgetOut = false;

  const add: Add = (finding, call) => {
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

  const want = (key: string) => plan.queries.includes(key);

  // Core: the comps' audience and the team's cities, in parallel. The neighbourhoods are read
  // from the same heatmap, so they cost no call of their own.
  const places = [...plan.cities, ...plan.worthALook].slice(0, 30);
  const areas = want('areas') ? plan.areas : [];
  const [audience, ranked] = await Promise.all([
    test(deps, 'audienceBySegment', { entityIds: ids }, audienceOutputSchema),
    places.length
      ? test(deps, 'rankPlaces', { entityIds: ids, places, areas }, rankPlacesOutputSchema)
      : Promise.resolve<Tested<z.infer<typeof rankPlacesOutputSchema>>>({
          data: null,
          why: 'No cities were given, so none could be ranked.',
        }),
  ]);
  const brief = buildBrief({
    read,
    labels: spec.labels(read),
    anchors: input.anchors,
    dropped: input.dropped,
    audience,
    places: ranked,
    worthALook: plan.worthALook,
    standInPlaces: read.places.length ? undefined : spec.standInPlaces?.(read, plan),
  });
  coreFindings(brief, read, add, gaps, audience, ranked, spec.voice);
  areaFindings(ranked, add, spec.voice);

  const safely = <T extends { receipts: Receipt[] }>(label: string, run: () => Promise<T>) =>
    guarded(deps, gaps, label, run);

  const taste: GroundKit<R, P>['taste'] = async (key, label, id, shape, sentence, context) => {
    const run = await safely(label, () =>
      tools.findTaste.run(deps.tools, {
        entityIds: ids,
        take: Math.min(Math.max(KEEP, shape.only?.length ?? 0), 10),
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

  const kit: GroundKit<R, P> = {
    deps,
    read,
    plan,
    ids,
    year: input.year,
    brief,
    gaps,
    add,
    want,
    jobs: [],
    taste,
    safely,
  };
  try {
    await spec.runQueries(kit);
    await Promise.all(kit.jobs);
  } catch (err) {
    if (!(err instanceof QlooBudgetError)) throw err;
    budgetOut = true;
    gaps.push({
      item: 'The rest of the queries',
      why: 'The Qloo call budget for this run ran out before every query ran.',
    });
  }

  const at = (query: string) => {
    const i = spec.queryOrder.indexOf(query);
    return i === -1 ? spec.queryOrder.length : i;
  };
  findings.sort((a, b) => at(a.query) - at(b.query) || a.id.localeCompare(b.id));
  return { findings, receipts, brief, gaps, budgetOut };
}

function coreFindings<R extends LaunchRead>(
  b: LaunchBrief,
  read: R,
  add: Add,
  gaps: Grounded['gaps'],
  audience: Tested<z.infer<typeof audienceOutputSchema>>,
  ranked: Tested<z.infer<typeof rankPlacesOutputSchema>>,
  voice: Voice,
) {
  const receiptOf = (lineId: string) => b.lineReceipts.find((r) => r.lineId === lineId);
  const reason = (lineId: string) => b.reasons.get(lineId) ?? '';
  const Yours = capitalise(voice.yourAudience);

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
        text: `${Yours} is strongest among people ${top.map((s) => s.name.toLowerCase().replace(/^aged /, 'aged ')).join(', then ')}${women && men && Math.abs(women.affinity - men.affinity) >= 6 ? `, and leans ${women.affinity > men.affinity ? 'female' : 'male'}` : ''}.`,
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
    const text = plainVerdict(a.id, a.verdict, a.text, read, voice);
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
        text: `Among ${voice.yourPlaces ?? 'your cities'}, ${voice.yourAudience} is strongest in ${first?.place}${rest.length ? `, then ${list(rest.map((p) => p.place))}` : ''}.`,
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
          text: `${list(b.worth.map((p) => p.place))} ${b.worth.length > 1 ? 'have' : 'has'} a stronger audience for ${voice.theseComps} than ${weakest?.place ?? 'your weakest city'}.`,
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

// A verdict in the words a marketing team would use. The technical reason stays on the finding.
function plainVerdict(
  id: string,
  verdict: Verdict,
  subject: string,
  read: LaunchRead,
  voice: Voice,
): string {
  const crowd = voice.audience;
  const Crowd = capitalise(crowd);
  if (id === 'a-age') {
    const band = agesPhrase(read.ages);
    return {
      holds: `Your target (${band}) is where ${crowd} is strongest.`,
      weak: `Your target (${band}) is a smaller part of ${crowd} than older groups.`,
      breaks: `${Crowd} skews older than your target (${band}).`,
      cant: `Your target (${band}) could not be compared with ${crowd}.`,
    }[verdict];
  }
  if (id === 'a-gender') {
    const who = read.gender === 'female' ? 'women' : 'men';
    return {
      holds: `${Crowd} does lean towards ${who}.`,
      weak: `${Crowd} is fairly even, with only a slight lean towards ${who}.`,
      breaks: `${Crowd} leans away from ${who}.`,
      cant: `The gender of ${crowd} could not be compared.`,
    }[verdict];
  }
  if (id === 'a-comps') return voice.compsVerdict[verdict];
  const city = subject.replace(/ is a strong market.*$/, '');
  return {
    holds: `${city} is one of the strongest cities for this audience.`,
    weak: `${city} is an average city for this audience.`,
    breaks: `${city} has a smaller audience for ${voice.theseComps} than your other cities.`,
    cant: `${city} could not be compared with your other cities.`,
  }[verdict];
}

// Brands the planner named that Qloo found: by exact name, or by the company's fuller name ("MTN"
// is "MTN Group"), which is how a brand is usually written and how Qloo often lists it. This is
// the pool Qloo ranks for the audience.
export async function brandPool(deps: GroundDeps, names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  try {
    const { data, receipts } = await tools.resolveBundle.run(deps.tools, {
      names: names.slice(0, 4),
      types: ['urn:entity:brand'],
    });
    deps.keep(receipts);
    const ids = resolveBundleOutputSchema.parse(data).anchors.flatMap((a) => {
      if (a.status === 'found' && a.entityId) return [a.entityId];
      const want = normalise(a.name);
      const fuller = a.candidates
        .filter((c) => normalise(c.name).startsWith(`${want} `))
        .sort((x, y) => (y.popularity ?? 0) - (x.popularity ?? 0))[0];
      return fuller ? [fuller.entityId] : [];
    });
    return [...new Set(ids)];
  } catch (err) {
    // A failed lookup leaves the pool empty and the brands asked by category instead.
    if (err instanceof QlooBudgetError || !(err instanceof QlooError)) throw err;
    keepFailure(deps, err);
    return [];
  }
}

function areaFindings(
  ranked: Tested<z.infer<typeof rankPlacesOutputSchema>>,
  add: Add,
  voice: Voice,
) {
  if (!ranked.data) return;
  const cities = [...new Set(ranked.data.areas.map((a) => a.city))];
  for (const city of cities) {
    const rows = ranked.data.areas.filter((a) => a.city === city).sort((a, b) => a.rank - b.rank);
    if (rows.length < 2) continue;
    const place = ranked.data.places.find((p) => p.place === city);
    add(
      {
        id: `f-areas-${slug(city)}`,
        query: 'areas',
        text: `In ${city}, ${voice.yourAudience} is strongest in ${list(rows.slice(0, 4).map((r) => r.name))}.`,
        entities: rows.map((r) => entity(r.name, r.affinity, null)),
        numbers: Object.fromEntries(rows.map((r) => [`lift ${r.name}`, round2(r.lift ?? 0)])),
        verdict: null,
        // A few cells near each centre is a lead, not a measurement: never above medium.
        confidence: place && rank[place.confidence] < rank.medium ? place.confidence : 'medium',
        why: place?.why ?? '',
        context: { city },
      },
      ranked.receipt,
    );
  }
}

// Runs one core test. A failed call is "could not test" with its receipt, never a filled-in value.
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

// A query that failed becomes a gap with its receipt. A spent budget stops every query.
async function guarded<T extends { receipts: Receipt[] }>(
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
// (a square or abbey at popularity 1.0, a hotel or mall among cinemas). Neither is somewhere to
// screen a film or meet a community, so code leaves them out before the writer sees the list.
const LANDMARK_POPULARITY = 0.999;
const NOT_A_VENUE = /\b(hotel|mall|shopping|flea|market|resort|spa|square)\b/i;

function isVenue(c: { name: string; popularity: number | null }): boolean {
  return (c.popularity ?? 0) < LANDMARK_POPULARITY && !NOT_A_VENUE.test(c.name);
}

export function entity(
  name: string,
  affinity: number | null,
  detail: string | null,
  entityId: string | null = null,
): FindingEntity {
  return { entityId, name, affinity, detail };
}

// Every number written in a finding's text, so a line may quote any of them.
function numbersIn(text: string): Record<string, number> {
  return Object.fromEntries(
    [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map((m, i) => [`n${i}`, Number(m[0])]),
  );
}
