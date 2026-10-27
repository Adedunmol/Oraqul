import { PACE_THRESHOLDS } from '@oraqul/packs';
import type { CurvePoint, PaceResult, PaceSettings } from '@oraqul/schema';

// Direction against a convention, in code (launch rules D2 and D5). The team's own figures are set
// against the share of the target a plan would have by now. It says ahead, on pace, behind or too
// early to tell, with the gap. It never projects where the figures will end up.

const DAY_MS = 24 * 60 * 60 * 1000;
const round1 = (n: number) => Math.round(n * 10) / 10;

export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

export interface PaceEntry {
  onDate: string;
  value: number;
  city: string;
  channel: string;
}

export interface PaceInput {
  settings: PaceSettings;
  /** Days from release when the plan reads its signal. */
  checkpoints: number[];
  releaseDate: string | null;
  entries: PaceEntry[];
  today: string;
}

/** Expected share of the target on a day from release: straight lines between the curve's points. */
export function expectedShare(curve: CurvePoint[], day: number): number {
  const points = [...curve].sort((a, b) => a.day - b.day);
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return 0;
  if (day <= first.day) return first.share;
  if (day >= last.day) return last.share;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b && day <= b.day) {
      return a.share + ((b.share - a.share) * (day - a.day)) / (b.day - a.day);
    }
  }
  return last.share;
}

const key = (e: PaceEntry) => `${e.city}\u0000${e.channel}`;

/** The latest figure from each city and channel. */
function latestByGroup(entries: PaceEntry[]): number[] {
  const latest = new Map<string, PaceEntry>();
  for (const e of entries) {
    const held = latest.get(key(e));
    if (!held || e.onDate > held.onDate) latest.set(key(e), e);
  }
  return [...latest.values()].map((e) => e.value);
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const NOTE =
  'This is direction against a convention, not a forecast: it says where the figures stand now and nothing about where they will end up.';

export function paceOf(input: PaceInput): PaceResult {
  const { settings, today, releaseDate } = input;
  const entries = input.entries.filter((e) => e.onDate <= today);
  const dates = [...new Set(entries.map((e) => e.onDate))].sort();
  const days = dates.length > 1 ? daysBetween(dates[0] ?? today, dates.at(-1) ?? today) : 0;
  const daysToRelease = releaseDate ? daysBetween(today, releaseDate) : null;
  const asOf = dates.at(-1) ?? null;

  const actual = entries.length
    ? settings.kind === 'level'
      ? sum(latestByGroup(entries)) / latestByGroup(entries).length
      : settings.entry === 'running-total'
        ? sum(latestByGroup(entries))
        : sum(entries.map((e) => e.value))
    : null;

  const early = (reason: PaceResult['reason'], expected: number | null = null): PaceResult => ({
    verdict: 'too-early',
    reason,
    target: settings.target,
    unit: settings.unit,
    actual,
    expected,
    gap: null,
    gapPoints: null,
    entries: dates.length,
    days,
    asOf,
    daysToRelease,
    note: NOTE,
  });

  if (settings.target === null) return early('no-target');
  if (entries.length === 0) return early('no-entries');
  if (!releaseDate || daysToRelease === null) return early('no-release-date');
  if (dates.length < PACE_THRESHOLDS.minEntries) return early('few-entries');

  const fromRelease = -daysToRelease;
  let expected: number;
  if (settings.kind === 'level') {
    const first = Math.min(...input.checkpoints);
    if (!Number.isFinite(first) || fromRelease < first) return early('before-first-checkpoint');
    expected = settings.target;
  } else {
    const share = expectedShare(settings.curve, fromRelease);
    if (share < PACE_THRESHOLDS.minExpectedShare)
      return early('low-expected', share * settings.target);
    expected = share * settings.target;
  }

  const ratio = (actual ?? 0) / expected;
  const verdict =
    ratio >= PACE_THRESHOLDS.aheadAt
      ? 'ahead'
      : ratio < PACE_THRESHOLDS.behindBelow
        ? 'behind'
        : 'on-pace';
  const gap = (actual ?? 0) - expected;
  return {
    verdict,
    reason: null,
    target: settings.target,
    unit: settings.unit,
    actual: round1(actual ?? 0),
    expected: round1(expected),
    gap: round1(gap),
    gapPoints: round1((gap / settings.target) * 100),
    entries: dates.length,
    days,
    asOf,
    daysToRelease,
    note: NOTE,
  };
}
