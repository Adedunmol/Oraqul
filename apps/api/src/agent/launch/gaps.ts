import type { Untested } from '@oraqul/schema';

/** Something that was not asked, or came back empty. `ask` is given only where a site knows better. */
export interface Gap {
  item: string;
  why: string;
  /** What the person can give or do about it, when this gap has a specific answer. */
  ask?: string;
}

// The reasons below are written by code, so the wording is stable enough to tell apart.
const FAILED = /\b(call failed|budget|ran out|did not answer|timed out)\b/i;
const INPUT = /\b(gives? no|no show date|supply|you may need|not given)\b/i;

/**
 * Every gap leaves the pipeline with a way forward, so a dead end cannot reach a plan: where the
 * site gave none, the next step follows from why it happened. A call that failed can be run
 * again; anything else is helped by a detail or a comparable title.
 */
export function describeGap(gap: Gap): Pick<Untested, 'cantKind' | 'ask'> {
  if (FAILED.test(gap.why)) {
    return { cantKind: 'failed', ask: gap.ask ?? 'Run it again to fill this in.' };
  }
  if (INPUT.test(gap.why)) {
    return {
      cantKind: 'input',
      ask: gap.ask ?? 'Add that detail and I will test it.',
    };
  }
  return {
    cantKind: 'no-signal',
    ask: gap.ask ?? 'Tell me more about it, or name a close title, and I will look again.',
  };
}

export function gapsAsUntested(gaps: Gap[]): Untested[] {
  return gaps.map((g, i) => ({
    id: `cant-q-${i + 1}`,
    item: g.item,
    reason: g.why,
    ...describeGap(g),
  }));
}
