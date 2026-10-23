import { placeVerdict } from '@oraqul/engine';
import { SHOWS_PLAN_RULES } from '@oraqul/packs';
import type { Confidence, Direction, DirectionCall, Territory, Verdict } from '@oraqul/schema';
import { slug } from './brief.js';
import type { Clash, Rival } from './clash.js';

// A direction is the call on what to do, set by code from a value Qloo returned (hard rule 1).
// The model never sets one. Okay, risky and avoid are the edges of the verdict rules in spec §5.

/** A verdict on a decision, as the direction it points to. Could not test gives no call. */
export function directionOf(verdict: Verdict): Direction | null {
  switch (verdict) {
    case 'holds':
      return 'okay';
    case 'weak':
      return 'risky';
    case 'breaks':
      return 'avoid';
    default:
      return null;
  }
}

const BAND_DIRECTION = { low: 'okay', moderate: 'risky', high: 'avoid' } as const;
const RANK: Record<Direction, number> = { okay: 0, risky: 1, avoid: 2 };

/**
 * One call per opening day among the rivals the team named. A day is as risky as its riskiest
 * rival. The day the team plans to open on keeps its place: an avoid says how to handle it and
 * never tells the team to drop it.
 */
export function dateCalls(clash: Clash | null, release: string | null): DirectionCall[] {
  if (!clash || clash.lines.length === 0) return [];
  return [...new Set(clash.lines.map((l) => l.date))].sort().map((date) => {
    const onDay = clash.lines.filter((l) => l.date === date);
    const worst = [...onDay].sort((a, b) => b.overlap - a.overlap)[0];
    if (!worst) throw new Error('A day with rivals has a riskiest rival');
    const direction = BAND_DIRECTION[worst.band];
    const teamChoice = release === date;
    const say =
      direction === 'avoid'
        ? teamChoice
          ? ` Keep the date only with a campaign that sets the release apart${clash.chosen && clash.chosen !== date ? `, or move toward ${clash.chosen}` : ''}.`
          : ' Do not open that week.'
        : direction === 'risky'
          ? ' Possible, with a campaign that sets the release apart.'
          : ' Little shared audience.';
    return {
      id: `call-date-${date}`,
      subject: 'date' as const,
      name: date,
      direction,
      confidence: clash.confidence as Confidence,
      why: `${worst.rival} opens that week and shares ${Math.round(worst.overlap)} of your audience on a scale of 100.${say}`,
      findingIds: ['f-clash'],
      teamChoice,
      territory: null,
    };
  });
}

const DAY = 86_400_000;

/**
 * One call per rival show date (E6), set by how near the date is to the show's own and, where Qloo
 * scored the rival, by how much audience they share. A rival on the same night or in the same
 * week is flagged; one further away is okay. A rival Qloo could not score is still flagged when it
 * is that close, at the lowest confidence, because the date itself is the team's own. Direction
 * only, never a forecast. Without a show date there is nothing to be near.
 */
export function showDateCalls(
  clash: Clash | null,
  rivals: Rival[],
  show: string | null,
): DirectionCall[] {
  if (!show || rivals.length === 0) return [];
  const { sameNightDays, sameWeekDays } = SHOWS_PLAN_RULES.clash.value;
  const apart = (date: string) =>
    Math.abs(Date.parse(`${date}T00:00:00Z`) - Date.parse(`${show}T00:00:00Z`)) / DAY;
  return [...new Set(rivals.map((r) => r.date))].sort().map((date) => {
    const near = apart(date);
    const named = rivals.filter((r) => r.date === date).map((r) => r.title);
    const scored = (clash?.lines ?? []).filter((l) => l.date === date);
    const worst = [...scored].sort((a, b) => b.overlap - a.overlap)[0];
    const measured = worst ? BAND_DIRECTION[worst.band] : null;
    const sameNight = near <= sameNightDays;
    const sameWeek = near <= sameWeekDays;
    // On the same night even a small overlap is a risk; in the same week the overlap decides.
    const direction: Direction = !sameWeek
      ? 'okay'
      : measured
        ? sameNight && RANK[measured] < RANK.risky
          ? 'risky'
          : measured
        : 'risky';
    const when = sameNight
      ? 'on the same night'
      : sameWeek
        ? 'in the same week'
        : 'on another week';
    const why = !sameWeek
      ? `${named.join(' and ')} plays ${when}, so the two do not compete for the same night or week.`
      : worst
        ? `${worst.rival} plays ${when} and shares ${Math.round(worst.overlap)} of your audience on a scale of 100.${direction === 'avoid' ? ' Keep the date only with a campaign that sets the show apart, or move it.' : direction === 'risky' ? ' Possible, with a campaign that sets the show apart.' : ' Little shared audience.'}`
        : `${named.join(' and ')} plays ${when}. Qloo could not measure how much audience it shares, so treat it as a risk until you have checked.`;
    return {
      id: `call-date-${date}`,
      subject: 'date' as const,
      name: date,
      direction,
      confidence: (worst && clash ? clash.confidence : 'lower') as Confidence,
      why,
      findingIds: worst ? ['f-clash'] : [],
      teamChoice: date === show,
      territory: null,
    };
  });
}

/**
 * One call per territory on opening there, from the place's audience strength against an average
 * city in the same call. The cities are the team's, so a weak one keeps its place: its call says
 * to open it after the stronger ones.
 */
export function territoryCalls(
  territories: Territory[],
  ranked: {
    place: string;
    status: 'ranked' | 'not_ranked' | 'unknown_place';
    lift: number | null;
    cells: number;
    confidence: Confidence;
  }[],
  strongest: string | null,
): { territories: Territory[]; calls: DirectionCall[] } {
  const calls: DirectionCall[] = [];
  const out = territories.map((t) => {
    const row = ranked.find((r) => r.place.toLowerCase() === t.name.toLowerCase());
    if (!row) return t;
    const direction = directionOf(placeVerdict(row).verdict);
    if (!direction || row.lift === null) return t;
    const id = `call-territory-${slug(t.name)}`;
    const strength = row.lift.toFixed(1);
    const say =
      direction === 'avoid'
        ? ` Keep it, and open it after ${strongest && strongest !== t.name ? strongest : 'the stronger cities'}.`
        : direction === 'risky'
          ? ' A smaller audience than the rest: lead with the local angle.'
          : '';
    calls.push({
      id,
      subject: 'territory',
      name: t.name,
      direction,
      confidence: row.confidence,
      why: `Audience strength ${strength}, where 1.0 is an average city in the same ranking.${say}`,
      findingIds: ['f-markets'],
      teamChoice: true,
      territory: t.name,
    });
    return { ...t, callId: id };
  });
  return { territories: out, calls };
}

/** The worst call among several, for a summary line. */
export function worst(calls: DirectionCall[]): Direction | null {
  return calls.reduce<Direction | null>(
    (w, c) => (w === null || RANK[c.direction] > RANK[w] ? c.direction : w),
    null,
  );
}
