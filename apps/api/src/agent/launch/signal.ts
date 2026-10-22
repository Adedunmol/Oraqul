import { type Beat, type DatedBeat, datedBeats, rules } from '@oraqul/packs';
import { type Category, type LaunchLine, type LaunchSection, type Signal } from '@oraqul/schema';
import { releaseDate } from './text.js';

/** A plain line the code wrote itself. Playbook: it cites no finding and claims no taste. */
export const codeLine = (id: string, text: string, group: string | null = null): LaunchLine => ({
  id,
  kind: 'playbook',
  text,
  findingIds: [],
  sourceIds: [],
  names: [],
  group,
});

export const weeks = (at: number) =>
  at === 0 ? 'Launch week' : `T${at < 0 ? '-' : '+'}${Math.abs(at)}`;

/**
 * A calendar worked back from the release date, in code so no beat before today is advised.
 * With a release date each beat has dates; without one it has its weeks.
 */
export function beatsSection(
  title: string,
  beats: readonly Beat[],
  window: string | null,
  today: string,
): LaunchSection {
  const dated: DatedBeat[] = datedBeats(beats, releaseDate(window), today);
  if (dated.length === 0) {
    return {
      key: 'timeline',
      title,
      lines: [
        codeLine(
          'timeline-passed',
          'The release date has passed, so there are no launch beats left to plan. Send the results and run an audit to see what to change.',
        ),
      ],
    };
  }
  const lines = dated.map((b) => {
    const when = b.until === undefined ? weeks(b.at) : `${weeks(b.at)} to ${weeks(b.until)}`;
    const days =
      b.from && b.to ? (b.from === b.to ? ` (${b.from})` : ` (${b.from} to ${b.to})`) : '';
    return codeLine(`timeline-${b.key}`, `${when}${days}: ${b.text}`);
  });
  return { key: 'timeline', title, lines };
}

const MULTIPLIER: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6 };

// "target of 10,000 wishlists", "goal: 5k saves", "aiming for 20,000 downloads per episode".
const TARGET =
  /\b(?:target|goal|aim(?:ing|s)?(?: for)?)\b[^\d\n.]{0,20}(\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million)?\b\s*([a-z][a-z-]*(?: [a-z][a-z-]*){0,2})?/i;

const UNIT_STOP = new Set([
  'by',
  'in',
  'on',
  'at',
  'for',
  'and',
  'before',
  'after',
  'within',
  'with',
]);

/** The number the team set for the primary signal, in their own words. Null when they gave none. */
export function targetFrom(text: string): { value: number; unit: string | null } | null {
  const m = text.match(TARGET);
  if (!m?.[1]) return null;
  const value = Number(m[1].replaceAll(',', '')) * (MULTIPLIER[m[2]?.toLowerCase() ?? ''] ?? 1);
  if (!(value > 0)) return null;
  // The unit is the words after the number, up to the first joining word: "wishlists by launch".
  const words = (m[3] ?? '').split(' ').filter(Boolean);
  const stop = words.findIndex((w) => UNIT_STOP.has(w.toLowerCase()));
  const unit = (stop === -1 ? words : words.slice(0, stop)).join(' ').toLowerCase();
  return { value, unit: unit || null };
}

/** The one signal the plan is judged on, with the team's target or the library's benchmark. */
export function signalOf(category: Category, text: string): Signal {
  const lib = rules[category].signal;
  const rule = lib.value;
  const team = targetFrom(text);
  const target = team
    ? {
        value: team.value,
        floor: null,
        unit: team.unit ?? rule.primary.toLowerCase(),
        from: 'team' as const,
        ruleId: null,
      }
    : rule.benchmark
      ? { ...rule.benchmark, from: 'rule' as const, ruleId: lib.id }
      : null;
  return {
    key: rule.key,
    primary: rule.primary,
    secondary: rule.secondary,
    checkpoints: rule.checkpoints,
    target,
  };
}

const n = (value: number) => Math.round(value).toLocaleString('en-US');

function when(days: number[]): string {
  const join = (parts: string[]) => {
    const last = parts.pop();
    return parts.length ? `${parts.join(', ')} and ${last}` : (last ?? '');
  };
  const before = (d: number) => `${n(-d)} days before release`;
  const after = (d: number) => `day ${n(d)}`;
  if (days.every((d) => d < 0)) return `${join(days.map((d) => n(-d)))} days before release`;
  return join(days.map((d) => (d < 0 ? before(d) : after(d))));
}

/** What to measure: one primary signal, its target and when to read it, then the rest. */
export function measureSection(
  title: string,
  signal: Signal,
  alsoTrack: readonly string[],
): LaunchSection {
  const lines: LaunchLine[] = [
    codeLine('measure-primary', `Judge this plan on one signal: ${signal.primary.toLowerCase()}.`),
  ];
  if (signal.target) {
    const { value, floor, unit, from } = signal.target;
    lines.push(
      codeLine(
        'measure-target',
        from === 'team'
          ? `Your target is ${n(value)} ${unit}. It is the goal you set, not a forecast of what will happen.`
          : `A target to aim for: ${n(value)} ${unit}${floor === null ? '' : `, with ${n(floor)} as the floor`}. It comes from Oraqul's launch rules and is a target, not a forecast.`,
      ),
    );
  } else {
    lines.push(
      codeLine(
        'measure-target',
        'No target is set. Give your own number, such as “target 10,000”, and the plan will carry it.',
      ),
    );
  }
  lines.push(
    codeLine('measure-checkpoints', `Read it ${when(signal.checkpoints)}.`),
    codeLine(
      'measure-secondary',
      `${signal.secondary.join(', ')} are secondary: track them, but do not judge the plan on them.`,
    ),
  );
  for (const m of alsoTrack) {
    lines.push(
      codeLine(
        `measure-${m.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        `Also track ${m.toLowerCase()}.`,
      ),
    );
  }
  return { key: 'measure', title, lines };
}
