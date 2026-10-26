import { type Finding, type LaunchPlan, launchPlanSchema, type PlanSource } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { affectedLines, compareFindings, compareSources, pageKey } from './refresh-compare.js';

const finding = (id: string, names: string[], numbers: Record<string, number> = {}): Finding => ({
  id,
  query: 'markets',
  text: `${id} says ${names.join(', ')}`,
  entities: names.map((name) => ({ entityId: null, name, affinity: null, detail: null })),
  numbers,
  verdict: null,
  confidence: 'medium',
  why: '',
  context: { city: null, ages: [], tags: [], country: null, yearFrom: null, audience: null },
  callIds: ['00000000-0000-4000-8000-000000000001'],
});

const source = (id: string, url: string, fact: string): PlanSource => ({
  id,
  url,
  fact,
  title: id,
});

describe('compareFindings', () => {
  it('calls a finding moved only when the plan had it and a number or a place changed', () => {
    const saved = [finding('f-1', ['Tems', 'Rema'], { 'lift Lagos': 1.6 })];
    const moved = compareFindings(saved, [finding('f-1', ['Rema', 'Tems'], { 'lift Lagos': 1.6 })]);
    expect(moved[0]).toMatchObject({ status: 'moved' });
    expect(moved[0]?.ranks.map((r) => r.name).sort()).toEqual(['Rema', 'Tems']);
    const numbers = compareFindings(saved, [
      finding('f-1', ['Tems', 'Rema'], { 'lift Lagos': 1.9 }),
    ]);
    expect(numbers[0]).toMatchObject({
      status: 'moved',
      numbers: [{ key: 'lift Lagos', before: 1.6, after: 1.9 }],
    });
  });

  it('ignores a small wobble and says unchanged', () => {
    const out = compareFindings(
      [finding('f-1', ['Tems'], { 'lift Lagos': 1.6 })],
      [finding('f-1', ['Tems'], { 'lift Lagos': 1.64 })],
    );
    expect(out[0]?.status).toBe('unchanged');
  });

  it('says new for a finding the plan did not have, never changed', () => {
    const out = compareFindings([], [finding('f-new', ['Tems'])]);
    expect(out).toMatchObject([{ findingId: 'f-new', status: 'new' }]);
  });

  it('says not returned, not changed, for a saved finding the fresh check lacks', () => {
    const out = compareFindings([finding('f-old', ['Tems'])], []);
    expect(out).toMatchObject([{ findingId: 'f-old', status: 'not-returned' }]);
  });

  it('shows a name that came into or left the list', () => {
    const out = compareFindings([finding('f-1', ['Tems'])], [finding('f-1', ['Tems', 'Rema'])]);
    expect(out[0]?.status).toBe('moved');
    expect(out[0]?.ranks).toEqual([{ name: 'Rema', before: null, after: 2 }]);
  });
});

describe('compareSources', () => {
  const saved = [source('w1', 'https://www.example.com/news/', 'Opens 12 March.')];

  it('matches by page, ignoring the scheme, www and a trailing slash', () => {
    expect(pageKey('http://example.com/news')).toBe(pageKey('https://www.example.com/news/'));
  });

  it('is same when the page says the same, changed when the fact differs', () => {
    const same = compareSources(
      saved,
      [source('n1', 'https://example.com/news', 'opens 12  March.')],
      '2026-10-26',
    );
    expect(same[0]).toMatchObject({ status: 'same', retrievedAt: '2026-10-26' });
    const changed = compareSources(
      saved,
      [source('n1', 'https://example.com/news', 'Opens 19 March.')],
      '2026-10-26',
    );
    expect(changed[0]).toMatchObject({
      status: 'changed',
      before: 'Opens 12 March.',
      after: 'Opens 19 March.',
    });
  });

  it('says new for a page the plan did not save and not-found-again for one it cannot find', () => {
    const out = compareSources(
      saved,
      [source('n1', 'https://other.com/a', 'A new fact.')],
      '2026-10-26',
    );
    expect(out.map((s) => s.status).sort()).toEqual(['new', 'not-found-again']);
    expect(out.find((s) => s.status === 'not-found-again')?.retrievedAt).toBeNull();
  });
});

describe('affectedLines', () => {
  const plan: LaunchPlan = launchPlanSchema.parse({
    scope: 'full',
    comps: [],
    findings: [],
    dropped: [],
    writer: 'template',
    sources: [source('w1', 'https://example.com/news', 'Opens 12 March.')],
    sections: [
      {
        key: 'markets',
        title: 'Markets',
        lines: [
          {
            id: 'l1',
            kind: 'grounded',
            text: 'Lead with Lagos.',
            findingIds: ['f-1'],
            sourceIds: [],
            names: [],
            group: 'Lagos',
          },
          {
            id: 'l2',
            kind: 'playbook',
            text: 'Open on 12 March.',
            findingIds: [],
            sourceIds: ['w1'],
            names: [],
            group: null,
          },
          {
            id: 'l3',
            kind: 'grounded',
            text: 'Unrelated.',
            findingIds: ['f-9'],
            sourceIds: [],
            names: [],
            group: null,
          },
        ],
      },
    ],
  });

  it('lists the lines that rest on something that moved or a page that changed', () => {
    const findings = compareFindings(
      [finding('f-1', ['Tems'], { a: 1 }), finding('f-9', ['Rema'])],
      [finding('f-1', ['Tems'], { a: 2 }), finding('f-9', ['Rema'])],
    );
    const sources = compareSources(
      plan.sources,
      [source('n1', 'https://example.com/news', 'Opens 19 March.')],
      'x',
    );
    expect(affectedLines(plan, findings, sources).map((l) => l.lineId)).toEqual(['l1', 'l2']);
  });

  it('lists nothing when nothing moved', () => {
    expect(affectedLines(plan, [], [])).toEqual([]);
  });
});
