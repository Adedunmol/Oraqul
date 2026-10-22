import type { Understanding } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { feedbackLines, judge } from './review.js';

const understanding: Understanding = {
  asked: 'A launch plan.',
  goals: [],
  constraints: [],
  assumed: [],
  criteria: [
    {
      id: 'c1',
      text: 'Says which city to open in',
      evidence: true,
      status: 'covered',
      findingIds: [],
    },
  ],
  by: 'model',
};
const unrun = [{ key: 'podcasts', for: 'publicity', label: 'podcasts' }];
const raw = (issues: Parameters<typeof judge>[0]['issues'], next: string[] = []) => ({
  issues,
  next,
});
const issue = (over = {}) => ({
  check: 'c1',
  type: 'missing' as const,
  text: 'No city named.',
  fix: 'Name one.',
  blocking: true,
  query: null,
  section: null,
  ask: null,
  ...over,
});

describe('judge ask', () => {
  it('takes the question from the first blocking issue that has one, else the first that has one', () => {
    const both = judge(
      raw([
        issue({ blocking: false, ask: 'Which date?' }),
        issue({ check: 'c1', blocking: true, ask: 'Which city first?' }),
      ]),
      understanding,
      unrun,
    );
    expect(both.ask).toBe('Which city first?');
    const soft = judge(raw([issue({ blocking: false, ask: 'Which date?' })]), understanding, unrun);
    expect(soft.ask).toBe('Which date?');
    expect(judge(raw([issue()]), understanding, unrun).ask).toBeNull();
  });
});

describe('judge', () => {
  it('passes only when no issue blocks', () => {
    expect(judge(raw([issue({ blocking: false })]), understanding, unrun).passed).toBe(true);
    expect(judge(raw([issue()]), understanding, unrun).passed).toBe(false);
    expect(judge(raw([]), understanding, unrun).passed).toBe(true);
  });

  it('files an issue about an unknown check under general', () => {
    expect(judge(raw([issue({ check: 'c9' })]), understanding, unrun).issues[0]?.check).toBe(
      'general',
    );
  });

  it('asks for research only with a query that is on the unrun list, once each', () => {
    const verdict = judge(
      raw([
        issue({ query: 'podcasts' }),
        issue({ query: 'podcasts' }),
        issue({ query: 'invented' }),
      ]),
      understanding,
      unrun,
    );
    expect(verdict.research.map((r) => r.query)).toEqual(['podcasts']);
  });
});

describe('judge: sections code writes', () => {
  it('turns an issue about a code section into a next step and does not block on it', () => {
    const verdict = judge(
      raw([issue({ section: 'timeline', fix: 'Say weekly from day one.' })], ['Add a date']),
      understanding,
      unrun,
      ['timeline', 'budget'],
    );
    expect(verdict.passed).toBe(true);
    expect(verdict.issues[0]?.blocking).toBe(false);
    expect(verdict.next).toEqual(['Add a date', 'Say weekly from day one.']);
  });
});

describe('feedbackLines', () => {
  it('lists the issues first, then the lines the check removed', () => {
    const lines = feedbackLines(
      [{ text: 'Lagos loves jollof', why: 'no finding backs it' }],
      judge(raw([issue()]), understanding, unrun).issues,
    );
    expect(lines[0]).toBe('missing (c1): No city named. Fix: Name one.');
    expect(lines[1]).toBe('Line removed because no finding backs it: "Lagos loves jollof"');
  });
});
