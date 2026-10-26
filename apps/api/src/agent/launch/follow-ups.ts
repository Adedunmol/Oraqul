import {
  fitBand,
  fitFromLift,
  liftOutputSchema,
  QlooBudgetError,
  QlooError,
  resolveBundleOutputSchema,
  rivalTypeOf,
  scoreRivalsOutputSchema,
  type ToolContext,
  tools,
} from '@oraqul/engine';
import type {
  AgentReply,
  Brief,
  Claim,
  Confidence,
  Finding,
  Move,
  Output,
  OverallConfidence,
  Partner,
  ProjectInput,
  Receipt,
  RivalDate,
  StopReason,
  ThreadEvent,
} from '@oraqul/schema';
import type { Handoff, NewOutput } from '../category-agents.js';
import { ungroundedClaims, ungroundedLines } from '../grounding.js';
import { normalise } from '../router/decide.js';
import { advance, newRunState } from '../runtime.js';
import { type Planner, STANDALONE_CONTEXT } from '../types.js';
import { baselineFor } from './baseline.js';
import { round2, slug } from './brief.js';
import { checkLine } from './check.js';
import type { LaunchConfig } from './config.js';
import { partnerKit } from './partners.js';
import { briefText, type LaunchInputs, type PlanRun } from './pipeline.js';
import type { LaunchRead } from './read-core.js';
import { releaseDate } from './text.js';
import type { PlanWriter, WrittenLine } from './writer.js';

export interface FollowUpDeps<R extends LaunchRead = LaunchRead> {
  tools: ToolContext;
  emit(event: ThreadEvent): void;
  config: LaunchConfig<R>;
}

const rank: Record<Confidence, number> = { lower: 0, medium: 1, high: 2 };
const OVERLAP_BAND = { risky: 'high', moderate: 'moderate', low: 'low' } as const;

function collector(deps: Pick<FollowUpDeps, 'emit'>) {
  const receipts: Receipt[] = [];
  const keep = (made: Receipt[]) => {
    for (const r of made) {
      receipts.push(r);
      deps.emit({ type: 'receipt', receipt: r });
    }
  };
  const done = (reason: StopReason, output: NewOutput | null = null): PlanRun => ({
    reason,
    state: null,
    receipts,
    output,
    tokens: 0,
  });
  return { receipts, keep, done };
}

function say(deps: Pick<FollowUpDeps, 'emit'>, body: string, claims: Claim[] = []) {
  deps.emit({ type: 'message', body, claims });
}

/** The plan and the chat as one text block for the model. Context, never evidence. */
export function planContext(
  plan: Output,
  recent: Handoff['recent'],
  memory: string[] = [],
): string {
  const byLine = new Map(plan.receipts.flatMap((r) => (r.lineId ? [[r.lineId, r.callId]] : [])));
  const cite = (id: string) => (byLine.has(id) ? ` [receipt ${byLine.get(id)}]` : '');
  const b = plan.brief;
  const lines = [
    `Plan ${plan.label}. Headline: ${plan.headline}`,
    ...plan.moves.map((m, i) => `Move ${i + 1}: ${m.text}${m.lineId ? cite(m.lineId) : ''}`),
    ...b.assumptions.map((a) => `Assumption "${a.text}": ${a.verdict}. ${a.why}${cite(a.id)}`),
    ...b.audience.map((a) => `Audience ${a.name}: index ${a.affinity}${cite(a.id)}`),
    ...b.places.map(
      (p) => `City ${p.name}: lift ${p.lift}, ${p.confidence} confidence${cite(p.id)}`,
    ),
    ...(['s1', 's2', 's3'] as const).flatMap((k) =>
      b[k].map(
        (l) =>
          `${plan.sections.find((s) => s.key === k)?.one ?? k} ${l.name}: fit ${l.fit}${cite(l.id)}`,
      ),
    ),
    ...b.cannot.map((c) => `Could not test ${c.item}: ${c.reason}`),
    ...(memory.length
      ? ['Project notes (what the project remembers):', ...memory.map((m) => `- ${m}`)]
      : []),
    'Chat so far:',
    ...recent.map((l) => `${l.from === 'person' ? 'Person' : 'Oraqul'}: ${l.text}`),
  ];
  return lines.join('\n');
}

/**
 * Answers a question about a plan (PRD J7). If the answer would change a decision, offers a what-if
 * instead of changing the plan.
 */
export async function runPlanAnswer<R extends LaunchRead>(
  handoff: Handoff,
  deps: FollowUpDeps<R> & { writer: PlanWriter<R> },
  plan: Output,
  inputs: LaunchInputs<R> | null,
): Promise<PlanRun> {
  const launch = plan.plan;
  if (!launch) return { reason: 'error', state: null, receipts: [], output: null, tokens: 0 };
  deps.emit({
    type: 'trace.step',
    agent: deps.config.category,
    step: 1,
    of: 2,
    text: 'Reading the plan’s findings',
  });
  const read = inputs?.read;
  const planText = launch.sections
    .flatMap((s) => s.lines.map((l) => `${s.title}${l.group ? ` (${l.group})` : ''}: ${l.text}`))
    .join('\n');
  const chat = [
    ...(handoff.memory?.length
      ? ['Project notes (what the project remembers):', ...handoff.memory.map((m) => `- ${m}`), '']
      : []),
    ...handoff.recent.map((l) => `${l.from === 'person' ? 'Person' : 'Oraqul'}: ${l.text}`),
  ].join('\n');
  deps.emit({
    type: 'trace.step',
    agent: deps.config.category,
    step: 2,
    of: 2,
    text: 'Writing the answer',
  });
  const written = await deps.writer.answer({
    title: handoff.title,
    read: read ?? deps.config.emptyRead,
    question: handoff.message.text,
    plan: planText,
    chat,
    findings: launch.findings,
  });
  const ctx = {
    findings: launch.findings,
    sources: launch.sources,
    briefNames: [
      handoff.title,
      ...launch.comps.map((c) => c.name),
      ...(read ? deps.config.briefNames.answer(read) : []),
    ],
    briefText: `${briefText(handoff)}\n${handoff.message.text}`,
    teamCities: read?.places ?? [],
    teamAges: read?.ages ?? [],
    allowed: ['audience' as const],
    rules: deps.config.rules,
  };
  const kept = written.lines.filter((l: WrittenLine) => checkLine('audience', l, ctx) === null);
  const lines = kept.length
    ? kept
    : launch.findings.slice(0, 1).map((f) => ({
        kind: 'grounded' as const,
        text: f.text,
        findingIds: [f.id],
        names: [],
        group: null,
      }));
  const claims: Claim[] = lines.flatMap((l) => {
    const ids = l.findingIds.flatMap(
      (id) => launch.findings.find((f) => f.id === id)?.callIds ?? [],
    );
    return ids.length ? [{ text: l.text, receiptIds: [...new Set(ids)] }] : [];
  });
  const message = [
    ...lines.map((l) => l.text),
    written.changesDecision
      ? 'That would change the plan. Say it as a what-if, such as “What if we open in Toronto instead?”, and I will rerun it.'
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  if (ungroundedClaims({ message, claims }, plan.receipts).length) {
    return { reason: 'error', state: null, receipts: [], output: null, tokens: written.tokens };
  }
  say(deps, message, claims);
  return { reason: 'finished', state: null, receipts: [], output: null, tokens: written.tokens };
}

/**
 * A question about a plan saved before findings, on the tool loop (spec §3.2): the planner may
 * cite the plan's receipts or run new calls, and code checks every claim. It never asks a card.
 */
export async function runAnswer<R extends LaunchRead>(
  handoff: Handoff,
  deps: FollowUpDeps<R> & { planner: Planner; maxSteps: number },
  plan: Output,
  inputs: LaunchInputs<R> | null,
): Promise<PlanRun> {
  const project: ProjectInput = {
    category: deps.config.category,
    name: handoff.title,
    lead: handoff.title,
    places: inputs?.read.places ?? [],
    comps: inputs?.resolved.map((a) => a.name) ?? [],
  };
  for (const a of inputs?.resolved ?? []) deps.tools.entities.set(a.entityId, a);
  const state = newRunState(project, handoff.mode, deps.maxSteps, {
    prior: plan.receipts,
    context: planContext(plan, handoff.recent, handoff.memory),
    question: handoff.message.text,
  });
  let reason: StopReason = 'finished';
  await advance(state, {
    planner: deps.planner,
    tools: deps.tools,
    consultMaxSteps: 4,
    // The run service ends every segment itself, so the loop's own stop is kept as the reason.
    emit: (event) => {
      if (event.type === 'run.stopped') reason = event.reason;
      else deps.emit(event);
    },
  });
  return { reason, state: null, receipts: state.receipts, output: null, tokens: 0 };
}

/**
 * A standalone chat inside a project: the tool loop with no plan, brief or notes, so a person can
 * think out loud about the work without the project's own memory in the way. It knows the
 * category and the project's name, and every claim is still checked against Qloo calls.
 */
export async function runStandalone<R extends LaunchRead>(
  handoff: Handoff,
  deps: FollowUpDeps<R> & { planner: Planner; maxSteps: number },
): Promise<PlanRun> {
  const project: ProjectInput = {
    category: deps.config.category,
    name: handoff.title,
    lead: '',
    places: [],
    comps: [],
  };
  const state = newRunState(project, handoff.mode, deps.maxSteps, {
    prior: [],
    context: [
      `${STANDALONE_CONTEXT} This is a standalone chat inside a ${deps.config.category} project. You know exactly two things about the project: its category is ${deps.config.category} and its name is "${handoff.title}". State them when asked. You have no brief, plan, cities, comps or notes from the project, so do not guess any, and never ask the person to supply the title or category: you already have them. Do not look the name up in Qloo unless the person asks you to. Answer the person's question directly and in plain words. Use Qloo only where it makes the answer sounder, for what an audience likes or where it is, and cite those calls. If the question needs no Qloo data, just answer from your launch knowledge, without saying where it comes from.`,
      'Chat so far:',
      ...handoff.recent.map((l) => `${l.from === 'person' ? 'Person' : 'Oraqul'}: ${l.text}`),
    ].join('\n'),
    question: handoff.message.text,
  });
  let reason: StopReason = 'finished';
  await advance(state, {
    planner: deps.planner,
    tools: deps.tools,
    consultMaxSteps: 4,
    emit: (event) => {
      if (event.type === 'run.stopped') reason = event.reason;
      else deps.emit(event);
    },
  });
  return { reason, state: null, receipts: state.receipts, output: null, tokens: 0 };
}

/** With no model, a standalone chat cannot talk freely, and says so. */
export class StandalonePlanner implements Planner {
  async next() {
    const reply: AgentReply = {
      message:
        'This chat is set up to talk freely about the project, which needs the model, and no model is connected here. Start a chat on the project to use its plan.',
      claims: [],
    };
    return { kind: 'finish' as const, reply };
  }
}

/** With no model: say what the plan already shows, cited, and how to test something new. */
export class PlanSummaryPlanner implements Planner {
  constructor(private readonly plan: Output) {}

  async next() {
    const byLine = new Map(
      this.plan.receipts.flatMap((r) => (r.lineId ? [[r.lineId, r.callId]] : [])),
    );
    const claims: Claim[] = this.plan.moves.flatMap((m) => {
      const id = m.lineId ? byLine.get(m.lineId) : undefined;
      return id ? [{ text: m.text, receiptIds: [id] }] : [];
    });
    const reply: AgentReply = {
      message: `Here is what ${this.plan.label} shows. ${this.plan.headline} ${claims.map((c) => c.text).join(' ')} To test something new, ask a what-if, such as “What if we open in Accra first?”`,
      claims,
    };
    return { kind: 'finish' as const, reply };
  }
}

/** Spec §5: a rival date check. Each rival is scored against the comps in one call. */
export async function runDateCheck<R extends LaunchRead>(
  deps: FollowUpDeps<R>,
  plan: Output,
  inputs: LaunchInputs<R>,
  rivals: { title: string; date: string }[],
): Promise<PlanRun> {
  const { receipts, keep, done } = collector(deps);
  const trace = (step: number, text: string) =>
    deps.emit({ type: 'trace.step', agent: deps.config.category, step, of: 3, text });
  if (rivals.length === 0) {
    say(
      deps,
      `Send the rival releases with their opening dates and I will check how much of your audience each one shares, like ${deps.config.words.rivalExample}.`,
    );
    return done('finished');
  }
  const anchors = inputs.resolved.map((a) => a.entityId);
  for (const a of inputs.resolved) deps.tools.entities.set(a.entityId, a);
  try {
    trace(1, 'Finding the rival releases in Qloo');
    const found = await tools.resolveBundle.run(deps.tools, {
      names: rivals.map((r) => r.title),
      types: [...deps.config.rivalTypes],
    });
    keep(found.receipts);
    const anchorsFound = resolveBundleOutputSchema.parse(found.data).anchors;
    const resolved = rivals.flatMap((r) => {
      const a = anchorsFound.find((x) => x.name === r.title);
      return a?.status === 'found' && a.entityId ? [{ ...r, entityId: a.entityId }] : [];
    });
    const missing = rivals.filter((r) => !resolved.some((x) => x.title === r.title));
    if (resolved.length === 0) {
      say(
        deps,
        `Qloo did not find ${rivals.map((r) => r.title).join(', ')} by name, so no date could be checked.`,
      );
      return done('finished');
    }

    trace(2, 'Measuring how much of your audience each rival shares');
    const rivalType = rivalTypeOf(deps.config.rivalTypes);
    if (!rivalType) return done('error');
    const scored = await tools.scoreRivals.run(deps.tools, {
      entityIds: anchors,
      type: rivalType,
      rivals: resolved.map((r) => r.entityId),
    });
    keep(scored.receipts);
    const data = scoreRivalsOutputSchema.parse(scored.data);
    const [call] = scored.receipts;
    if (!call) return done('error');

    trace(3, 'Ranking the dates by overlap');
    const weeks = [...new Set(resolved.map((r) => r.date))].sort();
    const lines: RivalDate[] = resolved.flatMap((r) => {
      const row = data.rivals.find((x) => x.entityId === r.entityId);
      if (!row || row.overlap === null || row.band === null) return [];
      const band = OVERLAP_BAND[row.band];
      const advice =
        band === 'high'
          ? 'Avoid this week: the rival shares much of your audience.'
          : band === 'moderate'
            ? 'Possible, with a campaign that sets your title apart.'
            : 'Safe: little shared audience.';
      return [
        {
          id: `date-${r.date}-${slug(r.title)}`,
          date: r.date,
          week: weeks.indexOf(r.date),
          rival: row.name,
          overlap: row.overlap,
          band,
          advice,
        },
      ];
    });
    if (lines.length === 0) {
      say(deps, 'Qloo did not score any of the rivals, so no date could be checked.');
      return done('finished');
    }
    const lineReceipts = lines.map((l) => ({
      ...call,
      lineId: l.id,
      rule: `${call.rule} ${l.rival}: overlap ${l.overlap}. You supplied the date.`,
    }));
    // A week is as risky as its riskiest rival; the safest week is the one to pick.
    const worstOf = (date: string) =>
      Math.max(...lines.filter((l) => l.date === date).map((l) => l.overlap));
    const chosen = [...weeks].sort((a, b) => worstOf(a) - worstOf(b))[0] ?? '';
    const best = lines.filter((l) => l.date === chosen).sort((a, b) => b.overlap - a.overlap)[0];
    const worst = [...lines].sort((a, b) => b.overlap - a.overlap)[0];
    const moves: Move[] = [];
    if (best) {
      moves.push({
        text: `Open the week of ${chosen}: the most your audience overlaps with a rival that week is ${best.overlap}.`,
        lineId: best.id,
      });
    }
    if (worst && worst.band !== 'low' && worst.date !== chosen) {
      moves.push({
        text: `Avoid ${worst.date}: ${worst.rival} shares much of your audience (overlap ${worst.overlap}).`,
        lineId: worst.id,
      });
    }
    const brief: Brief = { ...plan.brief, dates: lines, weeks, chosenDate: chosen };
    const confidence: OverallConfidence = {
      level: data.confidence === 'lower' ? 'low' : data.confidence,
      why: `${data.why.charAt(0).toUpperCase()}${data.why.slice(1)}. You supplied the dates.`,
    };
    const headline = best
      ? `Open the week of ${chosen}, where rivals share the least of your audience.`
      : 'No week could be checked.';
    const reply = writeReply(
      headline,
      moves,
      lineReceipts,
      missing.map((m) => m.title),
    );
    const own: Brief = { ...onlyOwnLines(brief), dates: lines };
    if (ungroundedClaims(reply, receipts).length || ungroundedLines(own, lineReceipts).length) {
      return done('error');
    }
    say(deps, reply.message, reply.claims);
    receipts.push(...lineReceipts);
    return done('finished', {
      kind: 'date',
      title: 'Rival date check',
      brief,
      plan: null,
      report: null,
      headline,
      moves,
      confidence,
      inputs,
    });
  } catch (err) {
    return failed(deps, err, done);
  }
}

/** A brand the plan ranked, by the name asked or a fuller one that starts with it. */
export function rankedBrand(
  plan: { plan?: { findings: Finding[] } | null },
  asked: string,
): { name: string; entityId: string } | null {
  const want = normalise(asked);
  const brands = (plan.plan?.findings ?? [])
    .filter((f) => f.query.startsWith('brands'))
    .flatMap((f) => f.entities)
    .flatMap((e) => (e.entityId ? [{ name: e.name, entityId: e.entityId }] : []));
  return (
    brands.find((b) => normalise(b.name) === want) ??
    brands.find((b) => normalise(b.name).startsWith(`${want} `)) ??
    null
  );
}

/** A partner brief: the partner is scored against the baseline, then a draft is written. */
export async function runPartnerBrief<R extends LaunchRead>(
  handoff: Handoff,
  deps: FollowUpDeps<R> & { writer: PlanWriter<R> },
  plan: Output,
  inputs: LaunchInputs<R>,
  named: string | null,
): Promise<PlanRun> {
  const { receipts, keep, done } = collector(deps);
  const trace = (step: number, text: string) =>
    deps.emit({ type: 'trace.step', agent: deps.config.category, step, of: 3, text });
  const asked = named ?? suggestedPartner(plan);
  // The plan may have ranked this brand under its fuller name ("MTN" for "MTN Group"). That brand,
  // already found in Qloo, is the one asked about, so it is not searched for again by exact name.
  const ranked = asked ? rankedBrand(plan, asked) : null;
  const name = ranked?.name ?? asked;
  if (!name) {
    say(
      deps,
      'Name the brand or podcast you want a partner brief for, and I will score it and draft one.',
    );
    return done('finished');
  }
  const anchors = inputs.resolved.map((a) => a.entityId);
  for (const a of inputs.resolved) deps.tools.entities.set(a.entityId, a);
  // An artist has no mass-market baseline to score against, so it is backed by the plan's own
  // music finding that ranked it for this audience.
  const music = plan.plan?.findings.find(
    (f) =>
      deps.config.artistQueries.includes(f.query) &&
      f.entities.some((e) => e.name.toLowerCase() === name.toLowerCase()),
  );
  if (music) return artistBrief(handoff, deps, plan, inputs, name, music, done);
  try {
    trace(1, `Finding ${name} in Qloo`);
    let type: 'urn:entity:brand' | 'urn:entity:podcast' = 'urn:entity:brand';
    let entityId: string | null = ranked?.entityId ?? null;
    for (const t of entityId ? [] : (['urn:entity:brand', 'urn:entity:podcast'] as const)) {
      const found = await tools.resolveBundle.run(deps.tools, { names: [name], types: [t] });
      keep(found.receipts);
      const [a] = resolveBundleOutputSchema.parse(found.data).anchors;
      if (a?.status === 'found' && a.entityId) {
        type = t;
        entityId = a.entityId;
        break;
      }
    }
    if (!entityId) {
      say(
        deps,
        `Qloo did not find “${name}” as one brand or podcast by that exact name, so it could not be scored. Check the spelling, or name another partner.`,
        receipts
          .slice(0, 1)
          .map((r) => ({ text: `Searched for ${name}.`, receiptIds: [r.callId] })),
      );
      return done('finished');
    }

    trace(
      2,
      `Scoring ${name} against mass-market ${type === 'urn:entity:brand' ? 'brands' : 'podcasts'}`,
    );
    const baseline = await baselineFor(deps.config.category, deps.tools, keep, type);
    if (baseline.length < 2) {
      say(deps, 'Too few baseline names were found in Qloo to score this partner against.');
      return done('finished');
    }
    const scored = await tools.lift.run(deps.tools, {
      entityIds: anchors,
      type,
      candidates: [entityId],
      baseline: baseline.map((b) => b.entityId),
    });
    keep(scored.receipts);
    const lift = liftOutputSchema.parse(scored.data);
    const [call] = scored.receipts;
    const value = lift.candidates[0]?.lift ?? null;
    if (!call || value === null) {
      say(deps, `Qloo did not score ${name} for this audience, so no fit could be measured.`);
      return done('finished');
    }

    trace(3, 'Drafting the brief');
    const fit = fitFromLift(value);
    const segment = plan.brief.audience.find((a) => a.id !== 'aud-female' && a.id !== 'aud-male');
    const city = plan.brief.places[0]?.name;
    const id = `partner-${slug(name)}`;
    const template = [
      `Hi ${name} team,`,
      `We are launching ${handoff.title}${city ? `, opening first in ${city}` : ''}. Taste data from Qloo shows the audience we are building it for${segment ? ` (${segment.name.toLowerCase()})` : ''} likes ${name} more than the biggest mass-market names.`,
      'We would love to talk about a partnership around the release. Could we set up a call?',
      'Thanks,',
    ].join('\n\n');
    const draft = await draftPitch(handoff, deps, plan, inputs, {
      id: `f-partner-${slug(name)}`,
      query: 'partner',
      text: `${name} scores lift ${round2(value)} with your comps' audience, against ${baseline.map((b) => b.name).join(', ')} in the same call (fit ${fit}).`,
      entities: [{ entityId, name, affinity: null, detail: null }],
      numbers: { lift: round2(value), fit },
      verdict: null,
      confidence: lift.confidence,
      why: lift.why,
      context: { city: null, ages: [], tags: [], country: null, yearFrom: null, audience: null },
      callIds: [call.callId],
    });
    const draftText = draft ?? template;
    const line: Partner = {
      id,
      name,
      type: type === 'urn:entity:brand' ? 'Brand' : 'Podcast',
      fits: segment?.name ?? 'The comps’ audience',
      evidence: `Fit ${fit}: lift ${round2(value)} over ${baseline.map((b) => b.name).join(', ')}, in the same call`,
      draft: draftText,
      kit: partnerKit({
        name,
        category: deps.config.category,
        why: {
          text: `${name} fits this audience: fit ${fit}, lift ${round2(value)} over ${baseline.map((b) => b.name).join(', ')} in the same Qloo call.`,
          findingIds: [`f-partner-${slug(name)}`],
        },
        script: draftText,
        release: releaseDate(inputs.read.window),
        today: new Date().toISOString().slice(0, 10),
      }),
    };
    const lineReceipt: Receipt = {
      ...call,
      lineId: id,
      rule: `Fit is lift on a 0 to 100 scale: lift 1.2 is 50 and lift 1.5 is 75. Confidence ${lift.why}.`,
      confidence: lift.confidence,
    };
    const band = fitBand(fit);
    const headline =
      band === 'recommended'
        ? `${name} is a strong partner for this audience (fit ${fit}).`
        : band === 'usable'
          ? `${name} is a usable partner for this audience (fit ${fit}).`
          : `${name} is a weak fit for this audience (fit ${fit}).`;
    const moves: Move[] = [
      {
        text: `Review the draft, then send it to ${name} yourself. Oraqul never sends it.`,
        lineId: id,
      },
    ];
    const reply = writeReply(headline, moves, [lineReceipt], []);
    if (ungroundedLines({ ...onlyOwnLines(plan.brief), partners: [line] }, [lineReceipt]).length) {
      return done('error');
    }
    say(deps, reply.message, reply.claims);
    receipts.push(lineReceipt);
    return done('finished', {
      kind: 'partner',
      title: `Partner brief: ${name}`,
      brief: { ...plan.brief, partners: [line] },
      plan: null,
      report: null,
      headline,
      moves,
      confidence: {
        level: lift.confidence === 'lower' ? 'low' : lift.confidence,
        why: `${lift.why.charAt(0).toUpperCase()}${lift.why.slice(1)}.`,
      },
      inputs,
    });
  } catch (err) {
    return failed(deps, err, done);
  }
}

// The pitch, drafted by the writer from the partner's fit and the plan's findings, every line
// checked like a plan line. Null when no line survives, so the template is used. Never sent.
async function draftPitch<R extends LaunchRead>(
  handoff: Handoff,
  deps: FollowUpDeps<R> & { writer: PlanWriter<R> },
  plan: Output,
  inputs: LaunchInputs<R>,
  fit: Finding,
): Promise<string | null> {
  const findings = [fit, ...(plan.plan?.findings ?? [])];
  const written = await deps.writer.answer({
    title: handoff.title,
    read: inputs.read,
    question: `Draft a short pitch from the ${handoff.title} team to the ${fit.entities[0]?.name} team: a greeting line, two to four lines on why this audience and this partner fit, citing findings, a line asking for a call, and a sign-off. Each part is one line.`,
    plan:
      plan.plan?.sections.flatMap((s) => s.lines.map((l) => l.text)).join('\n') ?? plan.headline,
    chat: '',
    findings,
  });
  const ctx = {
    findings,
    sources: [],
    briefNames: [
      handoff.title,
      ...(fit.entities[0]?.name ? [fit.entities[0].name] : []),
      ...inputs.read.places,
      ...inputs.used.map((c) => c.name),
    ],
    briefText: briefText(handoff),
    teamCities: inputs.read.places,
    teamAges: inputs.read.ages,
    allowed: ['partnerships' as const],
    rules: deps.config.rules,
  };
  // The template writer answers with findings, not a letter, so its pitch is the fixed one.
  if (written.by === 'template') return null;
  const kept = written.lines.filter((l) => checkLine('partnerships', l, ctx) === null);
  return kept.some((l) => l.kind === 'grounded') ? kept.map((l) => l.text).join('\n\n') : null;
}

async function artistBrief<R extends LaunchRead>(
  handoff: Handoff,
  deps: FollowUpDeps<R> & { writer: PlanWriter<R> },
  plan: Output,
  inputs: LaunchInputs<R>,
  name: string,
  music: Finding,
  done: (reason: StopReason, output?: NewOutput | null) => PlanRun,
): Promise<PlanRun> {
  deps.emit({
    type: 'trace.step',
    agent: deps.config.category,
    step: 1,
    of: 2,
    text: `Reading what the plan found about ${name}`,
  });
  const place = music.entities.findIndex((e) => e.name.toLowerCase() === name.toLowerCase()) + 1;
  const city = music.context.city;
  deps.emit({
    type: 'trace.step',
    agent: deps.config.category,
    step: 2,
    of: 2,
    text: 'Drafting the brief',
  });
  const template = [
    `Hi ${name} team,`,
    `We are launching ${handoff.title}${city ? `, opening in ${city}` : ''}. Taste data from Qloo ranks ${name} among the artists our audience plays most${city ? ` in ${city}` : ''}.`,
    `We would love to talk about ${deps.config.words.artistPitch}. Could we set up a call?`,
    'Thanks,',
  ].join('\n\n');
  const draft = (await draftPitch(handoff, deps, plan, inputs, music)) ?? template;
  const id = `partner-${slug(name)}`;
  const line: Partner = {
    id,
    name,
    type: 'Artist',
    fits: city ? `The comps' audience in ${city}` : "The comps' audience",
    evidence: `Ranked ${place} of ${music.entities.length} in: ${music.text}`,
    draft,
    kit: partnerKit({
      name,
      category: deps.config.category,
      why: {
        text: `${name} ranks ${place} of ${music.entities.length} with this audience${city ? ` in ${city}` : ''}.`,
        findingIds: [music.id],
      },
      script: draft,
      release: releaseDate(inputs.read.window),
      today: new Date().toISOString().slice(0, 10),
    }),
  };
  const call = plan.receipts.find((r) => r.lineId === music.id);
  if (!call) return done('error');
  const headline = `${name} ranks ${place} of ${music.entities.length} with this audience${city ? ` in ${city}` : ''}.`;
  const moves: Move[] = [
    {
      text: `Review the draft, then send it to ${name} yourself. Oraqul never sends it.`,
      lineId: id,
    },
  ];
  say(deps, headline, [{ text: headline, receiptIds: [call.callId] }]);
  const own = collector(deps);
  own.receipts.push({ ...call, lineId: id, rule: `${music.text} ${call.rule}` });
  return {
    ...own.done('finished', {
      kind: 'partner',
      title: `Partner brief: ${name}`,
      brief: { ...plan.brief, partners: [line] },
      plan: null,
      report: null,
      headline,
      moves,
      confidence: {
        level: music.confidence === 'lower' ? 'low' : music.confidence,
        why: `${music.why.charAt(0).toUpperCase()}${music.why.slice(1)}.`,
      },
      inputs,
    }),
  };
}

function suggestedPartner(plan: Output): string | null {
  const brands = new Set(
    plan.plan?.findings
      .filter((f) => f.query === 'brands')
      .flatMap((f) => f.entities.map((e) => e.name)) ?? [],
  );
  const named = plan.plan?.sections
    .find((s) => s.key === 'partnerships')
    ?.lines.flatMap((l) => l.names)
    .find((n) => brands.has(n));
  return named ?? plan.brief.s2[0]?.name ?? null;
}

// A brief with the plan's lines taken out, so a check covers only what this run made.
function onlyOwnLines(brief: Brief): Brief {
  return {
    ...brief,
    assumptions: [],
    audience: [],
    s1: [],
    s2: [],
    s3: [],
    s4: [],
    places: [],
    dates: [],
    partners: [],
  };
}

function writeReply(
  headline: string,
  moves: Move[],
  lineReceipts: Receipt[],
  missing: string[],
): AgentReply {
  const claims: Claim[] = moves.flatMap((m) => {
    const r = lineReceipts.find((x) => x.lineId === m.lineId);
    return r ? [{ text: m.text, receiptIds: [r.callId] }] : [];
  });
  const lowest = [...lineReceipts].sort((a, b) => rank[a.confidence] - rank[b.confidence])[0];
  const message = [
    headline,
    ...moves.map((m) => m.text),
    missing.length ? `Not found in Qloo by name, so not checked: ${missing.join(', ')}.` : '',
    lowest?.source === 'demo' ? 'This run used demo data, not live Qloo.' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { message, claims };
}

function failed(
  deps: Pick<FollowUpDeps, 'emit'>,
  err: unknown,
  done: (r: StopReason) => PlanRun,
): PlanRun {
  if (err instanceof QlooBudgetError) {
    say(
      deps,
      'I stopped because the Qloo call budget for this run is spent, so nothing was saved.',
    );
    return done('budget');
  }
  if (err instanceof QlooError) {
    say(
      deps,
      `A Qloo call failed (${err.kind}), so this could not be checked. Try again in a moment.`,
    );
    return done('finished');
  }
  throw err;
}
