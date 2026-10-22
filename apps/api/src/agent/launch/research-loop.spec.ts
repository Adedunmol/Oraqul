import type { Finding, Understanding } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { evidenceBlock } from './evidence.js';
import { applyAssessment, applyRound2, MIN_CALLS_LEFT } from './research-loop.js';

const finding = (
  id: string,
  query: string,
  confidence: Finding['confidence'],
  affinity = 0,
): Finding => ({
  id,
  query,
  text: `${id} text`,
  numbers: {},
  entities: [{ entityId: null, name: 'Name', affinity, detail: null }],
  verdict: null,
  confidence,
  why: '',
  context: { city: null, ages: [], tags: [], country: null, yearFrom: null, audience: null },
  callIds: [],
});

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
      status: 'unchecked',
      findingIds: [],
    },
    { id: 'c2', text: 'Names press angles', evidence: true, status: 'unchecked', findingIds: [] },
  ],
  by: 'model',
};
const unrun = [{ key: 'podcasts', for: 'publicity', label: 'the podcasts that audience hears' }];

describe('applyAssessment', () => {
  const findings = [finding('f-a', 'audience', 'high', 80), finding('f-b', 'markets', 'lower')];

  it('trusts a coverage claim only when a real finding above low confidence backs it', () => {
    const { understanding: u } = applyAssessment(
      understanding,
      findings,
      {
        checks: [
          { id: 'c1', status: 'covered', findingIds: ['f-b', 'f-made-up'] },
          { id: 'c2', status: 'covered', findingIds: ['f-made-up'] },
        ],
        extra: [],
      },
      unrun,
      50,
    );
    expect(u.criteria.map((c) => [c.status, c.findingIds])).toEqual([
      ['thin', ['f-b']],
      ['missing', []],
    ]);
  });

  it('puts the strongest finding first for a check', () => {
    const { understanding: u } = applyAssessment(
      understanding,
      findings,
      { checks: [{ id: 'c1', status: 'covered', findingIds: ['f-b', 'f-a'] }], extra: [] },
      unrun,
      50,
    );
    expect(u.criteria[0]?.findingIds).toEqual(['f-a', 'f-b']);
  });

  it('keeps only queries on the unrun list, once each, and none when the budget is short', () => {
    const assessment = {
      checks: [],
      extra: [
        { query: 'podcasts', check: 'c2', why: 'a' },
        { query: 'podcasts', check: 'c2', why: 'b' },
        { query: 'invented', check: 'c2', why: 'c' },
      ],
    };
    expect(applyAssessment(understanding, findings, assessment, unrun, 50).extra).toHaveLength(1);
    expect(
      applyAssessment(understanding, findings, assessment, unrun, MIN_CALLS_LEFT - 1).extra,
    ).toEqual([]);
  });

  it('makes no claim with no assessment', () => {
    const out = applyAssessment(understanding, findings, null, unrun, 50);
    expect(out.understanding).toBe(understanding);
    expect(out.extra).toEqual([]);
  });
});

describe('applyRound2', () => {
  it('covers a check the extra query made a solid finding for', () => {
    const more = [finding('f-podcasts', 'podcasts', 'medium')];
    const out = applyRound2(
      {
        ...understanding,
        criteria: understanding.criteria.map((c) => ({ ...c, status: 'missing' })),
      },
      more,
      [{ query: 'podcasts', check: 'c2' }],
      more,
    );
    expect(out.criteria.map((c) => c.status)).toEqual(['missing', 'covered']);
    expect(out.criteria[1]?.findingIds).toEqual(['f-podcasts']);
  });
});

describe('evidenceBlock', () => {
  it('says plainly when nothing measured a check', () => {
    const block = evidenceBlock(understanding.criteria, []);
    expect(block).toContain('Names press angles [unchecked]: nothing measured for this');
  });
});
