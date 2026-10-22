import { QlooBudgetError } from '@oraqul/engine';
import {
  type AuditReport,
  type Claim,
  type Confidence,
  type DroppedLine,
  type Finding,
  type LaunchLine,
  type LaunchResults,
  launchResultsSchema,
  type Move,
  type OverallConfidence,
  type Question,
  type ReportItem,
  type ResultsComparison,
} from '@oraqul/schema';
import { z } from 'zod';
import { type Handoff, type NewOutput, PLAN_CHARS, type Reply } from '../category-agents.js';
import { ungroundedClaims } from '../grounding.js';
import { type DraftItem, testPlan } from './audit-verdicts.js';
import { capital, slug } from './brief.js';
import { type CheckContext, checkSections } from './check.js';
import type { LaunchDeps } from './config.js';
import {
  type Anchors,
  type Asked,
  askQloo,
  briefText,
  budgetStop,
  findComps,
  type LaunchInputs,
  launchInputsSchema,
  noCompsStop,
  type PlanRun,
  type RunCtx,
  replyText,
  runCtx,
} from './pipeline.js';
import type { QueryPlanCore } from './planner.js';
import type { LaunchRead } from './read-core.js';
import type { ReportWriter } from './report-writer.js';
import { compareResults } from './results.js';
import { checkResults, type ResultsReader } from './results-read.js';
import type { AuditState, FixState } from './state.js';
import { list } from './text.js';

export interface AuditDeps<
  R extends LaunchRead = LaunchRead,
  P extends QueryPlanCore = QueryPlanCore,
> extends LaunchDeps<R, P> {
  results: ResultsReader;
  report: ReportWriter<R>;
}

/** What an audit was made from, so a fix on it starts from the same reading and comps. */
export const launchAuditInputsSchema = <S extends z.ZodType>(read: S) =>
  launchInputsSchema(read).extend({
    phase: z.enum(['pre', 'post']),
    results: launchResultsSchema.nullable(),
  });
export type LaunchAuditInputs<R extends LaunchRead = LaunchRead> = LaunchInputs<R> & {
  phase: 'pre' | 'post';
  results: LaunchResults | null;
};

/** Steps of an audit, not counting the web step that exists only when search is configured. */
export const AUDIT_STEPS = 7;

const PLAN_QUESTION =
  'I need your plan to check it. Paste it here or attach the file, with the cities, the audience and the partners it relies on.';
const MAX_MOVES = 3;
const rank: Record<Confidence, number> = { lower: 0, medium: 1, high: 2 };

export type Review<R extends LaunchRead = LaunchRead> = {
  /** The plan as the person wrote it, with the answers they gave to my questions. */
  text: string;
  extra: string;
  read: R;
  launched: boolean;
  results: LaunchResults | null;
};

type ReviewState = AuditState | FixState;
type Mode = 'audit' | 'fix';

/**
 * Reads the plan, and asks for what an audit cannot go on without: the plan itself, whether the
 * launch is out (a fix only), and the results when it is. Each question is asked once.
 */
export async function reviewPlan<R extends LaunchRead, P extends QueryPlanCore>(
  handoff: Handoff,
  deps: AuditDeps<R, P>,
  ctx: RunCtx,
  mode: Mode,
  resume?: { state: ReviewState; reply: Reply },
  /** An Oraqul plan, as text, to audit in place of the message and its files. */
  planText?: string,
): Promise<{ stop: PlanRun } | Review<R>> {
  const prior = resume?.state;
  const extra = resume
    ? `${resume.state.extra}\n\n${replyText(resume.state, resume.reply)}`.trim()
    : '';
  ctx.trace('Reading your plan');
  const text = [planText ?? briefText(handoff, PLAN_CHARS), extra].filter(Boolean).join('\n\n');
  const input = { title: handoff.title, text };
  const parsed = await deps.read(input);
  ctx.tokens += parsed.tokens;
  const checked = parsed.read;
  // The plan's order is the order it names its cities in, which a gap in the results is read against.
  const read = { ...checked, places: inOrderOfMention(checked.places, text) };
  const found = await deps.results.read({ text });
  ctx.tokens += found.tokens;
  const said = checkResults(found.reading, text);

  const stop = (question: Question, fields: Partial<FixState> = {}): { stop: PlanRun } => {
    deps.emit({ type: 'question', agent: deps.config.category, ...question });
    const state: ReviewState = {
      job: mode,
      extra,
      askedResults: prior?.askedResults ?? false,
      ...(mode === 'fix'
        ? { askedPhase: (prior as FixState | undefined)?.askedPhase ?? false }
        : {}),
      ...fields,
      pending: question,
    } as ReviewState;
    return { stop: ctx.stop('waiting', state) };
  };

  if (deps.config.claims(read) === 0 && !resume) {
    return stop({
      id: `${mode}.plan`,
      card: 'text',
      prompt: PLAN_QUESTION,
      options: [],
      hint: deps.config.words.planExample,
    });
  }

  if (mode === 'fix' && !said.launched && !said.results && !(prior as FixState)?.askedPhase) {
    return stop(
      {
        id: 'fix.phase',
        card: 'single',
        prompt: 'Is this launch already out?',
        options: [
          { id: 'pre', label: 'Not out yet', description: 'Check the plan, then fix it.' },
          { id: 'post', label: 'It is out', description: 'I will add how it did.' },
        ],
        hint: 'Or type it in the message box.',
      },
      { askedPhase: true } as Partial<FixState>,
    );
  }
  if (said.launched && !said.results && !prior?.askedResults) {
    return stop(
      {
        id: `${mode}.results`,
        card: 'text',
        prompt:
          'This launch is already out. Add how it did by city and I will compare it with the plan. Totals only, with no personal data.',
        options: [],
        hint: 'For example: “Lagos: 4,200, London: 1,100, Houston: 300” and “18 to 24: 40, 25 to 34: 35”. Or type “skip”.',
      },
      { askedResults: true },
    );
  }
  return { text, extra, read, launched: said.launched, results: said.results };
}

function inOrderOfMention(places: string[], text: string): string[] {
  const lower = text.toLowerCase();
  const at = (place: string) => {
    const i = lower.indexOf(place.toLowerCase());
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };
  return [...places].sort((a, b) => at(a) - at(b));
}

/** Puts the partners a plan names among the brands Qloo ranks, so each can be placed. */
function withPartners<R extends LaunchRead, P extends QueryPlanCore>(
  read: R,
  maxCities: number,
): (plan: P) => P {
  return (plan) => {
    if (read.partners.length === 0) return plan;
    const known = new Map(plan.brandCandidates.map((c) => [c.city, c.names]));
    const cities = plan.cities.slice(0, maxCities);
    return {
      ...plan,
      brandCandidates: cities.map((city) => ({
        city,
        names: [...new Set([...read.partners, ...(known.get(city) ?? [])])].slice(0, 4),
      })),
    };
  };
}

export interface Audited<
  R extends LaunchRead = LaunchRead,
  P extends QueryPlanCore = QueryPlanCore,
> {
  output: NewOutput;
  report: AuditReport;
  read: R;
  comps: Anchors;
  asked: Asked<P>;
  review: Review<R>;
  /** The calls the audit made, which its own Evidence tab shows. */
  callIds: string[];
}

/** The audit, from a read plan to a saved-ready report. Shared by an audit and a fix. */
export async function auditStages<R extends LaunchRead, P extends QueryPlanCore>(
  handoff: Handoff,
  deps: AuditDeps<R, P>,
  ctx: RunCtx,
  review: Review<R>,
  known?: { comps: Anchors },
): Promise<{ stop: PlanRun } | Audited<R, P>> {
  const { read, results } = review;
  const title = handoff.title;

  let comps: Anchors;
  if (known) {
    comps = known.comps;
    for (const a of comps.resolved) deps.tools.entities.set(a.entityId, a);
  } else {
    ctx.trace('Finding the comps in Qloo');
    try {
      comps = await findComps(deps, ctx.keep, read, [], [], []);
    } catch (err) {
      if (err instanceof QlooBudgetError) return { stop: budgetStop(deps, ctx) };
      throw err;
    }
    if (comps.resolved.length === 0) {
      noCompsStop(deps, ctx, read);
      return { stop: ctx.stop('finished') };
    }
    for (const a of comps.resolved) deps.tools.entities.set(a.entityId, a);
  }

  // An audit tests the whole plan, so it asks about everything the plan could rest on.
  const whole = { ...read, scope: 'full' as const, ask: null };
  const asked = await askQloo(deps, ctx, {
    title,
    read: whole,
    comps,
    adjust: withPartners<R, P>(read, 2),
  });
  const { grounded, sources } = asked;

  ctx.trace('Testing each assumption in the plan');
  const drafts = testPlan({
    read,
    text: review.text,
    grounded,
    beliefs: deps.config.beliefs,
  });
  const comparison: ResultsComparison | null = results
    ? compareResults({
        planned: read.places,
        results,
        findings: grounded.findings,
        ages: grounded.brief.ages,
      })
    : null;

  const checkCtx: CheckContext = {
    findings: grounded.findings,
    sources,
    briefNames: [
      title,
      ...comps.used.map((c) => c.name),
      ...deps.config.briefNames.build(read),
      ...(comparison?.rows.map((r) => r.place) ?? []),
    ],
    briefText: review.text,
    teamCities: read.places,
    teamAges: read.ages,
    allowed: ['risks', 'markets', 'gaps'],
    rules: deps.config.rules,
  };
  const dropped: DroppedLine[] = [];
  const items: ReportItem[] = drafts.map((d) => withCheckedFix(d, checkCtx, dropped));

  ctx.trace('Writing the risks and alternatives');
  const written = await deps.report.write({
    title,
    request: review.text,
    read,
    comps: comps.used,
    items,
    findings: grounded.findings,
    sources,
    results: comparison,
  });
  ctx.tokens += written.tokens;

  ctx.trace('Checking every line');
  const risks = keptLines(
    checkSections([{ key: 'risks', lines: written.risks }], checkCtx),
    'risks',
    'risk',
    dropped,
  );
  const alternatives = keptLines(
    checkSections([{ key: 'markets', lines: written.alternatives }], checkCtx),
    'markets',
    'alt',
    dropped,
  );

  const report: AuditReport = {
    phase: review.launched ? 'post' : 'pre',
    items,
    risks,
    alternatives,
    results: comparison,
    comps: comps.used,
    findings: grounded.findings,
    sources: sources.filter((src) =>
      [...risks, ...alternatives, ...items.flatMap((i) => (i.fix ? [i.fix] : []))].some((l) =>
        l.sourceIds.includes(src.id),
      ),
    ),
    dropped,
    writer: written.by,
  };

  const moves = movesOf(items);
  const headline = headlineOf(items, comparison);
  const confidence = overallOf(items, grounded.findings);
  const reply = replyFor(title, headline, moves, grounded.findings, deps.tools.source);
  if (ungroundedClaims(reply, ctx.receipts).length) {
    deps.emit({
      type: 'error',
      message: 'The report cited a call this run did not make, so it was not saved.',
    });
    return { stop: ctx.stop('error') };
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

  const assumptionSource = new Map(items.map((i) => [i.id, i.source]));
  const output: NewOutput = {
    kind: 'audit',
    title,
    brief: {
      ...grounded.brief.brief,
      assumptions: grounded.brief.brief.assumptions.map((a) => {
        const source = assumptionSource.get(a.id);
        return source ? { ...a, source } : a;
      }),
      cannot: [
        ...grounded.brief.brief.cannot,
        ...grounded.gaps.map((g, i) => ({ id: `cant-q-${i + 1}`, item: g.item, reason: g.why })),
      ],
    },
    plan: null,
    report,
    headline,
    moves,
    confidence,
    inputs: {
      read,
      comps: comps.used.filter((c) => c.source === 'you').map((c) => c.name),
      resolved: comps.resolved,
      dropped: comps.dropped,
      used: comps.used,
      phase: report.phase,
      results,
    } satisfies LaunchAuditInputs<R>,
  };
  return {
    output,
    report,
    read,
    comps,
    asked,
    review,
    callIds: ctx.receipts.map((r) => r.callId),
  };
}

/** The audit (spec §6.3): the plan's assumptions tested, as a report and not a plan. */
export async function runAudit<R extends LaunchRead, P extends QueryPlanCore>(
  handoff: Handoff,
  deps: AuditDeps<R, P>,
  resume?: { state: AuditState; reply: Reply },
  opts: { planText?: string } = {},
): Promise<PlanRun> {
  const ctx = runCtx(deps, AUDIT_STEPS + (deps.research.enabled ? 1 : 0));
  const review = await reviewPlan(handoff, deps, ctx, 'audit', resume, opts.planText);
  if ('stop' in review) return review.stop;
  const audited = await auditStages(handoff, deps, ctx, review);
  if ('stop' in audited) return audited.stop;
  return ctx.stop('finished', null, audited.output);
}

// A fix line is checked like any plan line. One that fails is logged and the item has no fix.
function withCheckedFix(draft: DraftItem, ctx: CheckContext, dropped: DroppedLine[]): ReportItem {
  const { fix: written, ...item } = draft;
  if (!written) return { ...item, fix: null };
  const checked = checkSections([{ key: 'gaps', lines: [written] }], ctx);
  dropped.push(...checked.dropped);
  const kept = checked.sections[0]?.lines[0];
  return { ...item, fix: kept ? { ...kept, id: `fix-${item.id}` } : null };
}

function keptLines(
  checked: ReturnType<typeof checkSections>,
  key: 'risks' | 'markets',
  prefix: string,
  dropped: DroppedLine[],
): LaunchLine[] {
  dropped.push(...checked.dropped);
  const lines = checked.sections.find((s) => s.key === key)?.lines ?? [];
  return lines.map((l, i) => ({ ...l, id: `${prefix}-${i + 1}` }));
}

/** Up to three moves: the fixes for what breaks, then for what is weak. */
function movesOf(items: ReportItem[]): Move[] {
  const order = (v: ReportItem['verdict']) => (v === 'breaks' ? 0 : 1);
  return items
    .filter((i) => i.fix && (i.verdict === 'breaks' || i.verdict === 'weak'))
    .sort((a, b) => order(a.verdict) - order(b.verdict))
    .slice(0, MAX_MOVES)
    .map((i) => ({ text: i.fix?.text ?? '', lineId: i.fix?.findingIds[0] ?? null }));
}

const ORDINALS: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth' };
const nth = (n: number) => ORDINALS[n] ?? `${n}th`;

/** The bottom line, written by code from the verdicts and the results. */
export function headlineOf(items: ReportItem[], results: ResultsComparison | null): string {
  const count = (v: ReportItem['verdict']) => items.filter((i) => i.verdict === v).length;
  const holds = count('holds');
  const weak = count('weak');
  const breaks = count('breaks');
  const cant = count('cant');
  const parts = [
    weak ? `${weak} ${weak === 1 ? 'is' : 'are'} weak` : '',
    breaks ? `${breaks} ${breaks === 1 ? 'breaks' : 'break'}` : '',
    cant ? `${cant} could not be tested` : '',
  ].filter(Boolean);
  const tally = `${holds} of ${items.length} assumptions in your plan hold${parts.length ? `, ${list(parts)}` : ''}.`;
  const worst = results?.brokeItemId
    ? results.rows.find((r) => `a-place-${slug(r.place)}` === results.brokeItemId)
    : null;
  if (worst?.plannedRank) {
    return `The launch fell short where the plan leaned on ${worst.place}: it finished ${nth(worst.actualRank)}, and the plan put it ${nth(worst.plannedRank)}. ${tally}`;
  }
  return items.length === 0 ? 'Nothing in this plan could be tested against Qloo.' : tally;
}

// Spec §5.1: the lowest confidence of the beliefs that were tested.
function overallOf(items: ReportItem[], findings: Finding[]): OverallConfidence {
  const tested = items.filter((i) => i.verdict !== 'cant');
  const lowest = [...tested].sort((a, b) => rank[a.confidence] - rank[b.confidence])[0];
  if (!lowest) return { level: 'low', why: 'Nothing in the plan could be tested against Qloo.' };
  const why = findings.find((f) => f.id === lowest.findingIds[0])?.why;
  return {
    level: lowest.confidence === 'lower' ? 'low' : lowest.confidence,
    why: why ? `${capital(why)}.` : 'Set by the weakest test behind the report.',
  };
}

function replyFor(
  title: string,
  headline: string,
  moves: Move[],
  findings: Finding[],
  source: 'qloo' | 'demo',
): { message: string; claims: Claim[] } {
  const claims: Claim[] = moves.flatMap((m) => {
    const ids = findings.find((f) => f.id === m.lineId)?.callIds ?? [];
    return ids.length ? [{ text: m.text, receiptIds: [...new Set(ids)] }] : [];
  });
  // The report follows in full below this line, so the message only introduces it.
  const message = [
    `Here is the audit of your plan for “${title}”.`,
    headline,
    source === 'demo' ? 'This run used demo data, not live Qloo.' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { message, claims };
}
