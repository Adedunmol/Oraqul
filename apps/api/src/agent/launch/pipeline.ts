import {
  cityCountry,
  insights,
  normalizeTitle,
  QlooBudgetError,
  QlooError,
  resolveBundleOutputSchema,
  resolveTagsOutputSchema,
  type ToolContext,
  tools,
  toReceipt,
} from '@oraqul/engine';
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
  type PlanReview,
  type PlanSource,
  type Question,
  type Receipt,
  type StopReason,
  type ThreadEvent,
  type Understanding,
  understandingSchema,
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
import { applyAnalysis, ScriptedAnalyst } from './analyse.js';
import { capital } from './brief.js';
import { type CheckContext, checkSections } from './check.js';
import type { LaunchConfig, LaunchDeps } from './config.js';
import { ensureDecisions } from './decisions.js';
import { evidenceBlock } from './evidence.js';
import type { Grounded } from './findings.js';
import type { Change } from './follow-up.js';
import type { QueryPlanCore } from './planner.js';
import type { LaunchRead } from './read-core.js';
import {
  applyAssessment,
  applyRound2,
  MAX_EXTRA,
  MIN_CALLS_LEFT,
  ScriptedResearchPlanner,
} from './research-loop.js';
import { feedbackLines, judge, MAX_ROUNDS, reviewOf, ScriptedReviewer } from './review.js';
import type { BuildState, LaunchState } from './state.js';
import { list } from './text.js';
import { CODE_SECTIONS, type WriteInput } from './writer.js';

// A bundle needs 3 to 5 comps to be coherent (PRD C1). Below 3, proposals fill to 4.
const MIN_COMPS = 3;
const FILL_TO = 4;
const MAX_COMPS = 5;
const MAX_SEARCH = 8;

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
export const launchInputsSchema = <S extends z.ZodType>(read: S) =>
  z.object({
    read,
    comps: z.array(z.string()),
    resolved: z.array(anchorSchema),
    dropped: z.array(z.object({ name: z.string(), why: z.string() })),
    /** Plans saved before comps were kept apart by source have none. */
    used: z.array(compUsedSchema).default([]),
    /** How the request was read. Plans saved before the analyst have none. */
    understanding: understandingSchema.nullable().default(null),
  });
export interface LaunchInputs<R extends LaunchRead = LaunchRead> {
  read: R;
  comps: string[];
  resolved: Anchor[];
  dropped: { name: string; why: string }[];
  used: CompUsed[];
  understanding?: Understanding | null;
}

export interface PlanRun {
  reason: StopReason;
  /** Set when the run stopped `waiting`, so the answer can resume it. */
  state: LaunchState | null;
  /** Every receipt the run made, ready to save. Line receipts carry their `lineId`. */
  receipts: Receipt[];
  /** The run's last output, the one the chat works on next. */
  output: NewOutput | null;
  /** Outputs the run made before `output`, oldest first: the audit a fix is written from. */
  earlier?: NewOutput[];
  tokens: number;
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
    state?: LaunchState | null,
    output?: NewOutput | null,
    earlier?: NewOutput[],
  ): PlanRun;
}

export function runCtx(
  deps: { emit(event: ThreadEvent): void; config: Pick<LaunchConfig, 'category'> },
  total: number,
): RunCtx {
  const receipts: Receipt[] = [];
  let step = 0;
  const ctx: RunCtx = {
    receipts,
    tokens: 0,
    trace: (text) => {
      step += 1;
      deps.emit({
        type: 'trace.step',
        agent: deps.config.category,
        step,
        of: Math.max(total, step),
        text,
      });
    },
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
export const BUILD_STEPS = 9;

export interface Asked<P extends QueryPlanCore = QueryPlanCore> {
  modules: LaunchModuleKey[];
  queryPlan: P;
  grounded: Grounded;
  /** Every query any round has run, so a later round only offers the rest. */
  ran: string[];
  sources: PlanSource[];
  /** The request's checks with what the research found for each, when the run read one. */
  understanding: Understanding | null;
}

/**
 * A later round of research: the catalog queries asked for, run on the brief the first round
 * built and merged into its findings. Each check an extra query was for is marked from what that
 * query found.
 */
async function runExtra<R extends LaunchRead, P extends QueryPlanCore>(
  deps: LaunchDeps<R, P>,
  ctx: RunCtx,
  input: {
    title: string;
    read: R;
    comps: Anchors;
    queryPlan: P;
    grounded: Grounded;
    understanding: Understanding;
    extra: { query: string; check: string; why: string }[];
  },
): Promise<{ grounded: Grounded; understanding: Understanding }> {
  const { grounded, extra } = input;
  const labels = extra.map(
    (e) => deps.config.catalog.find((q) => q.key === e.query)?.label ?? e.query,
  );
  ctx.trace(`Looking wider: ${list(labels)}`);
  const more = await deps.config.ground(
    { tools: deps.tools, emit: deps.emit, keep: ctx.keep },
    {
      read: input.read,
      anchors: input.comps.resolved,
      dropped: input.comps.dropped,
      plan: { ...input.queryPlan, queries: extra.map((e) => e.query) },
      year: new Date().getFullYear(),
      more: { brief: grounded.brief },
    },
  );
  const merged: Grounded = {
    ...grounded,
    findings: [...grounded.findings, ...more.findings],
    receipts: [...grounded.receipts, ...more.receipts],
    gaps: [...grounded.gaps, ...more.gaps],
    budgetOut: grounded.budgetOut || more.budgetOut,
  };
  return {
    grounded: merged,
    understanding: applyRound2(input.understanding, more.findings, extra, merged.findings),
  };
}

/**
 * Choose the queries, ask Qloo, and look up release timing on the web. Shared by the build and the
 * audit, so both test a plan against the same findings (spec §4.1).
 */
export async function askQloo<R extends LaunchRead, P extends QueryPlanCore>(
  deps: LaunchDeps<R, P>,
  ctx: RunCtx,
  input: {
    title: string;
    read: R;
    comps: Anchors;
    /** The audit adds the partners a plan names to the candidates Qloo ranks. */
    adjust?: (plan: P) => P;
    /** How the request was read. With it, a second round covers what the first left thin. */
    understanding?: Understanding | null;
  },
): Promise<Asked<P>> {
  const { title, read, comps } = input;
  ctx.trace('Choosing what to ask Qloo');
  const { modules } = deps.config.pickModules(read);
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
  const groundDeps = { tools: deps.tools, emit: deps.emit, keep: ctx.keep };
  const groundInput = {
    read,
    anchors: comps.resolved,
    dropped: comps.dropped,
    plan: queryPlan,
    year: new Date().getFullYear(),
  };
  let grounded = await deps.config.ground(groundDeps, groundInput);

  let understanding = input.understanding ?? null;
  const extraKeys: string[] = [];
  if (understanding) {
    ctx.trace('Checking what the research covers');
    const ran = new Set(queryPlan.queries);
    const unrun = deps.config.catalog.filter((q) => !ran.has(q.key) && q.key !== 'areas');
    const callsLeft = deps.tools.qloo.callsLeft;
    const judged = await (deps.researchPlanner ?? new ScriptedResearchPlanner()).assess({
      category: deps.config.category,
      title,
      understanding,
      findings: grounded.findings,
      gaps: grounded.gaps,
      unrun,
      callsLeft,
    });
    ctx.tokens += judged.tokens;
    const applied = applyAssessment(
      understanding,
      grounded.findings,
      judged.assessment,
      unrun,
      callsLeft,
    );
    understanding = applied.understanding;
    if (applied.extra.length) {
      extraKeys.push(...applied.extra.map((e) => e.query));
      ({ grounded, understanding } = await runExtra(deps, ctx, {
        title,
        read,
        comps,
        queryPlan,
        grounded,
        understanding,
        extra: applied.extra,
      }));
    }
  }

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
  const ran = [...new Set([...queryPlan.queries, ...extraKeys])];
  return { modules, queryPlan, grounded, ran, sources, understanding };
}

/** The build (spec §4.1, §6.1): findings first, then the plan, every line checked. */
export async function runBuild<R extends LaunchRead, P extends QueryPlanCore>(
  handoff: Handoff,
  deps: LaunchDeps<R, P>,
  resume?: { state: BuildState; reply: Reply },
  /** A what-if: start from a saved plan's inputs with a change, instead of reading the brief. */
  from?: { inputs: LaunchInputs<R>; change: Change },
): Promise<PlanRun> {
  // The web step exists only when search is configured, so the count is set up front.
  const ctx = runCtx(deps, BUILD_STEPS + (deps.research.enabled ? 1 : 0));

  let read: R;
  let kind: 'build' | 'scenario' = 'build';
  let title = handoff.title;
  let extra = '';
  let known: Anchor[] = [];
  let knownUsed: CompUsed[] = [];
  let knownDropped: { name: string; why: string }[] = [];
  let understanding: Understanding | null = null;

  if (from) {
    ctx.trace('Applying your what-if to the plan');
    const changed = applyChange(from.inputs, from.change, handoff.title, deps.config.applyChange);
    ({ read, title } = changed);
    kind = 'scenario';
    known = changed.resolved;
    understanding = from.inputs.understanding ?? applyAnalysis(read, null).understanding;
    knownUsed = changed.used;
    knownDropped = changed.dropped;
    for (const a of known) deps.tools.entities.set(a.entityId, a);
  } else {
    if (resume) {
      extra = `${resume.state.extra}\n\n${replyText(resume.state, resume.reply)}`.trim();
      kind = resume.state.kind;
    }
    ctx.trace('Reading your brief');
    const input = {
      title: handoff.title,
      text: [briefText(handoff, undefined, true), extra].filter(Boolean).join('\n\n'),
    };
    const reading = await deps.read(input);
    ctx.tokens += reading.tokens;
    read = reading.read;

    ctx.trace('Working out what you need');
    const analysed = await (deps.analyst ?? new ScriptedAnalyst()).analyse({
      category: deps.config.category,
      title: handoff.title,
      text: input.text,
      read,
    });
    ctx.tokens += analysed.tokens;
    ({ read, understanding } = applyAnalysis(read, analysed.analysis));

    // The only question a build ever asks: there is nothing to plan from without these (PRD C1).
    const missing = deps.config.minimum.missing(read);
    if (missing.length && (!resume || deps.config.minimum.strict)) {
      const question: Question = {
        id: deps.config.minimum.id,
        card: 'text',
        prompt: `To plan this I need ${list(missing)}. Everything else is optional.`,
        options: [],
        hint: deps.config.minimum.example,
      };
      deps.emit({ type: 'question', agent: deps.config.category, ...question });
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
    ctx.trace('No comp found, so reading the genre in Qloo');
    try {
      comps = { ...comps, ...(await findGenreComps(deps, ctx.keep, read)) };
    } catch (err) {
      if (err instanceof QlooBudgetError) return budgetStop(deps, ctx);
      throw err;
    }
  }
  if (comps.resolved.length === 0) {
    noCompsStop(deps, ctx, read);
    return ctx.stop('finished');
  }
  for (const a of comps.resolved) deps.tools.entities.set(a.entityId, a);

  const asked = await askQloo(deps, ctx, { title, read, comps, understanding });
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

/**
 * Stage 2 and the check (spec §4.1, §6.2): write the plan from the findings, check every line, then
 * let the red team compare the draft with the request. A draft with a blocking issue is written
 * again, with the issues, after more research when the issue asks for it. Nothing is saved until
 * the loop ends: a draft that passed, or the last one with its open issues flagged.
 */
export async function writePlan<R extends LaunchRead, P extends QueryPlanCore>(
  deps: LaunchDeps<R, P>,
  ctx: RunCtx,
  input: {
    handoff: Handoff;
    title: string;
    read: R;
    comps: Anchors;
    asked: Asked<P>;
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
  const { modules, queryPlan, sources } = asked;
  const text = briefText(handoff, input.chars, kind !== 'fix');
  const order = sectionOrder(modules);
  const today = new Date().toISOString().slice(0, 10);
  // A section code writes whole, such as Games' launch beats, is not the writer's to write.
  const byCode = deps.config.codeSections.timeline && modules.includes('timeline');
  const core: LaunchSectionKey[] = ['bottom-line', 'positioning', 'audience', 'markets'];
  // What the writer cannot change, so the red team does not send a draft back for it.
  const codeSections: string[] = [...CODE_SECTIONS, ...(byCode ? ['timeline'] : [])];

  let grounded = asked.grounded;
  let understanding = asked.understanding;
  let ran = asked.ran;

  const draft = async (feedback: string[]) => {
    const writeInput: WriteInput<R> = {
      title,
      request: [text, extra].filter(Boolean).join('\n\n'),
      read,
      comps: comps.used,
      sections: byCode ? order.filter((key) => key !== 'timeline') : order,
      findings: grounded.findings,
      sources,
      today,
      understanding,
      evidence: understanding
        ? evidenceBlock(understanding.criteria, grounded.findings)
        : undefined,
      feedback,
    };
    const written = await deps.writer.write(writeInput);
    ctx.tokens += written.tokens;

    ctx.trace('Checking every line');
    const checkCtx: CheckContext = {
      findings: grounded.findings,
      sources,
      briefNames: [title, ...comps.used.map((c) => c.name), ...deps.config.briefNames.build(read)],
      briefText: [text, extra].join('\n'),
      teamCities: read.places,
      teamAges: read.ages,
      allowed: order,
      rules: deps.config.rules,
    };
    const writerSections = written.sections.filter(
      (s) => !CODE_SECTIONS.includes(s.key) && !(byCode && s.key === 'timeline'),
    );
    const checked = checkSections(writerSections, checkCtx);
    // A core section the writer left out, or whose every line failed, comes from the templates.
    const empty = core.filter((key) => !checked.sections.some((s) => s.key === key));
    const filled = empty.length
      ? checkSections(
          empty.map((key) => ({ key, lines: deps.config.templateSection(key, writeInput) })),
          checkCtx,
        )
      : { sections: [], dropped: [] };
    const codeSections = [
      ...(modules.includes('budget') ? [deps.config.codeSections.budget(read)] : []),
      ...(byCode && deps.config.codeSections.timeline
        ? [deps.config.codeSections.timeline(read, today)]
        : []),
      deps.config.codeSections.gaps(read, comps),
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
      deps.config.decisions,
    );
    return {
      sections,
      dropped: [...checked.dropped, ...filled.dropped],
      by: written.by,
    };
  };

  const reviewer = deps.reviewer ?? new ScriptedReviewer();
  const rounds: PlanReview['rounds'] = [];
  let status: PlanReview['status'] = 'unchecked';
  let next: string[] = [];
  let feedback: string[] = [];
  let lastBlocking = new Set<string>();
  let current = await (async () => {
    ctx.trace('Writing the plan');
    return draft(feedback);
  })();

  // A fix is written from an audit that already tested the plan, so only a build is reviewed.
  for (let round = 1; understanding && round <= MAX_ROUNDS; round++) {
    ctx.trace('Checking the plan against your request');
    const unrun = deps.config.catalog.filter((q) => !ran.includes(q.key) && q.key !== 'areas');
    const out = await reviewer.review({
      category: deps.config.category,
      title,
      request: [text, extra].filter(Boolean).join('\n\n'),
      context: [
        ...(handoff.memory?.length
          ? ['Project notes:', ...handoff.memory.map((m) => `- ${m}`), '']
          : []),
        ...handoff.recent
          .slice(0, -1)
          .map((l) => `${l.from === 'person' ? 'Person' : 'Oraqul'}: ${l.text}`),
      ].join('\n'),
      understanding,
      draft: draftText(current.sections),
      findings: grounded.findings,
      gaps: grounded.gaps,
      unrun,
      codeSections,
      round,
    });
    ctx.tokens += out.tokens;
    if (!out.review) break;
    const verdict = judge(out.review, understanding, unrun, codeSections);
    next = verdict.next;
    if (verdict.passed) {
      rounds.push({ round, issues: verdict.issues, action: 'approved' });
      status = 'passed';
      break;
    }
    // The same blocking issue after a rewrite means writing again will not fix it.
    const keys = verdict.issues.filter((i) => i.blocking).map((i) => `${i.check}:${i.type}`);
    const repeated = keys.length > 0 && keys.every((k) => lastBlocking.has(k));
    lastBlocking = new Set(keys);
    if (round === MAX_ROUNDS || repeated) {
      rounds.push({ round, issues: verdict.issues, action: 'stopped' });
      status = 'flagged';
      break;
    }
    let action: 'rewrote' | 'researched' = 'rewrote';
    const wider = verdict.research.slice(0, MAX_EXTRA);
    if (wider.length && deps.tools.qloo.callsLeft >= MIN_CALLS_LEFT) {
      ({ grounded, understanding } = await runExtra(deps, ctx, {
        title,
        read,
        comps,
        queryPlan,
        grounded,
        understanding,
        extra: wider,
      }));
      ran = [...ran, ...wider.map((w) => w.query)];
      action = 'researched';
    }
    rounds.push({ round, issues: verdict.issues, action });
    feedback = feedbackLines(current.dropped, verdict.issues);
    ctx.trace(`Rewriting the plan, draft ${round + 1}`);
    current = await draft(feedback);
  }

  const { sections } = current;
  const plan: LaunchPlan = {
    scope: read.scope,
    sections,
    comps: comps.used,
    findings: grounded.findings,
    // Only the pages a kept line cites travel with the plan.
    sources: sources.filter((src) =>
      sections.some((sec) => sec.lines.some((l) => l.sourceIds.includes(src.id))),
    ),
    dropped: current.dropped,
    writer: current.by,
    understanding,
    review: understanding ? reviewOf(status, rounds, next) : null,
  };

  const bottom = sections.find((s) => s.key === 'bottom-line')?.lines ?? [];
  const moves: Move[] = bottom.map((l) => ({ text: l.text, lineId: l.findingIds[0] ?? null }));
  const headline =
    bottom[0]?.text ?? 'Qloo could not test enough of this plan to lead with anything yet.';
  const confidence = overall(bottom, grounded.findings);

  const reply = writeReply(input.intro, bottom, grounded.findings, deps.tools.source, plan.review);
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
        understanding,
      } satisfies LaunchInputs<R>,
    },
    input.earlier,
  );
}

/** The draft as plain text for the red team: a heading per section, a line each. */
function draftText(sections: LaunchSection[]): string {
  return sections
    .map((s) => `## ${s.title}\n${s.lines.map((l) => `- ${l.text}`).join('\n')}`)
    .join('\n\n');
}

/** No comp was found in Qloo, so there is nothing to describe the audience with. */
export function noCompsStop(
  deps: { emit(event: ThreadEvent): void; config: Pick<LaunchConfig, 'words'> },
  ctx: RunCtx,
  read: LaunchRead,
): void {
  const tried = [...read.comps, ...read.suggestedComps];
  deps.emit({
    type: 'message',
    body: tried.length
      ? `Qloo had nothing close to any of the comps (${tried.join(', ')}), so there is nothing to describe the audience with. Name a few ${deps.config.words.comps} your audience ${deps.config.words.compsVerb ?? 'watches'} and I will plan from them.`
      : `I could not find comps for this launch, so there is nothing to describe the audience with. Name a few ${deps.config.words.comps} your audience ${deps.config.words.compsVerb ?? 'watches'} and I will plan from them.`,
    claims: ctx.receipts
      .slice(0, 1)
      .map((r) => ({ text: 'Searched Qloo.', receiptIds: [r.callId] })),
  });
}

// The team's comps always, and they lead. Below 3, the model's proposals fill to 4, kept apart.
// A same-name match is settled by code from the country and popularity, and the choice is said.
export async function findComps(
  deps: {
    config: Pick<LaunchConfig, 'anchorTypes' | 'lead' | 'teamAnchors' | 'words'>;
    tools: ToolContext;
  },
  keep: (made: Receipt[]) => void,
  read: LaunchRead,
  known: Anchor[],
  knownUsed: CompUsed[],
  knownDropped: { name: string; why: string }[],
): Promise<{ resolved: Anchor[]; used: CompUsed[]; dropped: { name: string; why: string }[] }> {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const resolved = [...known];
  const used = knownUsed.filter((u) => resolved.some((a) => same(a.name, u.name)));
  const dropped = [...knownDropped];
  // Anchors the launch names besides its comps come last, so they never crowd out a named comp.
  const named = [
    ...read.comps,
    ...(deps.config.teamAnchors?.(read) ?? []).filter((n) => !read.comps.some((c) => same(c, n))),
  ];
  const yours = named.filter((c) => !resolved.some((a) => same(a.name, c))).slice(0, MAX_COMPS);
  const proposals =
    named.length >= MIN_COMPS
      ? []
      : read.suggestedComps.filter((c) => !named.some((y) => same(y, c)));
  const lead = deps.config.lead?.(read) ?? null;
  const leadName = lead && !resolved.some((a) => same(a.name, lead)) ? lead : null;
  const names = [...(leadName ? [leadName] : []), ...yours, ...proposals].slice(0, MAX_SEARCH);
  if (names.length === 0) return { resolved, used, dropped };

  const { data, receipts } = await tools.resolveBundle.run(deps.tools, {
    names,
    types: deps.config.anchorTypes,
  });
  keep(receipts);
  for (const a of resolveBundleOutputSchema.parse(data).anchors) {
    if (leadName && same(a.name, leadName)) {
      // The lead is an anchor and never a comp. A guess at who it is would describe the wrong
      // audience, so only an exact name, or a same-name pick settled by country, is used.
      if (a.status === 'found' && a.entityId) {
        resolved.push({ entityId: a.entityId, name: a.name, popularity: a.popularity });
      } else if (a.status === 'ambiguous' && a.candidates.length) {
        const pick = settle(a.candidates, read.country);
        resolved.push({ entityId: pick.entityId, name: pick.name, popularity: pick.popularity });
      } else {
        dropped.push({
          name: a.name,
          why: 'Qloo does not know this one by name, which is normal before a debut. The plan rests on the comps.',
        });
      }
      continue;
    }
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
        choice: `Qloo has ${a.candidates.length} ${deps.config.words.entity}s called “${a.name}”. I used the ${pick.detail ?? 'best known'} one, ${read.country && pick.detail?.includes(read.country) ? `from ${read.country} and ` : ''}the best known. Say which you mean if it is another.`,
      });
    } else if (a.status === 'not_found' && a.candidates.length) {
      // No exact name, so the nearest title Qloo has stands in, and the plan says so.
      const pick = closest(a.name, a.candidates);
      if (resolved.some((r) => r.entityId === pick.entityId)) continue;
      resolved.push({ entityId: pick.entityId, name: pick.name, popularity: pick.popularity });
      used.push({
        name: pick.name,
        source: mine ? 'you' : 'added',
        match: pick.detail,
        choice: `Qloo has no ${deps.config.words.entity} called “${a.name}”. I used the closest one it has, “${pick.name}”${pick.detail ? ` (${pick.detail})` : ''}. Say which you mean if it is another.`,
      });
    } else if (mine) {
      dropped.push({
        name: a.name,
        why:
          a.status === 'failed'
            ? 'The search failed, so it was left out.'
            : 'Qloo had nothing close to this name, so it was left out.',
      });
    }
  }
  used.sort((x, y) => (x.source === y.source ? 0 : x.source === 'you' ? -1 : 1));
  return { resolved, used, dropped };
}

const GENRE_COMPS = 4;
const releaseYear = z.looseObject({ release_year: z.number().optional() });

/**
 * No comp was found by name, so the brief's genre stands in. Qloo lists the films (then series)
 * of that genre tag, from the launch's country, and the best of them become the comps. They are
 * labelled as found from the genre so the plan never presents them as the team's choice.
 * `signal.interests.tags` with `filter.release_country` is verified live on movie and tv_show
 * (docs/backend/qloo.md).
 */
export async function findGenreComps(
  deps: {
    config: Pick<LaunchConfig, 'anchorTypes' | 'genreTagPrefix' | 'words'>;
    tools: ToolContext;
  },
  keep: (made: Receipt[]) => void,
  read: LaunchRead,
): Promise<Pick<Anchors, 'resolved' | 'used'>> {
  const none = { resolved: [], used: [] };
  if (!read.genre) return none;
  const words = read.genre.split(/[^\p{L}]+/u).filter((w) => w.length >= 4);
  const phrases = [...new Set([read.genre, ...words])].slice(0, 5);
  const found = await tools.resolveTags.run(deps.tools, {
    phrases: phrases.map((phrase) => ({
      phrase,
      prefix: deps.config.genreTagPrefix,
      parent: null,
    })),
  });
  keep(found.receipts);
  const tags = resolveTagsOutputSchema
    .parse(found.data)
    .tags.flatMap((t) => (t.tagId && t.name ? [{ id: t.tagId, name: t.name }] : []))
    .filter((t, i, all) => all.findIndex((x) => x.id === t.id) === i)
    .slice(0, 3);
  if (tags.length === 0) return none;

  const resolved: Anchor[] = [];
  const used: CompUsed[] = [];
  const named = tags.map((t) => t.name.toLowerCase());
  for (const type of deps.config.anchorTypes) {
    if (resolved.length >= GENRE_COMPS) break;
    let made: Awaited<ReturnType<typeof insights.entities>>;
    try {
      // Only films and series can be filtered by the country they were released in.
      made = await insights.entities(
        deps.tools.qloo,
        type === 'urn:entity:movie' || type === 'urn:entity:tv_show'
          ? {
              'filter.type': type,
              'signal.interests.tags': tags.map((t) => t.id),
              ...(read.country ? { 'filter.release_country': [read.country] } : {}),
              take: GENRE_COMPS,
            }
          : {
              'filter.type': type,
              'signal.interests.tags': tags.map((t) => t.id),
              take: GENRE_COMPS,
            },
      );
    } catch (err) {
      if (err instanceof QlooBudgetError || !(err instanceof QlooError)) throw err;
      continue;
    }
    const titles = made.data.results.entities.slice(0, GENRE_COMPS - resolved.length).map((e) => ({
      entityId: e.entity_id,
      name: e.name,
      popularity: e.popularity ?? null,
      year: releaseYear.safeParse(e.properties ?? {}).data?.release_year,
    }));
    if (titles.length === 0) continue;
    keep([
      toReceipt(made.call, {
        returned: { candidates: titles.map((t) => ({ name: t.name, popularity: t.popularity })) },
        rule: `The ${deps.config.words.entity}s Qloo lists for the genre tags ${list(named)}${read.country ? ` from ${read.country}` : ''}, in Qloo's order. Used in place of comps because none of the named ones was found. Confidence lower.`,
        confidence: 'lower',
        source: deps.tools.source,
      }),
    ]);
    for (const t of titles) {
      resolved.push({ entityId: t.entityId, name: t.name, popularity: t.popularity });
      used.push({
        name: t.name,
        source: 'added',
        match: t.year ? String(t.year) : null,
        choice: `Qloo had none of the comps by name, so I used “${t.name}”, which it lists for ${list(named)}${read.country ? ` from ${read.country}` : ''}. Name comps to sharpen the read.`,
      });
    }
  }
  return { resolved, used };
}

// With no exact name: a title that contains the name or sits inside it ("Anikulapo: Rise of the
// Spectre" for "Anikulapo"), else Qloo's own best match, which search lists first.
function closest<T extends { name: string }>(name: string, candidates: T[]): T {
  const want = normalizeTitle(name);
  const near = candidates.find((c) => {
    const got = normalizeTitle(c.name);
    return got.includes(want) || want.includes(got);
  });
  return near ?? (candidates[0] as T);
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
export function applyChange<R extends LaunchRead>(
  inputs: LaunchInputs<R>,
  change: Change,
  title: string,
  /** A category's own part of a what-if, such as the collabs a Games plan adds. */
  extend?: (read: R, change: Change) => R,
): {
  title: string;
  read: R;
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
    change.addCollabs.length ? `collab with ${change.addCollabs.join(', ')}` : '',
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
    read: (extend ?? ((r: R) => r))(
      {
        ...inputs.read,
        places,
        comps,
        ages: change.ages.length ? change.ages : inputs.read.ages,
        gender: change.gender ?? inputs.read.gender,
        // A what-if keeps the comps it was given; it does not propose more.
        suggestedComps: [],
      },
      change,
    ),
    resolved: inputs.resolved.filter((a) => kept(a.name)),
    used: used.filter((u) => kept(u.name)),
    dropped: inputs.dropped.filter((d) => comps.some((k) => same(k, d.name))),
  };
}

export function homeMarket(cities: string[], country: string | null): string | null {
  return country ? (cities.find((c) => cityCountry(c) === country) ?? null) : null;
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

export function budgetStop(deps: { emit(event: ThreadEvent): void }, ctx: RunCtx): PlanRun {
  deps.emit({
    type: 'message',
    body: 'I stopped because the Qloo call budget for this run is spent. Nothing past this point was tested, so no plan was saved.',
    claims: [],
  });
  return ctx.stop('budget');
}

/**
 * The first message, its files, and this run's message when it is a different one. A build also
 * reads what the person typed earlier in the chat (`chat`): an answer to a question lived only in
 * the run that asked it, so a retry would otherwise start from the first message alone.
 */
export function briefText(
  { inputs, message, recent }: Handoff,
  /** Most characters of each file to read: a brief is cut short, a plan to audit is not. */
  chars = ATTACHMENT_CHARS,
  chat = false,
): string {
  const part = (said: Handoff['inputs']) => {
    const { text, files } = cutFiles(said, chars);
    return [text, ...files.flatMap((f) => (f.text ? [`[File: ${f.name}]\n${f.text}`] : []))]
      .filter(Boolean)
      .join('\n\n');
  };
  const first = part(inputs);
  const now = part(message);
  const earlier = chat
    ? recent
        .filter((l) => l.from === 'person')
        .map((l) => l.text.trim())
        .filter((t, i, all) => t && t !== first && t !== now && all.indexOf(t) === i)
    : [];
  return [first, ...earlier, now && now !== first ? now : ''].filter(Boolean).join('\n\n');
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
  review: PlanReview | null,
): { message: string; claims: Claim[] } {
  const claims: Claim[] = bottom.flatMap((l) => {
    const ids = l.findingIds.flatMap((id) => findings.find((f) => f.id === id)?.callIds ?? []);
    return ids.length ? [{ text: l.text, receiptIds: [...new Set(ids)] }] : [];
  });
  // The plan follows in full below this line, so the message only introduces it.
  const message = [
    intro,
    review?.status === 'flagged'
      ? 'Some points are still open, and they are listed on the plan.'
      : '',
    review?.next.length ? `To make it stronger: ${list(review.next)}.` : '',
    source === 'demo' ? 'This run used demo data, not live Qloo.' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { message, claims };
}
