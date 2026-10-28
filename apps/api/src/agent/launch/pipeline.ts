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
import { BAND_LABEL, CALENDAR_RULES, PARTNER_RULES, rules, SHARED_RULES } from '@oraqul/packs';
import {
  type Category,
  type Claim,
  type CompUsed,
  type Confidence,
  type DroppedLine,
  type Finding,
  type LaunchLine,
  type LaunchModuleKey,
  type LaunchPlan,
  type LaunchSection,
  type LaunchSectionKey,
  type Move,
  type OverallConfidence,
  type PartnerCheck,
  type PlanBand,
  type PlanProcess,
  type PlanReview,
  type PlanSource,
  planBandSchema,
  type Question,
  type Receipt,
  type StopReason,
  type Territory,
  type ThreadEvent,
  type Understanding,
  understandingSchema,
} from '@oraqul/schema';
import { z } from 'zod';
import {
  conflictsOf,
  guidanceText,
  NO_RULES,
  withoutBlockedChannels,
} from '../../team-rules/compile.js';
import {
  ATTACHMENT_CHARS,
  cutFiles,
  type Handoff,
  type NewOutput,
  type Reply,
} from '../category-agents.js';
import { ungroundedClaims } from '../grounding.js';
import { applyAnalysis, ScriptedAnalyst } from './analyse.js';
import {
  bandFromAnswer,
  bandFromBrief,
  bandOfBudget,
  bandQuestion,
  bandQuestionId,
  withLauncher,
} from './band.js';
import { verifyBrands, verifyVenues } from './brand-verify.js';
import { capital, slug } from './brief.js';
import { calendarRows, calendarSection } from './calendar.js';
import { type CheckContext, checkSections } from './check.js';
import { type Clash, clashFinding, type Rival, rivalsFrom, scoreClash } from './clash.js';
import type { LaunchConfig, LaunchDeps } from './config.js';
import { type ConsultOffer, runConsult } from './consult.js';
import { ensureDecisions } from './decisions.js';
import { dateCalls, showDateCalls, territoryCalls } from './direction.js';
import { evidenceBlock } from './evidence.js';
import type { Grounded } from './findings.js';
import type { Change } from './follow-up.js';
import { gapsAsUntested } from './gaps.js';
import { withSharedModules } from './modules.js';
import { opportunitiesOf, withOpportunities } from './opportunities.js';
import {
  brandsFrom,
  checkedPartner,
  flagshipNames,
  marketsOf,
  partnerNotes,
  partnerOptions,
  toneOf,
  withPartnerIds,
  withReach,
  withTeamBrands,
} from './partners.js';
import type { QueryPlanCore } from './planner.js';
import {
  marketOf,
  platformLine,
  platformQuestionId,
  platformsChosen,
  platformsFromAnswer,
} from './platforms.js';
import type { LaunchRead } from './read-core.js';
import {
  applyAssessment,
  applyRound2,
  MAX_EXTRA,
  MAX_RESEARCH_ROUNDS,
  MIN_CALLS_LEFT,
  openChecks,
  ScriptedResearchPlanner,
} from './research-loop.js';
import { feedbackLines, judge, MAX_ROUNDS, reviewOf, ScriptedReviewer } from './review.js';
import {
  effectiveRules,
  enforceRead,
  rulesQuestion,
  rulesQuestionId,
  withoutBlockedPartners,
} from './rules-gate.js';
import { codeLine, measureSection, signalOf } from './signal.js';
import type { BuildState, LaunchState } from './state.js';
import { dropUnsupported, supportLines } from './support.js';
import { channelsSection, territoriesOf, withLines } from './territories.js';
import { blocked, list, releaseDate } from './text.js';
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
  source: z.enum(['you', 'added', 'genre']),
  why: z.string().nullable().optional(),
  match: z.string().nullable(),
  choice: z.string().nullable(),
  anchor: z.boolean().optional(),
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
    // What a what-if keeps (D3, D6, D10). Without these in the schema a saved plan's inputs lose
    // them on the way back in. Plans saved before they were kept have none.
    rivals: z.array(z.object({ title: z.string(), date: z.string() })).optional(),
    brands: z.array(z.string()).optional(),
    band: planBandSchema.nullable().optional(),
    platforms: z.array(z.string()).nullable().optional(),
  });
export interface LaunchInputs<R extends LaunchRead = LaunchRead> {
  read: R;
  comps: string[];
  resolved: Anchor[];
  dropped: { name: string; why: string }[];
  used: CompUsed[];
  understanding?: Understanding | null;
  /** Rival releases the team named with their opening days, kept so a what-if keeps the check. */
  rivals?: Rival[];
  /** Brands the team named to consider, kept so a what-if asks about them again. */
  brands?: string[];
  /** The budget band the plan was sized for, so a what-if keeps it. */
  band?: PlanBand | null;
  /** The platforms the campaign was planned on, so a what-if keeps them. Null when not chosen. */
  platforms?: string[] | null;
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
  /** What each research round was missing and did, for the plan's record. */
  rounds: ResearchRound[];
  /** Consults any round has asked, so a later round only offers the rest. */
  consulted: string[];
  /** How the rivals the team named overlap with the comps' audience. Null when none were named. */
  clash: Clash | null;
  /** The rivals the team named, kept on the plan inputs. */
  rivals: Rival[];
  /** The brands the team named to consider, kept on the plan inputs. */
  brands: string[];
  /** What Wikidata said about each brand Qloo ranked. Empty when nothing was checked. */
  brandChecks: Record<string, PartnerCheck>;
}

/** What one research round did, as saved on the plan. */
type ResearchRound = PlanProcess['research'][number];

/**
 * A later round of research: the catalog queries asked for, empty queries asked another way, and
 * questions put to another side, all run on the brief the first round built and merged into its
 * findings. Each check a pick was for is marked from what that pick found.
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
    retry?: { miss: string; alt: string; check: string; why: string }[];
    consult?: { offer: string; check: string; why: string }[];
    offers?: ConsultOffer[];
  },
): Promise<{
  grounded: Grounded;
  understanding: Understanding;
  round: Omit<ResearchRound, 'round' | 'open'>;
}> {
  const { grounded } = input;
  const round: Omit<ResearchRound, 'round' | 'open'> = { asked: [], retried: [], consulted: [] };
  let merged: Grounded = grounded;
  const credited: { query: string; check: string }[] = [];
  let made: Finding[] = [];

  if (input.extra.length) {
    const labels = input.extra.map(
      (e) => deps.config.catalog.find((q) => q.key === e.query)?.label ?? e.query,
    );
    ctx.trace(`Looking wider: ${list(labels)}`);
    const more = await deps.config.ground(
      { tools: deps.tools, emit: deps.emit, keep: ctx.keep },
      {
        read: input.read,
        anchors: input.comps.resolved,
        dropped: input.comps.dropped,
        plan: { ...input.queryPlan, queries: input.extra.map((e) => e.query) },
        year: new Date().getFullYear(),
        cap: compCap(input.comps.used),
        more: { brief: grounded.brief },
      },
    );
    const owns = new Set(more.misses.map((m) => m.id));
    merged = {
      ...grounded,
      findings: [...grounded.findings, ...more.findings],
      receipts: [...grounded.receipts, ...more.receipts],
      gaps: [...grounded.gaps, ...more.gaps],
      budgetOut: grounded.budgetOut || more.budgetOut,
      misses: [...grounded.misses, ...more.misses],
      retry: (id, alt) => (owns.has(id) ? more.retry(id, alt) : grounded.retry(id, alt)),
    };
    made = more.findings;
    credited.push(...input.extra.map((e) => ({ query: e.query, check: e.check })));
    round.asked = input.extra.map((e, i) => ({
      label: labels[i] ?? e.query,
      why: e.why,
      found: more.findings.some((f) => f.query === e.query),
    }));
  }

  for (const pick of input.retry ?? []) {
    const miss = merged.misses.find((m) => m.id === pick.miss);
    const alt = miss?.alternatives.find((a) => a.key === pick.alt);
    if (!miss || !alt) continue;
    ctx.trace(`Qloo had nothing for ${miss.label}, so asking again ${alt.says}`);
    const again = await merged.retry(miss.id, alt.key);
    const found = again.findings.length > 0;
    round.retried.push({ label: miss.label, says: alt.says, found });
    if (!found) continue;
    made = [...made, ...again.findings];
    credited.push({ query: miss.key, check: pick.check });
    merged = {
      ...merged,
      findings: [...merged.findings, ...again.findings],
      receipts: [...merged.receipts, ...again.receipts],
      gaps: merged.gaps.filter((g) => g.item !== miss.label),
      misses: merged.misses.filter((m) => m.id !== miss.id),
    };
  }

  for (const pick of input.consult ?? []) {
    const offer = input.offers?.find((o) => o.id === pick.offer);
    if (!offer) continue;
    ctx.trace(`Asking the ${offer.category} side about ${offer.name}`);
    const asked = await runConsult(deps.tools, merged.brief, offer, (finding) =>
      deps.emit({ type: 'finding', finding }),
    );
    ctx.keep(asked.receipts);
    round.consulted.push({ category: offer.category, name: offer.name, found: asked.found });
    if (!asked.found) continue;
    made = [...made, ...asked.findings];
    credited.push({ query: 'consult', check: pick.check });
    merged = {
      ...merged,
      findings: [...merged.findings, ...asked.findings],
      receipts: [...merged.receipts, ...asked.receipts.filter((r) => r.lineId)],
    };
  }

  return {
    grounded: merged,
    understanding: applyRound2(input.understanding, made, credited, merged.findings),
    round,
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
    /** Rival releases with the day the team says they open (spec §5). */
    rivals?: Rival[];
    /** The budget band, which decides which seeded partners are asked about. */
    band?: PlanBand | null;
    /** Brands the team named to consider, asked beside the model's own candidates. */
    brands?: string[];
    /** A specific thing to look up on the web as well, with the work's title already removed. */
    question?: string;
  },
): Promise<Asked<P>> {
  const { title, read, comps } = input;
  ctx.trace('Choosing what to ask Qloo');
  const { modules } = withSharedModules(deps.config.pickModules(read), read);
  const compsCountry = commonCountry(comps.used);
  const { plan: planned, tokens } = await deps.queries.plan({
    title,
    read,
    modules,
    compsCountry,
  });
  ctx.tokens += tokens;
  const adjusted = input.adjust ? input.adjust(planned) : planned;
  const queryPlan = withTeamBrands(
    input.band
      ? withReach(adjusted, input.band.band, read.places, input.band.launcher ?? null)
      : adjusted,
    input.brands ?? [],
  );

  ctx.trace('Asking Qloo about your audience');
  const groundDeps = { tools: deps.tools, emit: deps.emit, keep: ctx.keep };
  const groundInput = {
    read,
    anchors: comps.resolved,
    dropped: comps.dropped,
    plan: queryPlan,
    year: new Date().getFullYear(),
    cap: compCap(comps.used),
  };
  let grounded = await deps.config.ground(groundDeps, groundInput);
  // A brand that has closed is taken out here, before anything is written about it.
  const verified = await verifyBrands(deps.verifier, grounded, [
    ...(input.brands ?? []),
    ...read.partners,
  ]);
  grounded = (await verifyVenues(deps.verifier, verified.grounded)).grounded;
  const brandChecks = verified.checks;

  let understanding = input.understanding ?? null;
  const extraKeys: string[] = [];
  const consulted: string[] = [];
  const rounds: ResearchRound[] = [];
  const offers = deps.config.consults?.(read) ?? [];
  // The research check and what it sends out take turns until every check that needs evidence is
  // covered, nothing is left to try, or the budget is low. Each turn is in the trace.
  for (let round = 1; understanding && round <= MAX_RESEARCH_ROUNDS; round++) {
    const open = openChecks(understanding);
    if (round > 1 && open.length === 0) break;
    ctx.trace(
      round === 1
        ? 'Checking what the research covers'
        : `Research check, round ${round}: ${open.length} ${open.length === 1 ? 'question is' : 'questions are'} still open`,
    );
    const ran = new Set([...queryPlan.queries, ...extraKeys]);
    const unrun = deps.config.catalog.filter((q) => !ran.has(q.key) && q.key !== 'areas');
    const consults = offers.filter((o) => !consulted.includes(o.id));
    if (unrun.length === 0 && grounded.misses.length === 0 && consults.length === 0) break;
    const callsLeft = deps.tools.qloo.callsLeft;
    const judged = await (deps.researchPlanner ?? new ScriptedResearchPlanner()).assess({
      category: deps.config.category,
      title,
      understanding,
      findings: grounded.findings,
      gaps: grounded.gaps,
      unrun,
      misses: grounded.misses,
      consults,
      callsLeft,
    });
    ctx.tokens += judged.tokens;
    const applied = applyAssessment(
      understanding,
      grounded.findings,
      judged.assessment,
      unrun,
      callsLeft,
      { misses: grounded.misses, consults },
    );
    understanding = applied.understanding;
    if (applied.extra.length + applied.retry.length + applied.consult.length === 0) break;
    extraKeys.push(...applied.extra.map((e) => e.query));
    consulted.push(...applied.consult.map((c) => c.offer));
    const done = await runExtra(deps, ctx, {
      title,
      read,
      comps,
      queryPlan,
      grounded,
      understanding,
      extra: applied.extra,
      retry: applied.retry,
      consult: applied.consult,
      offers,
    });
    ({ grounded, understanding } = done);
    rounds.push({ round, open: open.map((c) => c.text), ...done.round });
  }

  // Rival dates are the team's own. Each rival is scored against the comps in one call, so the
  // overlaps compare, and the result is a finding a plan line can cite.
  let clash: Clash | null = null;
  const rivals = input.rivals ?? [];
  if (rivals.length > 0 && deps.tools.qloo.callsLeft > MIN_CALLS_LEFT) {
    ctx.trace('Checking the rival release dates');
    try {
      clash = await scoreClash(
        deps.tools,
        comps.resolved.map((a) => a.entityId),
        rivals,
        deps.config.rivalTypes,
      );
      ctx.keep(clash.receipts);
      const finding = clashFinding(clash);
      if (finding) {
        grounded = { ...grounded, findings: [...grounded.findings, finding] };
        deps.emit({ type: 'finding', finding });
      }
      // A rival Qloo could not find or score is said, not left out of the date check in silence.
      if (clash.missing.length > 0) {
        grounded = {
          ...grounded,
          gaps: [
            ...grounded.gaps,
            ...clash.missing.map((title) => ({
              item: `Rival date: ${title}`,
              why: 'Qloo did not find it by name, so its overlap with your audience was not scored and its date was not checked.',
            })),
          ],
        };
      }
    } catch (err) {
      // The check is optional: a failed or over-budget call leaves the plan without it.
      if (!(err instanceof QlooError || err instanceof QlooBudgetError)) throw err;
    }
  }

  let sources: PlanSource[] = [];
  if (deps.research.enabled) {
    ctx.trace('Checking release timing and the market');
    const today = new Date().toISOString().slice(0, 10);
    const found = await deps.research.research({
      read,
      country: queryPlan.country,
      cities: queryPlan.cities,
      today,
      ...(input.question ? { question: input.question } : {}),
    });
    // The day each fact was read, so a later check can say how old it is.
    sources = found.sources.map((s) => ({ ...s, retrievedAt: today }));
    ctx.tokens += found.tokens;
  }
  const ran = [...new Set([...queryPlan.queries, ...extraKeys])];
  return {
    modules,
    queryPlan,
    grounded,
    ran,
    sources,
    understanding,
    rounds,
    consulted,
    clash,
    rivals,
    brands: input.brands ?? [],
    brandChecks,
  };
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
  let band: PlanBand | null = null;
  let platforms: string[] | null = null;
  let rivals: Rival[] = [];
  let brands: string[] = [];
  let rulesOverride = false;

  if (from) {
    ctx.trace('Applying your what-if to the plan');
    const changed = applyChange(from.inputs, from.change, handoff.title, deps.config.applyChange);
    ({ read, title } = changed);
    kind = 'scenario';
    known = changed.resolved;
    understanding = from.inputs.understanding ?? applyAnalysis(read, null).understanding;
    knownUsed = changed.used;
    knownDropped = changed.dropped;
    band = from.inputs.band ?? null;
    platforms = from.inputs.platforms ?? null;
    rivals = from.inputs.rivals ?? [];
    brands = from.inputs.brands ?? [];
    for (const a of known) deps.tools.entities.set(a.entityId, a);
  } else {
    if (resume?.state.settle) {
      const answer = replyText(resume.state, resume.reply);
      if (resume.reply.kind !== 'typed' && resume.reply.kind !== 'text') {
        deps.emit({ type: 'message', body: 'Left as it is.', claims: [] });
        return ctx.stop('finished');
      }
      extra = `${resume.state.extra}\n\n${answer}`.trim();
      kind = resume.state.kind;
    } else if (resume?.state.pending?.id === bandQuestionId(deps.config.category)) {
      // The band card's answer is a band, not more of the brief: its label has a figure in it that
      // would be read as the budget.
      const typed = resume.reply.kind === 'typed' || resume.reply.kind === 'text';
      band = bandFromAnswer(
        typed ? null : (resume.reply as { optionIds: string[] }).optionIds,
        typed ? (resume.reply as { text: string }).text : null,
      );
      extra = resume.state.extra;
      kind = resume.state.kind;
    } else if (resume?.state.pending?.id === platformQuestionId(deps.config.category)) {
      // The platform card's answer is the campaign's platforms, not more of the brief.
      const typed = resume.reply.kind === 'typed' || resume.reply.kind === 'text';
      platforms = platformsFromAnswer(
        typed ? null : (resume.reply as { optionIds: string[] }).optionIds,
        typed ? (resume.reply as { text: string }).text : null,
        resume.state.pending,
      );
      extra = resume.state.extra;
      kind = resume.state.kind;
      band = resume.state.band;
    } else if (resume?.state.pending?.id === rulesQuestionId(deps.config.category)) {
      // The card's answer is a choice about the team's defaults, not more of the brief.
      const typed = resume.reply.kind === 'typed' || resume.reply.kind === 'text';
      rulesOverride =
        !typed && (resume.reply as { optionIds: string[] }).optionIds.includes('override');
      extra = resume.state.extra;
      kind = resume.state.kind;
      band = resume.state.band;
    } else if (resume) {
      extra = `${resume.state.extra}\n\n${replyText(resume.state, resume.reply)}`.trim();
      kind = resume.state.kind;
      band = resume.state.band;
    }
    platforms = platforms ?? resume?.state.platforms ?? null;
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
    ({ read, understanding } = applyAnalysis(read, analysed.analysis, handoff.title, input.text));

    // A brief that names no city plans for the team's own markets, when its defaults list them, so
    // the team is not asked for what it already told Oraqul. A city the brief names is never replaced.
    const markets = handoff.rules?.allowedTerritories ?? [];
    if (read.places.length === 0 && markets.length > 0) {
      read = { ...read, places: [...markets] };
      ctx.trace(`Planning for your team’s markets: ${markets.join(', ')}`);
    }

    // A brief that says nothing about the work and nowhere to launch is too thin to plan from, and
    // guessing a launch would be worse than asking. Only the person's own words count here: what
    // the model proposes for any title is not a description (PRD C1).
    const bare =
      !read.genre &&
      read.comps.length === 0 &&
      read.places.length === 0 &&
      !read.country &&
      !deps.config.described(read) &&
      // The analyst found a description in the person's words that the reader had no field for.
      !understanding?.readers;
    if (bare && !resume) {
      const question: Question = {
        id: `${deps.config.category}.describe`,
        card: 'text',
        prompt:
          'That is a little thin for me to plan from, and I would rather not guess. Tell me what it is about (its genre, a line on the story, the subject or the sound) and where you are or where you want to launch (a country or a city). A sentence or two is plenty.',
        options: [],
        hint: deps.config.minimum.example,
      };
      deps.emit({ type: 'question', agent: deps.config.category, ...question });
      return ctx.stop('waiting', {
        job: 'build',
        kind,
        extra,
        asked: true,
        settle: false,
        askedBand: false,
        band: null,
        askedPlatforms: false,
        platforms: null,
        askedRules: false,
        rulesOverride: false,
        pending: question,
      });
    }

    // The first question a build may ask: there is nothing to plan from without these (PRD C1). A full plan may also ask for the budget band, below.
    const missing = deps.config.minimum.missing(read);
    if (missing.length && !resume) {
      const question: Question = {
        id: deps.config.minimum.id,
        card: 'text',
        prompt: `To plan this I need ${list(missing)}. Everything else is optional.`,
        options: [],
        hint: deps.config.minimum.example,
      };
      deps.emit({ type: 'question', agent: deps.config.category, ...question });
      return ctx.stop('waiting', {
        job: 'build',
        kind,
        extra,
        asked: true,
        settle: false,
        askedBand: false,
        band: null,
        askedPlatforms: false,
        platforms: null,
        askedRules: false,
        rulesOverride: false,
        pending: question,
      });
    }

    // The second question a full build may ask: what the budget can carry decides which partners
    // and moves the plan may propose, so it is asked before the research and only once.
    rivals = rivalsFrom(input.text);
    brands = brandsFrom(input.text);
    band = band ?? bandFromBrief(read, input.text);
    // The team's budget ceiling sizes the plan when the brief gives no budget: asking for a figure the
    // team already set would be a silly question. It is a ceiling, so the plan never goes above it.
    const ceiling = handoff.rules?.budgetMax;
    if (!band && ceiling) {
      band = {
        band: bandOfBudget({ amount: ceiling.amount, currency: ceiling.currency }),
        source: 'assumed',
      };
      ctx.trace('Sizing the plan from your team’s budget ceiling');
      if (understanding) {
        understanding = {
          ...understanding,
          assumed: [
            ...understanding.assumed,
            {
              what: 'budget',
              value: `up to ${ceiling.currency} ${ceiling.amount.toLocaleString('en-GB')}`,
              why: 'Taken from your team’s defaults, because the brief gave no budget.',
            },
          ],
        };
      }
    }
    if (!band && read.scope === 'full' && !resume?.state.askedBand) {
      const question = bandQuestion(deps.config.category);
      deps.emit({ type: 'question', agent: deps.config.category, ...question });
      return ctx.stop('waiting', {
        job: 'build',
        kind,
        extra,
        asked: true,
        settle: false,
        askedBand: true,
        band: null,
        askedPlatforms: false,
        platforms: null,
        askedRules: false,
        rulesOverride: false,
        pending: question,
      });
    }

    // Platforms are never asked: a brief that names them is planned on them, and any other plans on
    // the format's usual platforms. The plan's "To sharpen" says that naming them would sharpen it.
    platforms =
      platforms ?? (platformsChosen(input.text).length ? platformsChosen(input.text) : null);

    // The fourth question a build may ask: a brief that asks for what the team's defaults rule out
    // gets one card. Asked once, before any research.
    const defaults = handoff.rules ?? NO_RULES;
    const clashes = defaults.applied.length
      ? conflictsOf(defaults, {
          places: read.places,
          budget: read.budget,
          brands: [...brands, ...read.partners],
          platforms,
        })
      : [];
    if (clashes.length && !resume?.state.askedRules) {
      const question = rulesQuestion(deps.config.category, clashes);
      deps.emit({ type: 'question', agent: deps.config.category, ...question });
      return ctx.stop('waiting', {
        job: 'build',
        kind,
        extra,
        asked: true,
        settle: false,
        askedBand: true,
        band,
        askedPlatforms: true,
        platforms,
        askedRules: true,
        rulesOverride: false,
        pending: question,
      });
    }
  }

  // The team's defaults, applied in code. A person who chose to go ahead against a clash sets only
  // that rule aside for this run, and it is logged against the rule.
  let rules = handoff.rules ?? NO_RULES;
  if (rulesOverride && rules.applied.length) {
    const clashes = conflictsOf(rules, {
      places: read.places,
      budget: read.budget,
      brands: [...brands, ...read.partners],
      platforms,
    });
    const kinds = new Set(clashes.map((c) => c.kind));
    await handoff.onOverride?.(
      [...kinds]
        .flatMap((k) => rules.byKind[k] ?? [])
        .concat(kinds.has('territory_block') ? (rules.byKind.territory_allow ?? []) : []),
    );
    rules = effectiveRules(rules, clashes);
  }
  const enforced = enforceRead(read, rules);
  read = enforced.read;
  if (enforced.dropped.length) {
    ctx.trace(`Leaving out ${enforced.dropped.join(', ')}: the team’s defaults rule it out`);
  }
  if (enforced.clamped) ctx.trace('Holding the budget to the team’s ceiling');
  if (read.places.length === 0 && enforced.dropped.length) {
    deps.emit({
      type: 'message',
      body: blocked({
        what: `Every city in this brief is ruled out by your team’s defaults (${enforced.dropped.join(', ')}).`,
        next: 'Change the defaults, or ask again and choose to go ahead against them.',
      }),
      claims: [],
    });
    return ctx.stop('finished');
  }
  brands = brands.filter(
    (b) => !rules.blockedPartners.some((x) => x.trim().toLowerCase() === b.trim().toLowerCase()),
  );
  platforms = withoutBlockedChannels(platforms, rules);
  handoff = { ...handoff, rules };

  ctx.trace('Finding the comps in Qloo');
  let comps: Anchors;
  let qlooFailed: boolean;
  try {
    ({ searchFailed: qlooFailed, ...comps } = await findComps(
      deps,
      ctx.keep,
      read,
      known,
      knownUsed,
      knownDropped,
      understanding?.proposed ?? [],
    ));
  } catch (err) {
    if (err instanceof QlooBudgetError) return budgetStop(deps, ctx);
    throw err;
  }
  if (comps.resolved.length === 0 && !qlooFailed) {
    ctx.trace('No comp found, so reading the genre in Qloo');
    try {
      comps = { ...comps, ...(await findGenreComps(deps, ctx.keep, read)) };
    } catch (err) {
      if (err instanceof QlooBudgetError) return budgetStop(deps, ctx);
      if (!(err instanceof QlooError)) throw err;
      qlooFailed = true;
    }
  }
  if (comps.resolved.length === 0) {
    noCompsStop(deps, ctx, read, qlooFailed);
    return ctx.stop('finished');
  }
  for (const a of comps.resolved) deps.tools.entities.set(a.entityId, a);

  const asked = await askQloo(deps, ctx, {
    title,
    read,
    comps,
    understanding,
    rivals,
    band: withLauncher(band, [briefText(handoff), extra].join('\n')),
    brands,
  });
  return writePlan(deps, ctx, {
    handoff,
    title,
    read,
    comps,
    asked,
    extra,
    kind,
    intro: `Here is the launch plan for “${title}”.`,
    band,
    platforms,
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
    /** The band the person gave or the brief stated. Null reads it from the brief again. */
    band?: PlanBand | null;
    /** The platforms the team chose. Null plans on the category's and the market's usual ones. */
    platforms?: string[] | null;
    /** Characters of each file the writer may read. */
    chars?: number;
    /** The outputs this run made first, saved before the plan. */
    earlier?: NewOutput[];
  },
): Promise<PlanRun> {
  const { handoff, title, read, comps, extra, kind } = input;
  const team = handoff.rules ?? NO_RULES;
  // The team's partners ruled out are taken out before the writer sees the findings, and again by
  // the line check, so a name cannot come back through the model.
  const asked = withoutBlockedPartners(input.asked, team);
  const platforms = withoutBlockedChannels(input.platforms ?? null, team);
  const guidance = guidanceText(team);
  // A full plan is always sized for a band: stated, asked, or assumed to be independent.
  const band: PlanBand | null = withLauncher(
    input.band ??
      bandFromBrief(read, [briefText(handoff), extra].join('\n')) ??
      (read.scope === 'full' ? { band: 'independent', source: 'assumed' } : null),
    [briefText(handoff), extra].join('\n'),
  );
  const { modules, queryPlan, sources } = asked;
  const text = briefText(handoff, input.chars, kind !== 'fix');
  const order = sectionOrder(modules);
  const signal = signalOf(deps.config.category, [text, extra].join('\n'));
  // One plan per territory: the home market first, then the diaspora cities (D4).
  const territories = territoriesOf({
    category: deps.config.category,
    cities: read.places,
    country: queryPlan.country,
    ranked: asked.grounded.brief.teamOrder.map((p) => p.place),
    platforms,
    blockedChannels: team.blockedChannels,
  });
  const today = new Date().toISOString().slice(0, 10);
  // The content calendar: rows worked back from the release date, on each territory's lead channel.
  const calendar = calendarRows({
    category: deps.config.category,
    release: releaseDate(read.window),
    today,
    territories,
    beats: deps.config.calendarBeats?.(read) ?? [],
  });
  // A section code writes whole, such as Games' launch beats, is not the writer's to write.
  const byCode = deps.config.codeSections.timeline && modules.includes('timeline');
  const core: LaunchSectionKey[] = ['bottom-line', 'positioning', 'audience', 'markets'];
  // What the writer cannot change, so the red team does not send a draft back for it.
  const ownKeys = deps.config.codeKeys ?? [];
  const codeSections: string[] = [...CODE_SECTIONS, ...ownKeys, ...(byCode ? ['timeline'] : [])];

  let grounded = asked.grounded;
  let understanding = asked.understanding;
  let ran = asked.ran;
  const researchRounds = [...asked.rounds];
  const everDropped: PlanProcess['dropped'] = [];
  let drafts = 0;

  const draft = async (feedback: string[]) => {
    drafts += 1;
    const writeInput: WriteInput<R> = {
      title,
      request: [
        text,
        extra,
        band ? bandLine(band) : '',
        platforms?.length ? platformLine(platforms) : '',
        guidance,
      ]
        .filter(Boolean)
        .join('\n\n'),
      read,
      comps: comps.used.filter((c) => !c.anchor),
      sections: order.filter(
        (key) =>
          !(
            key === 'measure' ||
            key === 'channels' ||
            key === 'calendar' ||
            ownKeys.includes(key) ||
            (byCode && key === 'timeline')
          ),
      ),
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
      band: band?.band ?? null,
      launcher: band?.launcher ?? null,
      flagships: flagshipNames(grounded.findings),
      teamPartners: read.partners,
      budgetMax: team.budgetMax,
      blockedPartners: team.blockedPartners,
    };
    const writerSections = written.sections.filter(
      (s) =>
        !CODE_SECTIONS.includes(s.key) &&
        !ownKeys.includes(s.key) &&
        !(byCode && s.key === 'timeline'),
    );
    const rough = checkSections(writerSections, checkCtx);
    // The code checks cannot tell whether a sentence says what its findings say, so a model reads
    // each grounded line beside only the evidence it cites. A line it cannot support goes back.
    const supported = await deps.reviewer?.support({
      category: deps.config.category,
      lines: supportLines(rough.sections, grounded.findings, sources),
    });
    ctx.tokens += supported?.tokens ?? 0;
    const narrowed = supported?.results
      ? dropUnsupported(rough.sections, supported.results)
      : { sections: rough.sections, dropped: [] as DroppedLine[] };
    const checked = {
      sections: narrowed.sections,
      dropped: [...rough.dropped, ...narrowed.dropped],
    };
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
      ...(modules.includes('channels')
        ? [channelsSection(deps.config.rules.titles.channels, territories)]
        : []),
      ...(modules.includes('calendar')
        ? [calendarSection(deps.config.rules.titles.calendar, calendar, deps.config.category)]
        : []),
      ...(modules.includes('measure')
        ? [
            measureSection(
              deps.config.rules.titles.measure,
              signal,
              deps.config.measures?.(read) ?? [],
            ),
          ]
        : []),
      ...(deps.config.codeSections
        .extra?.(read, { today, signal, band })
        .filter((s) => modules.some((m) => m === s.key)) ?? []),
      ...(byCode && deps.config.codeSections.timeline
        ? [deps.config.codeSections.timeline(read, today)]
        : []),
      withNotes(
        deps.config.codeSections.gaps(read, comps),
        deps.config.lead?.(read),
        comps,
        grounded.findings,
      ),
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
        comps: comps.used.filter((c) => c.source === 'you' && !c.anchor).map((c) => c.name),
      },
      deps.config.decisions,
    );
    const dropped = [...checked.dropped, ...filled.dropped];
    everDropped.push(...dropped.map((d) => ({ ...d, draft: drafts })));
    return { sections, dropped, by: written.by };
  };

  const reviewer = deps.reviewer ?? new ScriptedReviewer();
  const rounds: PlanReview['rounds'] = [];
  let status: PlanReview['status'] = 'unchecked';
  let next: string[] = [];
  let feedback: string[] = [];
  let lastBlocking = new Set<string>();
  let supportRewrote = false;
  let ask: string | null = null;
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
      request: [text, extra, guidance].filter(Boolean).join('\n\n'),
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
      earlier: rounds.flatMap((r) =>
        r.issues.filter((i) => i.blocking).map((i) => `${i.check}: ${i.text}`),
      ),
    });
    ctx.tokens += out.tokens;
    if (!out.review) break;
    const verdict = judge(out.review, understanding, unrun, codeSections);
    next = verdict.next;
    ask = verdict.ask;
    // Lines the support check took out of a core section are worth one more draft, so the writer
    // narrows them instead of the plan going out thinner there.
    const lostCore = current.dropped.filter(
      (d) => core.includes(d.section) && d.why.startsWith('It says more than'),
    );
    if (verdict.passed && lostCore.length > 0 && !supportRewrote && round < MAX_ROUNDS) {
      supportRewrote = true;
      rounds.push({ round, issues: verdict.issues, action: 'rewrote' });
      feedback = feedbackLines(current.dropped, verdict.issues);
      ctx.trace(`Narrowing lines that said more than the evidence, draft ${round + 1}`);
      current = await draft(feedback);
      continue;
    }
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
      const done = await runExtra(deps, ctx, {
        title,
        read,
        comps,
        queryPlan,
        grounded,
        understanding,
        extra: wider,
      });
      ({ grounded, understanding } = done);
      researchRounds.push({
        round: researchRounds.length + 1,
        open: openChecks(understanding).map((c) => c.text),
        ...done.round,
      });
      ran = [...ran, ...wider.map((w) => w.query)];
      action = 'researched';
    }
    rounds.push({ round, issues: verdict.issues, action });
    feedback = feedbackLines(current.dropped, verdict.issues);
    ctx.trace(`Rewriting the plan, draft ${round + 1}`);
    current = await draft(feedback);
  }

  const found = opportunitiesOf({
    findings: grounded.findings,
    worth: grounded.brief.worth,
    teamOrder: grounded.brief.teamOrder,
    signal,
  });
  // A dead end that survived every draft still never ships on its own: it gets a question.
  const stillOpen =
    status === 'flagged'
      ? (rounds.at(-1)?.issues ?? []).filter((i) => i.type === 'dead-end' && i.blocking)
      : [];
  const sections = withOpportunities(
    stillOpen.length
      ? withClosingQuestions(current.sections, stillOpen, deps.config.rules.titles.gaps)
      : current.sections,
    found,
  );
  const finished = decisionsOf({
    asked,
    read,
    band,
    territories,
    markets: marketsOf(
      null,
      territories.map((t) => t.name),
    ),
    home: queryPlan.country,
    category: deps.config.category,
    byProximity: deps.config.clashByProximity ?? false,
    text: [text, extra].join('\n'),
    today,
    release: releaseDate(read.window),
    blocked: team.blockedPartners,
  });
  const lead = deps.config.lead?.(read)?.trim().toLowerCase();
  const plan: LaunchPlan = {
    scope: read.scope,
    sections,
    comps: comps.used,
    // The lead is an anchor and never a comp, so it is not listed with the comps that were not found.
    compsNotFound: comps.dropped.filter((d) => d.name.trim().toLowerCase() !== lead),
    findings: grounded.findings,
    // Only the pages a kept line cites travel with the plan.
    sources: sources.filter((src) =>
      sections.some((sec) => sec.lines.some((l) => l.sourceIds.includes(src.id))),
    ),
    dropped: current.dropped,
    writer: current.by,
    understanding: understanding && band ? withBand(understanding, band) : understanding,
    review: understanding ? reviewOf(status, rounds, next) : null,
    process: { research: researchRounds, drafts, dropped: everDropped },
    rules: {
      category: deps.config.category,
      version: rules[deps.config.category].version,
      parts: ruleParts,
    },
    band,
    signal,
    territories: withLines(finished.territories, sections),
    calls: finished.calls,
    partners: finished.partners,
    partnerNotes: finished.partnerNotes,
    calendar: modules.includes('calendar') ? calendar : [],
    opportunities: found.opportunities,
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
  const dateReceipts: Receipt[] = asked.clash?.call
    ? asked.clash.lines.map((l) => ({
        ...(asked.clash?.call as Receipt),
        lineId: l.id,
        rule: `${asked.clash?.call?.rule ?? ''} ${l.rival}: overlap ${Math.round(l.overlap)}. You supplied the date.`,
      }))
    : [];
  const lineReceipts = [...grounded.brief.lineReceipts, ...grounded.receipts, ...dateReceipts];
  const cited = new Set(lineReceipts.map((r) => r.callId));
  ctx.receipts.splice(
    0,
    ctx.receipts.length,
    ...lineReceipts,
    ...ctx.receipts.filter((r) => !cited.has(r.callId)),
  );
  // The plan is saved either way. When the red team still has a blocking issue that only the
  // person can settle, one question follows the delivery; a plan is never held back for it.
  const settle: Question | null =
    kind !== 'fix' && status === 'flagged' && ask
      ? {
          id: `${deps.config.category}.settle`,
          card: 'single',
          prompt: `One thing would settle this plan: ${ask}`,
          options: [{ id: 'leave', label: 'Leave it as it is' }],
          hint: 'Or type your answer and the plan is made again with it.',
        }
      : null;
  if (settle) deps.emit({ type: 'question', agent: deps.config.category, ...settle });
  return ctx.stop(
    settle ? 'waiting' : 'finished',
    settle && kind !== 'fix'
      ? {
          job: 'build',
          kind,
          extra,
          asked: true,
          settle: true,
          askedBand: true,
          band,
          askedPlatforms: true,
          platforms: input.platforms ?? null,
          askedRules: true,
          rulesOverride: false,
          pending: settle,
        }
      : null,
    {
      kind,
      title,
      brief: {
        ...grounded.brief.brief,
        ...(asked.clash && asked.clash.lines.length > 0
          ? { dates: asked.clash.lines, weeks: asked.clash.weeks, chosenDate: asked.clash.chosen }
          : {}),
        cannot: [...grounded.brief.brief.cannot, ...gapsAsUntested(grounded.gaps)],
      },
      plan,
      report: null,
      headline,
      moves,
      confidence,
      inputs: {
        read,
        comps: comps.used.filter((c) => c.source === 'you' && !c.anchor).map((c) => c.name),
        resolved: comps.resolved,
        dropped: comps.dropped,
        used: comps.used,
        band,
        platforms: input.platforms ?? null,
        rivals: asked.rivals,
        brands: asked.brands,
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

/**
 * No comp was found in Qloo, so there is nothing to describe the audience with. When Qloo did not
 * answer, the person is told to try again rather than that their comps were wrong.
 */
export function noCompsStop(
  deps: { emit(event: ThreadEvent): void; config: Pick<LaunchConfig, 'words'> },
  ctx: RunCtx,
  read: LaunchRead,
  qlooFailed = false,
): void {
  const tried = [...read.comps, ...read.suggestedComps];
  deps.emit({
    type: 'message',
    body: qlooFailed
      ? blocked({
          what: `The audience data is not answering right now, so I could not look up the ${deps.config.words.comps}${tried.length ? ` (${tried.join(', ')})` : ''}.`,
          kept: 'Nothing is wrong with your brief, and I have kept it.',
          next: 'Send it again in a few minutes.',
        })
      : blocked({
          what: `I did not find a close match for this brief${tried.length ? `, or for the ${deps.config.words.comps} I tried (${tried.join(', ')})` : ''}, so I cannot describe who it is for yet.`,
          next: `Tell me what it is about, its genre, and where you are or where you want to launch, and I will plan from that. You do not need to name ${deps.config.words.comps}.`,
        }),
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
  reasons: { name: string; why: string }[] = [],
): Promise<Anchors & { searchFailed: boolean }> {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const whyOf = (name: string) => reasons.find((r) => same(r.name, name))?.why ?? null;
  const resolved = [...known];
  const used = knownUsed.filter((u) => resolved.some((a) => same(a.name, u.name)));
  const dropped = [...knownDropped];
  // Anchors the launch names besides its comps come last, so they never crowd out a named comp.
  const named = [
    ...read.comps,
    ...(deps.config.teamAnchors?.(read) ?? []).filter((n) => !read.comps.some((c) => same(c, n))),
  ];
  const yours = named.filter((c) => !resolved.some((a) => same(a.name, c))).slice(0, MAX_COMPS);
  // An earlier show or a featured artist anchors the audience but is never one of the comps.
  const isAnchor = (name: string) => !read.comps.some((c) => same(c, name));
  const proposals =
    named.length >= MIN_COMPS
      ? []
      : read.suggestedComps.filter((c) => !named.some((y) => same(y, c)));
  const lead = deps.config.lead?.(read) ?? null;
  const leadName = lead && !resolved.some((a) => same(a.name, lead)) ? lead : null;
  const names = [...(leadName ? [leadName] : []), ...yours, ...proposals].slice(0, MAX_SEARCH);
  if (names.length === 0) return { resolved, used, dropped, searchFailed: false };

  const { data, receipts } = await tools.resolveBundle.run(deps.tools, {
    names,
    types: deps.config.anchorTypes,
  });
  keep(receipts);
  const anchors = resolveBundleOutputSchema.parse(data).anchors;
  // Every search failing means Qloo did not answer, not that the names were wrong.
  const searchFailed = anchors.length > 0 && anchors.every((a) => a.status === 'failed');
  for (const a of anchors) {
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
        why: mine ? null : whyOf(a.name),
        match: match?.detail ?? null,
        choice: null,
        ...(mine && isAnchor(a.name) ? { anchor: true } : {}),
      });
    } else if (a.status === 'ambiguous' && a.candidates.length) {
      const pick = settle(a.candidates, read.country);
      resolved.push({ entityId: pick.entityId, name: pick.name, popularity: pick.popularity });
      used.push({
        name: a.name,
        source: mine ? 'you' : 'added',
        why: mine ? null : whyOf(a.name),
        match: pick.detail,
        choice: `Qloo has ${a.candidates.length} ${deps.config.words.entity}s called “${a.name}”. I used the ${pick.detail ?? 'best known'} one, ${read.country && pick.detail?.includes(read.country) ? `from ${read.country} and ` : ''}the best known. Say which you mean if it is another.`,
        ...(mine && isAnchor(a.name) ? { anchor: true } : {}),
      });
    } else if (a.status === 'not_found' && a.candidates.length) {
      // No exact name, so the nearest title Qloo has stands in, and the plan says so.
      const pick = closest(a.name, a.candidates);
      if (resolved.some((r) => r.entityId === pick.entityId)) continue;
      resolved.push({ entityId: pick.entityId, name: pick.name, popularity: pick.popularity });
      used.push({
        name: pick.name,
        source: mine ? 'you' : 'added',
        why: mine ? null : whyOf(a.name),
        match: pick.detail,
        choice: `Qloo has no ${deps.config.words.entity} called “${a.name}”. I used the closest one it has, “${pick.name}”${pick.detail ? ` (${pick.detail})` : ''}. Say which you mean if it is another.`,
        ...(mine && isAnchor(a.name) ? { anchor: true } : {}),
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
  return { resolved, used, dropped, searchFailed };
}

/**
 * How far to trust an audience read when some of the comps are Oraqul's own choice. Titles chosen
 * from the description steer the questions, but they are a guess at who the audience is, so no
 * line resting on them reads higher than medium; the genre's own titles read lower (spec §5.1).
 */
export function compCap(used: CompUsed[]): { level: Confidence; why: string } | null {
  if (used.some((c) => c.source === 'genre')) {
    return {
      level: 'lower',
      why: 'this rests on titles Qloo lists for the genre, not on your comps',
    };
  }
  if (used.some((c) => c.source === 'added')) {
    return { level: 'medium', why: 'this rests on comps Oraqul chose from your description' };
  }
  return null;
}

/** A question for each thin spot the drafts left without a way forward, under "To sharpen". */
function withClosingQuestions(
  sections: LaunchSection[],
  open: { text: string; ask?: string }[],
  title: string,
): LaunchSection[] {
  const lines = open.map((issue, i) =>
    codeLine(
      `gaps-open-${i + 1}`,
      issue.ask ?? 'Tell me a little more about this part of the launch, and I will sharpen it.',
    ),
  );
  const has = sections.some((s) => s.key === 'gaps');
  return has
    ? sections.map((s) => (s.key === 'gaps' ? { ...s, lines: [...s.lines, ...lines] } : s))
    : [...sections, { key: 'gaps' as const, title, lines }];
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
    config: Pick<LaunchConfig, 'anchorTypes' | 'genreTagPrefix' | 'tagPhrases' | 'words'>;
    tools: ToolContext;
  },
  keep: (made: Receipt[]) => void,
  read: LaunchRead,
): Promise<Pick<Anchors, 'resolved' | 'used'>> {
  const none = { resolved: [], used: [] };
  const extra = deps.config.tagPhrases?.(read) ?? [];
  if (!read.genre && extra.length === 0) return none;
  const words = (read.genre ?? '').split(/[^\p{L}]+/u).filter((w) => w.length >= 4);
  const phrases = [...new Set([...(read.genre ? [read.genre] : []), ...extra, ...words])].slice(
    0,
    5,
  );
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
        source: 'genre',
        match: t.year ? String(t.year) : null,
        choice: `Qloo had none of the comps by name, so I used “${t.name}”, which it lists for ${list(named)}${read.country ? ` from ${read.country}` : ''}. Tell me more about it to sharpen the read.`,
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

/**
 * Says so in Gaps when the work the launch is about (an artist) is not in Qloo by name. That is
 * normal before a debut, and the plan then rests on the comps, or on the genre without them.
 */
// Queries whose results are named places, shows or acts that Qloo lists for an audience. Qloo has
// no way to say whether each is still open or airing.
const LISTED = new Set([
  'cinemas',
  'venues',
  'community',
  'podcasts',
  'shows',
  'bookshops',
  'films',
  'music',
  'support',
  'similar',
  'games',
]);

/**
 * What the person can do about two things code knows: the lead is new to Qloo, so the plan is
 * built from comparable titles, and the names Qloo lists are current taste that nobody has checked
 * is still running. Both read as a suggestion, never as a limit.
 */
function withNotes(
  section: LaunchSection,
  lead: string | null | undefined,
  comps: Pick<Anchors, 'resolved' | 'dropped'> & { used: CompUsed[] },
  findings: Finding[],
): LaunchSection {
  const missed = lead
    ? comps.dropped.some((d) => d.name.trim().toLowerCase() === lead.trim().toLowerCase())
    : false;
  const named = comps.used.filter((c) => !c.anchor).map((c) => c.name);
  const lines = [
    ...(lead && missed
      ? [
          codeLine(
            `gaps-lead-${slug(lead)}`,
            comps.resolved.length > 0
              ? `${lead} is new, so the picture of its audience is built from comparable titles${named.length ? `: ${list(named)}` : ''}. Name your own and I will swap them in.`
              : `${lead} is new, and no comparable titles came up, so the plan leans on what the genre’s audience likes. Tell me a few titles it is like and I will tighten it.`,
          ),
        ]
      : []),
    ...(findings.some((f) => LISTED.has(f.query))
      ? [
          codeLine(
            'gaps-still-active',
            'The venues, shows and podcasts named here come from what this audience likes now. It is worth confirming each is still active before you pitch.',
          ),
        ]
      : []),
  ];
  return lines.length ? { ...section, lines: [...lines, ...section.lines] } : section;
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
    body: blocked({
      what: 'This run reached its limit on audience lookups before the plan was complete.',
      kept: 'Nothing half-built was saved.',
      next: 'Send it again, or ask for fewer cities or a narrower plan to keep it within the limit.',
    }),
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

/** The shared libraries a plan used, by version, saved beside the category's own. */
const ruleParts = {
  shared: SHARED_RULES.version,
  partners: PARTNER_RULES.version,
  calendar: CALENDAR_RULES.version,
};

/** The content rating a reading carries, for the categories that read one (Film). */
function ratingOf(read: LaunchRead): 'family' | 'adult' | null {
  return 'rating' in read && (read.rating === 'family' || read.rating === 'adult')
    ? read.rating
    : null;
}

// The calls on dates, territories and partners, and the partners with their tiers. All computed
// from what Qloo returned; the model sets none of it (hard rule 1).
function decisionsOf(input: {
  asked: Asked;
  read: LaunchRead;
  band: PlanBand | null;
  territories: Territory[];
  markets: string[];
  home: string | null;
  category: Category;
  /** True where a rival counts by how near its date is to the show's (Live shows E6). */
  byProximity: boolean;
  text: string;
  today: string;
  release: string | null;
  /** Partners the team never proposes. */
  blocked: string[];
}) {
  const { asked, read, band, markets } = input;
  const ranked = asked.grounded.brief.teamOrder;
  const strongest = ranked.find((p) => p.status === 'ranked')?.place ?? null;
  const placed = territoryCalls(
    input.territories,
    ranked.map((p) => ({ ...p })),
    strongest,
  );
  const built = partnerOptions({
    findings: asked.grounded.findings,
    signed: read.partners,
    band: band?.band ?? 'independent',
    markets,
    home: input.home,
    category: input.category,
    tone: toneOf(input.text, ratingOf(read)),
    ages: read.ages,
    launcher: band?.launcher ?? null,
    considered: asked.brands,
    blocked: input.blocked,
  });
  // A brand shows a market only when a source confirms it, and carries what the checks found.
  const partners = built.partners.map((p) => checkedPartner(p, asked.brandChecks[p.name]));
  const partnerCalls = built.calls;
  const partnered = withPartnerIds(placed.territories, partnerCalls, partners);
  return {
    territories: partnered,
    partners,
    partnerNotes: partnerNotes({
      release: input.release,
      today: input.today,
      band: band?.band ?? 'independent',
      launcher: band?.launcher ?? null,
      bare: partnered.filter((t) => t.partnerIds.length === 0).map((t) => t.name),
    }),
    calls: [
      ...(input.byProximity
        ? showDateCalls(asked.clash, rivalsFrom(input.text), input.release)
        : dateCalls(asked.clash, input.release)),
      ...placed.calls,
      ...partnerCalls,
    ],
  };
}

/** The writer is told what the band can carry; the line check enforces it for flagship partners. */
function bandLine(band: PlanBand): string {
  const who = band.launcher
    ? ` Who is launching: ${band.launcher === 'solo' ? 'a solo launcher' : `a ${band.launcher} launcher`}, so propose only partners that kind of launch can realistically land.`
    : '';
  return `Budget band: ${BAND_LABEL[band.band].toLowerCase()}. Propose only what this budget can carry, and no flagship partner (a national brand that sells at scale) unless the team named it or the band is mid-size or major.${who}`;
}

// A band the person did not state shows under the bottom line with the other assumptions.
function withBand(understanding: Understanding, band: PlanBand): Understanding {
  if (band.source === 'brief') return understanding;
  return {
    ...understanding,
    assumed: [
      ...understanding.assumed,
      {
        what: 'Budget band',
        value: BAND_LABEL[band.band],
        why:
          band.source === 'asked'
            ? 'You gave it when asked.'
            : 'You skipped the question, so the plan is sized for an independent release.',
      },
    ],
  };
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
