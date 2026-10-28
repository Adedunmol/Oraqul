import { WATCH_RULES } from '@oraqul/packs';
import type { PaceResult, WatchEventType, WatchEvidence, WatchSeverity } from '@oraqul/schema';
import { daysBetween } from '../agent/launch/pace.js';
import type { VerifiedRival } from './rival-dates.js';

// What a launch watch raises, decided in code from checked fields. The text of every event is a
// template over those fields: the model never writes one, and nothing here asks Qloo.

export interface DraftEvent {
  type: WatchEventType;
  severity: WatchSeverity;
  /** One event per cause: a later check that finds the same thing adds nothing. */
  dedupeKey: string;
  title: string;
  reason: string;
  evidence: WatchEvidence[];
}

export const SEVERITY_RANK: Record<WatchSeverity, number> = { info: 0, watch: 1, act: 2 };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The ISO week of a day, so a recurring event is raised once a week and not on every check. */
export function isoWeek(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const weekday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - weekday + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      (d.getTime() -
        firstThursday.getTime() -
        3 * 864e5 +
        ((firstThursday.getUTCDay() + 6) % 7) * 864e5) /
        (7 * 864e5),
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function rivalSeverity(daysApart: number): WatchSeverity {
  const gap = Math.abs(daysApart);
  if (gap <= WATCH_RULES.rivalSameWeekendDays.value) return 'act';
  if (gap <= WATCH_RULES.rivalWindowDays.value) return 'watch';
  return 'info';
}

export function rivalEvents(
  rivals: VerifiedRival[],
  release: string,
  alreadyKnown: string[],
): DraftEvent[] {
  const known = new Set(alreadyKnown.map((t) => t.trim().toLowerCase()));
  return rivals
    .filter((r) => !known.has(r.title.trim().toLowerCase()))
    .map((r) => {
      const apart = daysBetween(release, r.date);
      const where =
        apart === 0
          ? 'on the same day as'
          : `${plural(Math.abs(apart), 'day')} ${apart < 0 ? 'before' : 'after'}`;
      return {
        type: 'rival_date' as const,
        severity: rivalSeverity(apart),
        dedupeKey: `rival:${r.title.trim().toLowerCase()}:${r.date}`,
        title: `${r.title} opens ${r.date}`,
        reason: `A page says ${r.title} opens on ${r.date}, ${where} your release on ${release}. This date is from the web, read on ${r.evidence.retrievedAt}, not from Qloo: confirm it on the page.`,
        evidence: [r.evidence],
      };
    });
}

export interface MilestoneRow {
  id: string;
  title: string;
  startsOn: string | null;
  endsOn: string | null;
  status: 'todo' | 'doing' | 'done';
}

export function milestoneEvents(rows: MilestoneRow[], today: string): DraftEvent[] {
  return rows.flatMap((r) => {
    const due = r.endsOn ?? r.startsOn;
    if (r.status === 'done' || !due || due >= today) return [];
    const late = daysBetween(due, today);
    const severity: WatchSeverity =
      late >= WATCH_RULES.milestoneActAfterDays.value ? 'act' : 'watch';
    return [
      {
        type: 'milestone_overdue' as const,
        severity,
        dedupeKey: `milestone:${r.id}:${severity}`,
        title: `Overdue: ${r.title}`,
        reason: `This action was due ${due}, ${plural(late, 'day')} ago, and is not marked done.`,
        evidence: [],
      },
    ];
  });
}

export function staleEvent(
  planMadeOn: string,
  hasNewerRefresh: boolean,
  today: string,
): DraftEvent | null {
  const age = daysBetween(planMadeOn, today);
  if (hasNewerRefresh || age < WATCH_RULES.staleDays.value) return null;
  return {
    type: 'plan_stale',
    severity: 'act',
    dedupeKey: `stale:${isoWeek(today)}`,
    title: `This plan is ${plural(age, 'day')} old`,
    reason: `The plan was made on ${planMadeOn}. Checking what has changed asks Qloo and the web again, so it runs only when you approve it.`,
    evidence: [],
  };
}

export interface PipelineRow {
  id: string;
  kind: 'sponsor' | 'fund';
  name: string;
  status: string;
  nextFollowUpOn: string | null;
  deadline: string | null;
  source: { url: string; title: string; retrievedAt: string } | null;
}

const OPEN = ['found', 'qualified', 'drafted', 'approved'];

/** A fund closing soon that is still being worked, and a follow up that is due. */
export function pipelineEvents(rows: PipelineRow[], today: string): DraftEvent[] {
  const out: DraftEvent[] = [];
  for (const r of rows) {
    if (r.kind === 'fund' && r.deadline && OPEN.includes(r.status)) {
      const days = daysBetween(today, r.deadline);
      if (days >= 0 && days <= WATCH_RULES.deadlineSoonDays.value) {
        const severity: WatchSeverity =
          days <= WATCH_RULES.milestoneActAfterDays.value ? 'act' : 'watch';
        out.push({
          type: 'deadline_soon',
          severity,
          dedupeKey: `deadline:${r.id}:${severity}`,
          title: `${r.name} closes ${r.deadline}`,
          reason: `The published deadline for ${r.name} is ${r.deadline}, ${plural(days, 'day')} away. Terms change: confirm it on the source page.`,
          evidence: r.source ? [{ ...r.source, quote: null }] : [],
        });
      }
    }
    if (
      r.nextFollowUpOn &&
      r.nextFollowUpOn <= today &&
      ['sent_by_you', 'replied', 'approved'].includes(r.status)
    ) {
      out.push({
        type: 'follow_up_due',
        severity: 'watch',
        dedupeKey: `follow:${r.id}:${r.nextFollowUpOn}`,
        title: `Follow up with ${r.name}`,
        reason: `You planned to follow up with ${r.name} on ${r.nextFollowUpOn}.`,
        evidence: [],
      });
    }
  }
  return out;
}

export function paceEvent(result: PaceResult | null): DraftEvent | null {
  if (!result || result.verdict !== 'behind' || result.gap === null || result.gapPoints === null) {
    return null;
  }
  const short = Math.abs(result.gap);
  return {
    type: 'pace_behind',
    severity: 'act',
    dedupeKey: `pace:${result.asOf ?? 'none'}`,
    title: 'Figures are behind the plan’s pace',
    reason: `Through ${result.asOf}, the figures are ${short} ${result.unit} (${Math.abs(result.gapPoints)} points of the target) behind where the plan’s convention puts them, from ${plural(result.entries, 'entry')}. This is direction, not a forecast.`,
    evidence: [],
  };
}
