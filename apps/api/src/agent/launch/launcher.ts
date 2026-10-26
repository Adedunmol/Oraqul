import type { LauncherKind } from '@oraqul/schema';

// Who is launching decides which partners are realistic beside the budget (partnerships.md). It is
// read from the brief's own words, never guessed: a brief that says nothing gives null.

const WORDS: Record<LauncherKind, RegExp> = {
  solo: /\b(?:solo (?:author|writer|developer|creator|founder|filmmaker|launch|studio)|self[- ]?publish\w*|self[- ]?releas\w*|unsigned|one[- ]person|just me|first[- ]time (?:author|writer|filmmaker|director)|independent (?:author|artist|musician|writer))\b/i,
  small:
    /\b(?:small (?:team|studio|label|press|publisher|company|production)|indie (?:studio|label|press|developer|production)|independent (?:studio|label|press|publisher|developer|production|filmmaker|team))\b/i,
  established:
    /\b(?:established (?:studio|label|publisher|press|company|team|network)|mid[- ]?size[d]? (?:studio|label|publisher|company))\b/i,
  major:
    /\b(?:major (?:studio|label|publisher|network|platform)|big (?:five|5)|top (?:studio|label|publisher))\b/i,
};

const LINE = /\bwho is launching\s*:\s*([^\n]+)/i;

const NAMED: [LauncherKind, RegExp][] = [
  ['solo', /\bsolo\b/i],
  ['small', /\bsmall\b/i],
  ['established', /\bestablished\b/i],
  ['major', /\bmajor\b/i],
];

/**
 * Who is launching, from a "Who is launching:" line the Guide writes, else from plain words in the
 * brief. A line wins over words, and the smallest reading wins among words, so "a self-published
 * author at a small press" is still treated as solo. Null when the brief says nothing.
 */
export function launcherOf(text: string): LauncherKind | null {
  const given = text.match(LINE)?.[1] ?? '';
  if (given) {
    const named = NAMED.find(([, re]) => re.test(given));
    if (named) return named[0];
  }
  const order: LauncherKind[] = ['solo', 'small', 'established', 'major'];
  return order.find((kind) => WORDS[kind].test(text)) ?? null;
}
