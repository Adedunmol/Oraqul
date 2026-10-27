import type {
  ActualEntry,
  LaunchPlan,
  Move,
  Output,
  OverallConfidence,
  PaceState,
  Receipt,
  Territory,
} from '@oraqul/schema';
import { type CheckContext, checkSections } from './check.js';
import type { LaunchConfig } from './config.js';
import type { FollowUpDeps } from './follow-ups.js';
import type { LaunchInputs, PlanRun } from './pipeline.js';
import type { LaunchRead } from './read-core.js';
import type { WrittenLine, WrittenSection } from './writer.js';

// A rescue: what to shift effort to for the next seven days, once the team's own figures say the
// launch is behind its pace (spec §5.19). Code picks the territory and the channel from the plan's
// own calls and the figures; it asks Qloo for nothing new, so it is cheap and can be run again.
// Every line passes the same check as a plan line, and nothing here says what will happen.

export const RESCUE_SECTIONS = ['bottom-line', 'markets', 'measure'] as const;

const city = (name: string) => name.trim().toLowerCase();

export interface RescuePick {
  territory: Territory;
  channel: string;
  /** Why this territory: the figures put the least in a place the audience data favours, or it leads. */
  why: 'figures' | 'lead';
  /** What the figures hold for the territory, when they have a city for it. */
  held: number | null;
  total: number | null;
}

/**
 * The territory to concentrate on. Where the figures name at least two of the plan's territories,
 * it is the one the plan's own call favours (okay) that holds the least so far: effort there is
 * under applied. Otherwise it is the first territory the call favours, or the home market.
 */
export function rescuePick(plan: LaunchPlan, entries: ActualEntry[]): RescuePick | null {
  const territories = [...plan.territories].sort((a, b) => a.order - b.order);
  const first = territories[0];
  if (!first) return null;
  const favoured = (t: Territory) =>
    plan.calls.find((c) => c.id === t.callId)?.direction === 'okay';

  const totals = new Map<string, number>();
  for (const e of entries) {
    if (e.city) totals.set(city(e.city), (totals.get(city(e.city)) ?? 0) + e.value);
  }
  const measured = territories.filter((t) => totals.has(city(t.name)));
  const channelOf = (t: Territory) =>
    t.channels.find((c) => c.lead)?.name ?? t.channels[0]?.name ?? 'its lead channel';

  if (measured.length >= 2) {
    const sum = measured.reduce((n, t) => n + (totals.get(city(t.name)) ?? 0), 0);
    const candidates = measured.filter(favoured);
    const least = [...candidates].sort(
      (a, b) => (totals.get(city(a.name)) ?? 0) - (totals.get(city(b.name)) ?? 0),
    )[0];
    if (least) {
      return {
        territory: least,
        channel: channelOf(least),
        why: 'figures',
        held: totals.get(city(least.name)) ?? 0,
        total: sum,
      };
    }
  }
  const lead = territories.find(favoured) ?? first;
  return { territory: lead, channel: channelOf(lead), why: 'lead', held: null, total: null };
}

const line = (over: Partial<WrittenLine> & Pick<WrittenLine, 'kind' | 'text'>): WrittenLine => ({
  findingIds: [],
  sourceIds: [],
  names: [],
  group: null,
  ...over,
});

/** Saved as an output of kind `rescue`, a narrow plan whose parent is the plan it rescues. */
export async function runRescue<R extends LaunchRead>(
  deps: Pick<FollowUpDeps<R>, 'emit' | 'config'>,
  plan: Output,
  inputs: LaunchInputs<R>,
  pace: PaceState | null,
  title: string,
): Promise<PlanRun> {
  const source = plan.plan;
  const config: LaunchConfig<R> = deps.config;
  const finish = (body: string): PlanRun => {
    deps.emit({ type: 'message', body, claims: [] });
    return { reason: 'finished', state: null, receipts: [], output: null, tokens: 0 };
  };
  if (!source) return finish('A rescue is written for a launch plan, and this output is not one.');
  if (!pace?.available || !pace.result || pace.result.verdict !== 'behind') {
    return finish(
      pace?.result
        ? `Your figures are ${pace.result.verdict === 'too-early' ? 'too early to tell' : pace.result.verdict.replace('-', ' ')} against the plan's pace, so there is nothing to rescue. Add or update your figures on the Watch tab and ask again when they are behind.`
        : 'There are no figures for this plan yet, so there is nothing to rescue. Add them on the Watch tab and ask again when they are behind.',
    );
  }
  const pick = rescuePick(source, pace.entries);
  if (!pick)
    return finish(
      'This plan has no territory to put the effort into, so I cannot name where to shift.',
    );
  const { territory, channel } = pick;
  const result = pace.result;

  deps.emit({
    type: 'trace.step',
    agent: config.category,
    step: 1,
    of: 1,
    text: `Choosing where to put the next seven days in ${territory.name}`,
  });

  const call = source.calls.find((c) => c.id === territory.callId);
  const territoryLines =
    source.sections
      .find((s) => s.key === 'markets')
      ?.lines.filter((l) => territory.lineIds.includes(l.id) && l.kind === 'grounded')
      .slice(0, 2) ?? [];

  const bottom: WrittenLine[] = [
    line({
      kind: 'playbook',
      text: `For the next seven days, put the effort into ${territory.name} on ${channel}.`,
      names: [territory.name],
    }),
    pick.why === 'figures' && pick.held !== null && pick.total !== null
      ? line({
          kind: 'playbook',
          text: `Your figures put ${territory.name} at ${pick.held} of ${pick.total} so far, the least of your cities, and it is one the audience data favours.`,
          names: [territory.name],
        })
      : call?.findingIds.length
        ? line({
            kind: 'grounded',
            text: `${territory.name} is where the audience data points to opening strongest, so concentrate there while the figures are behind.`,
            findingIds: call.findingIds,
            names: [territory.name],
          })
        : line({
            kind: 'playbook',
            text: `${territory.name} is the market the plan leads with, so concentrate there first.`,
            names: [territory.name],
          }),
    line({
      kind: 'playbook',
      text: 'Read the figures again in seven days and compare them with the plan’s pace before moving effort again.',
    }),
  ];
  const markets: WrittenLine[] = [
    ...territoryLines.map((l) =>
      line({
        kind: 'grounded',
        text: l.text,
        findingIds: l.findingIds,
        sourceIds: l.sourceIds,
        names: l.names,
      }),
    ),
    line({
      kind: 'playbook',
      text: `Lead with ${channel}, the channel the plan puts first for ${territory.name}.`,
      names: [territory.name, channel],
    }),
  ];
  const measure: WrittenLine[] = [
    line({
      kind: 'playbook',
      text: `Add your ${source.signal?.primary ?? 'figures'} for ${territory.name} every day this week so the next check can say whether the shift helped.`,
      names: [territory.name],
    }),
  ];
  const written: WrittenSection[] = [
    { key: 'bottom-line', lines: bottom },
    { key: 'markets', lines: markets },
    { key: 'measure', lines: measure },
  ];

  const figures = pace.entries.map((e) => `${e.city} ${e.value}`).join(' ');
  const ctx: CheckContext = {
    rules: config.rules,
    findings: source.findings,
    sources: [],
    briefNames: [
      title,
      ...inputs.read.places,
      ...source.territories.map((t) => t.name),
      ...source.territories.flatMap((t) => t.channels.map((c) => c.name)),
    ],
    briefText: `${figures} ${pick.held ?? ''} ${pick.total ?? ''}`,
    teamCities: inputs.read.places,
    teamAges: inputs.read.ages,
    allowed: [...RESCUE_SECTIONS],
  };
  const { sections, dropped } = checkSections(written, ctx);
  const lines = sections.flatMap((s) => s.lines);
  const cited = new Set(lines.flatMap((l) => l.findingIds));
  const findings = source.findings.filter((f) => cited.has(f.id));
  const receipts: Receipt[] = lines.flatMap((l) => {
    const f = findings.find((x) => x.id === l.findingIds[0]);
    const made = f && plan.receipts.find((r) => f.callIds.includes(r.callId));
    return made ? [{ ...made, lineId: l.id, rule: f?.why ? `${f.why}.` : made.rule }] : [];
  });

  const rescue: LaunchPlan = {
    ...source,
    scope: 'narrow',
    sections,
    findings,
    sources: [],
    dropped,
    writer: 'template',
    understanding: null,
    review: null,
    process: null,
    signal: null,
    territories: [],
    calls: [],
    partners: [],
    calendar: [],
  };
  const short = Math.abs(result.gap ?? 0);
  const headline = `Figures through ${result.asOf} are ${short} ${result.unit} behind the plan's pace. For the next seven days, concentrate on ${territory.name} on ${channel}.`;
  const moves: Move[] = [
    { text: `Concentrate the effort on ${territory.name} on ${channel}.`, lineId: null },
    {
      text: 'Add your figures every day so the next check can say whether it helped.',
      lineId: null,
    },
  ];
  const confidence: OverallConfidence = findings.length
    ? {
        level: findings.some((f) => f.confidence === 'lower') ? 'low' : 'medium',
        why: 'The place comes from Qloo; the rest is the plan and your own figures.',
      }
    : { level: 'medium', why: 'Built from the plan and your own figures, with no new Qloo claim.' };

  deps.emit({ type: 'message', body: headline, claims: [] });
  return {
    reason: 'finished',
    state: null,
    receipts,
    output: {
      kind: 'rescue',
      title: `Rescue: ${territory.name} · ${channel}`,
      brief: plan.brief,
      plan: rescue,
      report: null,
      headline,
      moves,
      confidence,
      inputs,
    },
    tokens: 0,
  };
}
