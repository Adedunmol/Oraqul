import {
  cityCountry,
  QlooBudgetError,
  resolveBundleOutputSchema,
  type ToolContext,
  tools,
} from '@oraqul/engine';
import { filmPlan } from '@oraqul/packs';
import {
  type Claim,
  type CompUsed,
  type Confidence,
  type Finding,
  type LaunchLine,
  type LaunchModuleKey,
  type LaunchPlan,
  type LaunchSection,
  type LaunchSectionKey,
  type Move,
  type OverallConfidence,
  type PlanSource,
  type Question,
  type Receipt,
  type StopReason,
  type ThreadEvent,
} from '@oraqul/schema';
import { z } from 'zod';
import {
  ATTACHMENT_CHARS,
  cutFiles,
  type Handoff,
  type NewOutput,
  type Reply,
} from '../category-agents.js';
import { ungroundedClaims } from '../grounding.js';
import { capital } from './brief.js';
import { type CheckContext, checkSections } from './check.js';
import { ensureDecisions } from './decisions.js';
import { type Grounded, ground, list } from './findings.js';
import type { Change } from './follow-up.js';
import type { QueryPlan, QueryPlanner } from './planner.js';
import { checkReading, type FilmRead, type FilmReader, filmReadSchema } from './read.js';
import type { Researcher } from './research.js';
import type { BuildState, FilmState } from './state.js';
import { CODE_SECTIONS, type PlanWriter, templateSection, type WriteInput } from './writer.js';

const { BUDGET_CONVENTION, pickModules } = filmPlan;

// A bundle needs 3 to 5 comps to be coherent (PRD C1). Below 3, proposals fill to 4.
const MIN_COMPS = 3;
const FILL_TO = 4;
const MAX_COMPS = 5;
const MAX_SEARCH = 8;
const FILM_TYPES = ['urn:entity:movie' as const, 'urn:entity:tv_show' as const];

const anchorSchema = z.object({
  entityId: z.string(),
  name: z.string(),
  popularity: z.number().nullable(),
});
export type Anchor = z.infer<typeof anchorSchema>;

const compUsedSchema = z.object({
  name: z.string(),
  source: z.enum(['you', 'added']),
  match: z.string().nullable(),
  choice: z.string().nullable(),
});

/** What a plan was built from, saved on the output so a what-if can rerun it with a change. */
export const filmInputsSchema = z.object({
  read: filmReadSchema,
  comps: z.array(z.string()),
  resolved: z.array(anchorSchema),
  dropped: z.array(z.object({ name: z.string(), why: z.string() })),
  /** Plans saved before comps were kept apart by source have none. */
  used: z.array(compUsedSchema).default([]),
});
export type FilmInputs = z.infer<typeof filmInputsSchema>;

export interface PlanRun {
  reason: StopReason;
  /** Set when the run stopped `waiting`, so the answer can resume it. */
  state: FilmState | null;
  /** Every receipt the run made, ready to save. Line receipts carry their `lineId`. */
  receipts: Receipt[];
  /** The run's last output, the one the chat works on next. */
  output: NewOutput | null;
  /** Outputs the run made before `output`, oldest first: the audit a fix is written from. */
  earlier?: NewOutput[];
  tokens: number;
}

export interface FilmDeps {
  reader: FilmReader;
  /** Looks up release timing and market facts on the web, when search is configured. */
  research: Researcher;
  queries: QueryPlanner;
  writer: PlanWriter;
  tools: ToolContext;
  emit(event: ThreadEvent): void;
}

function sectionOrder(modules: LaunchModuleKey[]): LaunchSectionKey[] {
  return ['bottom-line', 'positioning', 'audience', 'markets', ...modules, 'gaps'];
}

const rank: Record<Confidence, number> = { lower: 0, medium: 1, high: 2 };

export interface Anchors {
  resolved: Anchor[];
  used: CompUsed[];
  dropped: { name: string; why: string }[];
}

/** What one run keeps as it goes: its receipts, its tokens and its place in the trace. */
export interface RunCtx {
  receipts: Receipt[];
  tokens: number;
  trace(text: string): void;
  keep(made: Receipt[]): void;
  stop(
    reason: StopReason,
    state?: FilmState | null,
    output?: NewOutput | null,
    earlier?: NewOutput[],
  ): PlanRun;
}

export function runCtx(deps: Pick<FilmDeps, 'emit'>, total: number): RunCtx {
  const receipts: Receipt[] = [];
  let step = 0;
  const ctx: RunCtx = {
    receipts,
    tokens: 0,
    trace: (text) =>
      deps.emit({ type: 'trace.step', agent: 'film', step: ++step, of: total, text }),
    keep: (made) => {
      for (const receipt of made) {
        receipts.push(receipt);
        deps.emit({ type: 'receipt', receipt });
      }
    },
    stop: (reason, state = null, output = null, earlier) => ({
      reason,
      state,
      receipts,
      output,
      ...(earlier?.length ? { earlier } : {}),
      tokens: ctx.tokens,
    }),
  };
  return ctx;
}

/** The steps of a build, not counting the web step that exists only when search is configured. */
export const BUILD_STEPS = 6;

export interface Asked {
  modules: LaunchModuleKey[];
  queryPlan: QueryPlan;
  grounded: Grounded;
  sources: PlanSource[];
}

/**
 * Choose the queries, ask Qloo, and look up release timing on the web. Shared by the build and the
 * audit, so both test a plan against the same findings (spec §4.1).
 */
export async function askQloo(
  deps: FilmDeps,
  ctx: RunCtx,
  input: {
    title: string;
    read: FilmRead;
    comps: Anchors;
    /** The audit adds the partners a plan names to the candidates Qloo ranks. */
    adjust?: (plan: QueryPlan) => QueryPlan;
  },
): Promise<Asked> {
  const { title, read, comps } = input;
  ctx.trace('Choosing what to ask Qloo');
  const { modules } = pickModules({
    scope: read.scope,
    ask: read.ask,
    format: read.format,
    route: read.route,
    hasBudget: read.budget !== null,
  });
  const compsCountry = commonCountry(comps.used);
  const { plan: planned, tokens } = await deps.queries.plan({
    title,
    read,
    modules,
    compsCountry,
  });
  ctx.tokens += tokens;
  const queryPlan = input.adjust ? input.adjust(planned) : planned;

  ctx.trace('Asking Qloo about your audience');
  const grounded = await ground(
    { tools: deps.tools, emit: deps.emit, keep: ctx.keep },
    {
      read,
      anchors: comps.resolved,
      dropped: comps.dropped,
      plan: queryPlan,
      year: new Date().getFullYear(),
    },
  );

  let sources: PlanSource[] = [];
  if (deps.research.enabled) {
    ctx.trace('Checking release timing and the market');
    const found = await deps.research.research({
      read,
      country: queryPlan.country,
      cities: queryPlan.cities,
      today: new Date().toISOString().slice(0, 10),
    });
    sources = found.sources;
    ctx.tokens += found.tokens;
  }
  return { modules, queryPlan, grounded, sources };
}

/** The Film build (spec §4.1, §6.1): findings first, then the plan, every line checked. */
export async function runFilmBuild(
  handoff: Handoff,
  deps: FilmDeps,
  resume?: { state: BuildState; reply: Reply },
  /** A what-if: start from a saved plan's inputs with a change, instead of reading the brief. */
  from?: { inputs: FilmInputs; change: Change },
): Promise<PlanRun> {
  // The web step exists only when search is configured, so the count is set up front.
  const ctx = runCtx(deps, BUILD_STEPS + (deps.research.enabled ? 1 : 0));

  let read: FilmRead;
  let kind: 'build' | 'scenario' = 'build';
  let title = handoff.title;
  let extra = '';
  let known: Anchor[] = [];
  let knownUsed: CompUsed[] = [];
  let knownDropped: { name: string; why: string }[] = [];

  if (from) {
    ctx.trace('Applying your what-if to the plan');
    const changed = applyChange(from.inputs, from.change, handoff.title);
    ({ read, title } = changed);
    kind = 'scenario';
    known = changed.resolved;
    knownUsed = changed.used;
    knownDropped = changed.dropped;
    for (const a of known) deps.tools.entities.set(a.entityId, a);
  } else {
    if (resume) {
      extra = `${resume.state.extra}\n\n${replyText(resume.state, resume.reply)}`.trim();
      kind = resume.state.kind;
    } else {
      deps.emit({
        type: 'memory.used',
        items: [
          { source: 'project', label: 'your brief' },
          ...handoff.inputs.files
            .filter((f) => f.text)
            .map((f) => ({ source: 'project' as const, label: f.name })),
        ],
      });
    }
    ctx.trace('Reading your brief');
    const input = {
      title: handoff.title,
      text: [briefText(handoff), extra].filter(Boolean).join('\n\n'),
    };
    const { reading, tokens: used } = await deps.reader.read(input);
    ctx.tokens += used;
    read = checkReading(reading, input);

    // The only question a build ever asks: there is nothing to plan from without these (PRD C1).
    const missing = [
      read.genre || read.logline ? null : 'what the film or series is',
      read.places.length ? null : 'at least one city it opens in',
    ].filter((m): m is string => m !== null);
    if (missing.length && !resume) {
      const question: Question = {
        id: 'film.minimum',
        card: 'text',
        prompt: `To plan this I need ${list(missing)}. Everything else is optional.`,
        options: [],
        hint: 'For example: “A Nigerian crime thriller, opening in Lagos and London.”',
      };
      deps.emit({ type: 'question', agent: 'film', ...question });
      return ctx.stop('waiting', { job: 'build', kind, extra, asked: true, pending: question });
    }
  }

  ctx.trace('Finding the comps in Qloo');
  let comps: Anchors;
  try {
    comps = await findComps(deps, ctx.keep, read, known, knownUsed, knownDropped);
  } catch (err) {
    if (err instanceof QlooBudgetError) return budgetStop(deps, ctx);
    throw err;
  }
  if (comps.resolved.length === 0) {
    noCompsStop(deps, ctx, read);
    return ctx.stop('finished');
  }
  for (const a of comps.resolved) deps.tools.entities.set(a.entityId, a);

  const asked = await askQloo(deps, ctx, { title, read, comps });
  return writePlan(deps, ctx, {
    handoff,
    title,
    read,
    comps,
    asked,
    extra,
    kind,
    intro: `Here is the launch plan for “${title}”.`,
  });
}

/** Stage 2 and the check (spec §4.1, §6.2): write the plan from the findings, then check every line. */
export async function writePlan(
  deps: FilmDeps,
  ctx: RunCtx,
  input: {
    handoff: Handoff;
    title: string;
    read: FilmRead;
    comps: Anchors;
    asked: Asked;
    /** More of the person's words: the answer to a question, or the fixes an audit found. */
    extra: string;
    kind: 'build' | 'scenario' | 'fix';
    /** The chat line that introduces the plan. */
    intro: string;
    /** Characters of each file the writer may read. */
    chars?: number;
    /** The outputs this run made first, saved before the plan. */
    earlier?: NewOutput[];
  },
): Promise<PlanRun> {
  const { handoff, title, read, comps, asked, extra, kind } = input;
  const { modules, queryPlan, grounded, sources } = asked;
  const text = briefText(handoff, input.chars);

  ctx.trace('Writing the plan');
  const order = sectionOrder(modules);
  const writeInput: WriteInput = {
    title,
    request: [text, extra].filter(Boolean).join('\n\n'),
    read,
    comps: comps.used,
    sections: order,
    findings: grounded.findings,
    sources,
  };
  const written = await deps.writer.write(writeInput);
  ctx.tokens += written.tokens;

  ctx.trace('Checking every line');
  const checkCtx: CheckContext = {
    findings: grounded.findings,
    sources,
    briefNames: [
      title,
      ...comps.used.map((c) => c.name),
      ...read.places,
      ...read.cast,
      ...(read.director ? [read.director] : []),
      ...read.soundtrack,
      ...read.partners,
      ...(read.country ? [read.country] : []),
    ],
    briefText: [text, extra].join('\n'),
    teamCities: read.places,
    teamAges: read.ages,
    allowed: order,
  };
  const writerSections = written.sections.filter((s) => !CODE_SECTIONS.includes(s.key));
  const checked = checkSections(writerSections, checkCtx);
  // A core section the writer left out, or whose every line failed, comes from the templates.
  const core: LaunchSectionKey[] = ['bottom-line', 'positioning', 'audience', 'markets'];
  const empty = core.filter((key) => !checked.sections.some((s) => s.key === key));
  const filled = empty.length
    ? checkSections(
        empty.map((key) => ({ key, lines: templateSection(key, writeInput) })),
        checkCtx,
      )
    : { sections: [], dropped: [] };
  const codeSections = [
    ...(modules.includes('budget') ? [budgetSection(read)] : []),
    gapsSection(read, comps),
  ];
  const sections = ensureDecisions(
    order.flatMap((key) => {
      const s =
        checked.sections.find((x) => x.key === key) ??
        filled.sections.find((x) => x.key === key) ??
        codeSections.find((x) => x.key === key);
      return s ? [s] : [];
    }),
    {
      cities: read.places,
      ranked: grounded.brief.teamOrder.map((p) => p.place),
      findings: grounded.findings,
      home: homeMarket(read.places, queryPlan.country),
      comps: comps.used.filter((c) => c.source === 'you').map((c) => c.name),
    },
  );
  const plan: LaunchPlan = {
    scope: read.scope,
    sections,
    comps: comps.used,
    findings: grounded.findings,
    // Only the pages a kept line cites travel with the plan.
    sources: sources.filter((src) =>
      sections.some((sec) => sec.lines.some((l) => l.sourceIds.includes(src.id))),
    ),
    dropped: [...checked.dropped, ...filled.dropped],
    writer: written.by,
  };

  const bottom = sections.find((s) => s.key === 'bottom-line')?.lines ?? [];
  const moves: Move[] = bottom.map((l) => ({ text: l.text, lineId: l.findingIds[0] ?? null }));
  const headline =
    bottom[0]?.text ?? 'Qloo could not test enough of this plan to lead with anything yet.';
  const confidence = overall(bottom, grounded.findings);

  const reply = writeReply(input.intro, bottom, grounded.findings, deps.tools.source);
  if (ungroundedClaims(reply, ctx.receipts).length) {
    deps.emit({
      type: 'error',
      message: 'The plan cited a call this run did not make, so it was not saved.',
    });
    return ctx.stop('error');
  }
  deps.emit({ type: 'message', body: reply.message, claims: reply.claims });

  // Line receipts replace the call receipts they copy, so each call shows once per line.
  const lineReceipts = [...grounded.brief.lineReceipts, ...grounded.receipts];
  const cited = new Set(lineReceipts.map((r) => r.callId));
  ctx.receipts.splice(
    0,
    ctx.receipts.length,
    ...lineReceipts,
    ...ctx.receipts.filter((r) => !cited.has(r.callId)),
  );
  return ctx.stop(
    'finished',
    null,
    {
      kind,
      title,
      brief: {
        ...grounded.brief.brief,
        cannot: [
          ...grounded.brief.brief.cannot,
          ...grounded.gaps.map((g, i) => ({ id: `cant-q-${i + 1}`, item: g.item, reason: g.why })),
        ],
      },
      plan,
      report: null,
      headline,
      moves,
      confidence,
      inputs: {
        read,
        comps: comps.used.filter((c) => c.source === 'you').map((c) => c.name),
        resolved: comps.resolved,
        dropped: comps.dropped,
        used: comps.used,
      } satisfies FilmInputs,
    },
    input.earlier,
  );
}

/** No comp was found in Qloo, so there is nothing to describe the audience with. */
export function noCompsStop(deps: Pick<FilmDeps, 'emit'>, ctx: RunCtx, read: FilmRead): void {
  const tried = [...read.comps, ...read.suggestedComps];
  deps.emit({
    type: 'message',
    body: tried.length
      ? `Qloo did not find any of the comps by name (${tried.join(', ')}), so there is nothing to describe the audience with. Name a few films or series your audience watches, as they are usually written.`
      : 'I could not find comps for this launch, so there is nothing to describe the audience with. Name a few films or series your audience watches and I will plan from them.',
    claims: ctx.receipts
      .slice(0, 1)
      .map((r) => ({ text: 'Searched Qloo.', receiptIds: [r.callId] })),
  });
}

// The team's comps always, and they lead. Below 3, the model's proposals fill to 4, kept apart.
// A same-name match is settled by code from the country and popularity, and the choice is said.
export async function findComps(
  deps: FilmDeps,
  keep: (made: Receipt[]) => void,
  read: FilmRead,
  known: Anchor[],
  knownUsed: CompUsed[],
  knownDropped: { name: string; why: string }[],
): Promise<{ resolved: Anchor[]; used: CompUsed[]; dropped: { name: string; why: string }[] }> {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const resolved = [...known];
  const used = knownUsed.filter((u) => resolved.some((a) => same(a.name, u.name)));
  const dropped = [...knownDropped];
  const yours = read.comps
    .filter((c) => !resolved.some((a) => same(a.name, c)))
    .slice(0, MAX_COMPS);
  const proposals =
    read.comps.length >= MIN_COMPS
      ? []
      : read.suggestedComps.filter((c) => !read.comps.some((y) => same(y, c)));
  const names = [...yours, ...proposals].slice(0, MAX_SEARCH);
  if (names.length === 0) return { resolved, used, dropped };

  const { data, receipts } = await tools.resolveBundle.run(deps.tools, {
    names,
    types: FILM_TYPES,
  });
  keep(receipts);
  for (const a of resolveBundleOutputSchema.parse(data).anchors) {
    const mine = yours.some((y) => same(y, a.name));
    if (!mine && resolved.length >= FILL_TO) continue;
    if (resolved.length >= MAX_COMPS) break;
    if (a.status === 'found' && a.entityId) {
      const match = a.candidates.find((c) => c.entityId === a.entityId);
      resolved.push({ entityId: a.entityId, name: a.name, popularity: a.popularity });
      used.push({
        name: a.name,
        source: mine ? 'you' : 'added',
        match: match?.detail ?? null,
        choice: null,
      });
    } else if (a.status === 'ambiguous' && a.candidates.length) {
      const pick = settle(a.candidates, read.country);
      resolved.push({ entityId: pick.entityId, name: pick.name, popularity: pick.popularity });
      used.push({
        name: a.name,
        source: mine ? 'you' : 'added',
        match: pick.detail,
        choice: `Qloo has ${a.candidates.length} titles called “${a.name}”. I used the ${pick.detail ?? 'best known'} one, ${read.country && pick.detail?.includes(read.country) ? `from ${read.country} and ` : ''}the best known. Say which you mean if it is another.`,
      });
    } else if (mine) {
      dropped.push({
        name: a.name,
        why:
          a.status === 'failed'
            ? 'The search failed, so it was left out.'
            : 'Not found in Qloo by its exact name, so it was left out.',
      });
    }
  }
  used.sort((x, y) => (x.source === y.source ? 0 : x.source === 'you' ? -1 : 1));
  return { resolved, used, dropped };
}

// The same-name title to use: from the launch's country if one is, then the best known.
function settle(
  candidates: {
    entityId: string;
    name: string;
    popularity: number | null;
    detail: string | null;
  }[],
  country: string | null,
) {
  const score = (c: (typeof candidates)[number]) =>
    (country && c.detail?.toLowerCase().includes(country.toLowerCase()) ? 10 : 0) +
    (c.popularity ?? 0);
  return [...candidates].sort((a, b) => score(b) - score(a))[0] as (typeof candidates)[number];
}

export function commonCountry(used: CompUsed[]): string | null {
  const counts = new Map<string, number>();
  for (const u of used) {
    const country = u.match?.split('·').at(-1)?.trim();
    if (country && !/^\d+$/.test(country)) counts.set(country, (counts.get(country) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** A saved plan's inputs with a what-if applied. Comps already found are not searched again. */
export function applyChange(
  inputs: FilmInputs,
  change: Change,
  title: string,
): {
  title: string;
  read: FilmRead;
  resolved: Anchor[];
  used: CompUsed[];
  dropped: { name: string; why: string }[];
} {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const without = (items: string[], drop: string[]) =>
    items.filter((x) => !drop.some((d) => same(d, x)));
  const places = unique([...without(inputs.read.places, change.dropPlaces), ...change.addPlaces]);
  const comps = unique([...without(inputs.comps, change.dropComps), ...change.addComps]);
  const parts = [
    change.addPlaces.length ? `add ${change.addPlaces.join(', ')}` : '',
    change.dropPlaces.length ? `drop ${change.dropPlaces.join(', ')}` : '',
    change.addComps.length ? `add ${change.addComps.join(', ')}` : '',
    change.dropComps.length ? `drop ${change.dropComps.join(', ')}` : '',
    change.ages.length ? 'another age group' : '',
    change.gender ? `mostly ${change.gender === 'female' ? 'women' : 'men'}` : '',
  ].filter(Boolean);
  const kept = (name: string) => !change.dropComps.some((d) => same(d, name));
  const used = inputs.used.length
    ? inputs.used
    : inputs.resolved.map((a) => ({
        name: a.name,
        source: 'you' as const,
        match: null,
        choice: null,
      }));
  return {
    title: `${title}: ${parts.join(', ') || 'what-if'}`,
    read: {
      ...inputs.read,
      places,
      comps,
      ages: change.ages.length ? change.ages : inputs.read.ages,
      gender: change.gender ?? inputs.read.gender,
      // A what-if keeps the comps it was given; it does not propose more.
      suggestedComps: [],
    },
    resolved: inputs.resolved.filter((a) => kept(a.name)),
    used: used.filter((u) => kept(u.name)),
    dropped: inputs.dropped.filter((d) => comps.some((k) => same(k, d.name))),
  };
}

export function homeMarket(cities: string[], country: string | null): string | null {
  return country ? (cities.find((c) => cityCountry(c) === country) ?? null) : null;
}

function budgetSection(read: FilmRead): LaunchSection {
  const budget = read.budget;
  const money = (n: number) => `${budget?.currency ?? ''}${Math.round(n).toLocaleString('en-US')}`;
  const line = (id: string, text: string): LaunchLine => ({
    id,
    kind: 'playbook',
    text,
    findingIds: [],
    sourceIds: [],
    names: [],
    group: null,
  });
  return {
    key: 'budget',
    title: filmPlan.SECTION_TITLES.budget,
    lines: [
      line(
        'budget-1',
        budget
          ? `A starting split of ${money(budget.amount)}: adjust it with your distributor, and move money first to the cities with the strongest pre-sales.`
          : 'A starting split of the marketing budget, as shares: adjust it with your distributor, and move money first to the cities with the strongest pre-sales.',
      ),
      ...BUDGET_CONVENTION.map((c, i) =>
        line(
          `budget-${i + 2}`,
          budget
            ? `${c.line}: ${Math.round(c.share * 100)}%, ${money(budget.amount * c.share)}.`
            : `${c.line}: ${Math.round(c.share * 100)}%.`,
        ),
      ),
    ],
  };
}

function gapsSection(read: FilmRead, comps: { used: CompUsed[] }): LaunchSection {
  // Only inputs the team could add. What could not be asked goes to the Assumptions tab instead.
  const texts = [
    ...(comps.used.some((c) => c.source === 'added')
      ? [
          'Name two or three films your audience also watches, and every recommendation gets sharper.',
        ]
      : []),
    ...(read.ages.length
      ? []
      : ['Say who the film is for (an age range), and the campaign can aim at them.']),
    ...(read.window
      ? []
      : ['Add a release date or window, and the timeline turns into real dates.']),
    ...(read.route
      ? []
      : ['Say whether it goes to cinemas, a platform or both, and the release route firms up.']),
    ...(read.budget ? [] : ['Add a marketing budget, and the split turns into amounts.']),
  ];
  return {
    key: 'gaps',
    title: filmPlan.SECTION_TITLES.gaps,
    lines: texts.map((text, i) => ({
      id: `gaps-${i + 1}`,
      kind: 'playbook',
      text,
      findingIds: [],
      sourceIds: [],
      names: [],
      group: null,
    })),
  };
}

// Spec §5.1: the lowest confidence of the findings behind the bottom line.
function overall(bottom: LaunchLine[], findings: Finding[]): OverallConfidence {
  const behind = bottom.flatMap((l) =>
    l.findingIds.flatMap((id) => findings.find((f) => f.id === id) ?? []),
  );
  const lowest = [...behind].sort((a, b) => rank[a.confidence] - rank[b.confidence])[0];
  if (!lowest)
    return { level: 'low', why: 'Nothing in the bottom line could be tested against Qloo.' };
  // The output schema still names the lowest level `low`; lines use `lower` (open decision).
  return {
    level: lowest.confidence === 'lower' ? 'low' : lowest.confidence,
    why: lowest.why
      ? `${capital(lowest.why)}.`
      : 'Set by the weakest finding behind the bottom line.',
  };
}

export function budgetStop(deps: Pick<FilmDeps, 'emit'>, ctx: RunCtx): PlanRun {
  deps.emit({
    type: 'message',
    body: 'I stopped because the Qloo call budget for this run is spent. Nothing past this point was tested, so no plan was saved.',
    claims: [],
  });
  return ctx.stop('budget');
}

/** The first message, its files, and this run's message when it is a different one. */
export function briefText(
  { inputs, message }: Handoff,
  /** Most characters of each file to read: a brief is cut short, a plan to audit is not. */
  chars = ATTACHMENT_CHARS,
): string {
  const part = (said: Handoff['inputs']) => {
    const { text, files } = cutFiles(said, chars);
    return [text, ...files.flatMap((f) => (f.text ? [`[File: ${f.name}]\n${f.text}`] : []))]
      .filter(Boolean)
      .join('\n\n');
  };
  const first = part(inputs);
  const now = part(message);
  return now && now !== first ? `${first}\n\n${now}` : first;
}

export function replyText(state: { pending: Question | null }, reply: Reply): string {
  if (reply.kind === 'typed' || reply.kind === 'text') return reply.text;
  const pending = state.pending;
  return pending
    ? pending.options
        .filter((o) => reply.optionIds.includes(o.id))
        .map((o) => o.label)
        .join(', ')
    : '';
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// The chat gives the bottom line and opens the plan (spec §4.1, §6.1). Every grounded move is a
// claim citing the calls behind its findings.
function writeReply(
  intro: string,
  bottom: LaunchLine[],
  findings: Finding[],
  source: Receipt['source'],
): { message: string; claims: Claim[] } {
  const claims: Claim[] = bottom.flatMap((l) => {
    const ids = l.findingIds.flatMap((id) => findings.find((f) => f.id === id)?.callIds ?? []);
    return ids.length ? [{ text: l.text, receiptIds: [...new Set(ids)] }] : [];
  });
  // The plan follows in full below this line, so the message only introduces it.
  const message = [intro, source === 'demo' ? 'This run used demo data, not live Qloo.' : '']
    .filter(Boolean)
    .join(' ');
  return { message, claims };
}
