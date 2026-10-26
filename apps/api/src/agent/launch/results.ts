import { audienceIndex } from '@oraqul/engine';
import type { Finding, LaunchResults, ResultGap, ResultsComparison } from '@oraqul/schema';
import { normalise } from '../router/decide.js';
import { round2, slug } from './brief.js';
import { type AgeBand, bandsBetween } from './read-core.js';

// Spec §5.3. A city that finished this many places below where the plan put it under delivered, and
// so did one that moved down at all while drawing under half the average city's share. The same
// holds upward with one and a half times the average. Starting values, tuned on the golden runs;
// change them in the spec first.
const GAP_PLACES = 2;
const UNDER_SHARE = 0.5;
const OVER_SHARE = 1.5;
// A city the plan did not name is worth a look when it finished in the top few.
const SURPRISE_RANK = 3;

const same = (a: string, b: string) => normalise(a) === normalise(b);

/** The Qloo age bands a written group such as “18 to 24”, “under 25” or “55+” covers. */
export function bandsOfLabel(label: string): AgeBand[] {
  const range = label.match(/(\d{2})\s*(?:to|-|–)\s*(\d{2})/i);
  if (range?.[1] && range[2]) return bandsBetween(Number(range[1]), Number(range[2]));
  const under = label.match(/\bunder\s*(\d{2})/i);
  if (under?.[1]) return bandsBetween(0, Number(under[1]) - 1);
  const over = label.match(/\bover\s*(\d{2})|(\d{2})\s*\+/i);
  const from = over?.[1] ?? over?.[2];
  return from ? bandsBetween(Number(from) + 1, 200) : [];
}

/**
 * Compares what a launch produced with what the plan expected (spec §5.3). The shares, ranks and
 * gaps are arithmetic on the figures the person gave; Qloo's lift and index are attached from the
 * audit's own findings. Nothing here goes to Qloo or to a model (hard rules 1 and 7).
 *
 * `planned` is the plan's cities in the order it put them.
 */
export function compareResults(input: {
  planned: string[];
  results: LaunchResults;
  findings: Finding[];
  /** The audit's average affinity per Qloo age band. */
  ages: Record<string, number>;
}): ResultsComparison {
  const { planned, results, findings } = input;
  const total = results.byPlace.reduce((sum, p) => sum + p.value, 0);
  const lifts = findings.find((f) => f.id === 'f-markets')?.numbers ?? {};
  const byValue = [...results.byPlace].sort(
    (a, b) =>
      b.value - a.value ||
      planned.findIndex((p) => same(p, a.place)) - planned.findIndex((p) => same(p, b.place)),
  );
  const rows = byValue.map((p, i) => {
    const at = planned.findIndex((q) => same(q, p.place));
    const plannedRank = at === -1 ? null : at + 1;
    const actualRank = i + 1;
    const lift = lifts[`lift ${p.place}`];
    return {
      place: p.place,
      actualShare: total > 0 ? round1((p.value / total) * 100) : 0,
      plannedRank,
      actualRank,
      lift: lift === undefined ? null : round2(lift),
      gap: gapOf(plannedRank, actualRank, total > 0 ? p.value / (total / byValue.length) : 1),
    };
  });

  const byAge = results.byAge;
  const ageTotal = byAge?.reduce((sum, a) => sum + a.value, 0) ?? 0;
  const ages = byAge
    ? byAge.map((a) => {
        const bands = bandsOfLabel(a.band).filter((b) => input.ages[b] !== undefined);
        const mean = bands.length
          ? bands.reduce((sum, b) => sum + (input.ages[b] ?? 0), 0) / bands.length
          : null;
        return {
          band: a.band,
          actualShare: ageTotal > 0 ? round1((a.value / ageTotal) * 100) : 0,
          index: mean === null ? null : audienceIndex(mean),
        };
      })
    : null;

  // The belief the results contradict most: the city furthest below its planned place.
  const worst = rows
    .filter((r) => r.gap === 'under' && r.plannedRank !== null)
    .sort(
      (a, b) =>
        b.actualRank - (b.plannedRank ?? 0) - (a.actualRank - (a.plannedRank ?? 0)) ||
        (a.plannedRank ?? 0) - (b.plannedRank ?? 0),
    )[0];
  return {
    asOf: results.asOf,
    source: results.source,
    measure: results.measure,
    rows,
    ages,
    brokeItemId: worst ? `a-place-${slug(worst.place)}` : null,
  };
}

/** `weight` is the city's result over the average city's, so 1 is an average city. */
function gapOf(plannedRank: number | null, actualRank: number, weight: number): ResultGap {
  if (plannedRank === null) return actualRank <= SURPRISE_RANK ? 'over' : 'as-planned';
  if (actualRank - plannedRank >= GAP_PLACES) return 'under';
  if (plannedRank - actualRank >= GAP_PLACES) return 'over';
  if (actualRank > plannedRank && weight < UNDER_SHARE) return 'under';
  if (actualRank < plannedRank && weight > OVER_SHARE) return 'over';
  return 'as-planned';
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
