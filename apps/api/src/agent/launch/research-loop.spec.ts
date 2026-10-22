import type { Finding, Understanding } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { evidenceBlock } from './evidence.js';
import { applyAssessment, applyRound2, MIN_CALLS_LEFT, openChecks } from './research-loop.js';

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
        retry: [],
        consult: [],
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
      {
        checks: [{ id: 'c1', status: 'covered', findingIds: ['f-b', 'f-a'] }],
        extra: [],
        retry: [],
        consult: [],
      },
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
      retry: [],
      consult: [],
    };
    expect(applyAssessment(understanding, findings, assessment, unrun, 50).extra).toHaveLength(1);
    expect(
      applyAssessment(understanding, findings, assessment, unrun, MIN_CALLS_LEFT - 1).extra,
    ).toEqual([]);
  });

  it('keeps only the retries and consults code offered, in the order code listed them', () => {
    const misses = [
      {
        id: 'f-cinemas',
        key: 'cinemas',
        label: 'Cinemas',
        alternatives: [{ key: 'no-tags', says: 'without the genre tag' }],
      },
      {
        id: 'f-shows',
        key: 'shows',
        label: 'Shows',
        alternatives: [{ key: 'no-country', says: 'without the release country' }],
      },
    ];
    const consults = [
      {
        id: 'c-music-a',
        category: 'music' as const,
        types: ['urn:entity:artist' as const],
        name: 'A',
        why: 'x',
      },
    ];
    const assessment = {
      checks: [],
      extra: [],
      retry: [
        { miss: 'f-shows', alt: 'no-country', check: 'c1', why: 'b' },
        { miss: 'f-cinemas', alt: 'no-tags', check: 'c1', why: 'a' },
        { miss: 'f-cinemas', alt: 'invented', check: 'c1', why: 'c' },
        { miss: 'f-invented', alt: 'no-tags', check: 'c1', why: 'd' },
      ],
      consult: [
        { offer: 'c-music-a', check: 'c2', why: 'e' },
        { offer: 'c-made-up', check: 'c2', why: 'f' },
      ],
    };
    const out = applyAssessment(understanding, findings, assessment, unrun, 50, {
      misses,
      consults,
    });
    expect(out.retry.map((r) => r.miss)).toEqual(['f-cinemas', 'f-shows']);
    expect(out.consult.map((c) => c.offer)).toEqual(['c-music-a']);
    const short = applyAssessment(understanding, findings, assessment, unrun, MIN_CALLS_LEFT - 1, {
      misses,
      consults,
    });
    expect([short.retry, short.consult]).toEqual([[], []]);
  });

  it('reads a miss or an offer named by its label as the same one, and passes on the id', () => {
    const misses = [
      {
        id: 'f-music-lagos',
        key: 'music',
        label: 'Artists in Lagos',
        alternatives: [{ key: 'no-tags', says: 'without the genre tag' }],
      },
    ];
    const consults = [
      {
        id: 'consult-music-tems',
        category: 'music' as const,
        types: ['urn:entity:artist' as const],
        name: 'Tems',
        why: 'x',
      },
    ];
    const out = applyAssessment(
      understanding,
      findings,
      {
        checks: [],
        extra: [],
        retry: [{ miss: 'Artists in Lagos', alt: 'no-tags', check: 'c1', why: 'a' }],
        consult: [{ offer: 'Tems', check: 'c1', why: 'b' }],
      },
      unrun,
      50,
      { misses, consults },
    );
    expect(out.retry.map((r) => r.miss)).toEqual(['f-music-lagos']);
    expect(out.consult.map((c) => c.offer)).toEqual(['consult-music-tems']);
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

describe('openChecks', () => {
  it('lists the checks that need evidence and are not covered', () => {
    const u: Understanding = {
      ...understanding,
      criteria: [
        { id: 'c1', text: 'Says which city', evidence: true, status: 'covered', findingIds: [] },
        { id: 'c2', text: 'Names press', evidence: true, status: 'thin', findingIds: [] },
        {
          id: 'c3',
          text: 'Follows the brief',
          evidence: false,
          status: 'unchecked',
          findingIds: [],
        },
      ],
    };
    expect(openChecks(u).map((c) => c.id)).toEqual(['c2']);
  });
});
