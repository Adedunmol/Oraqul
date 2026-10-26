import type { LaunchPlan } from '@oraqul/schema';
import { groundingReport } from './grounding-report.js';

const line = (id: string, text: string, findingIds: string[] = [], sourceIds: string[] = []) => ({
  id,
  kind: findingIds.length ? ('grounded' as const) : ('playbook' as const),
  text,
  findingIds,
  sourceIds,
  names: [],
  group: null,
});
const finding = (id: string) => ({
  id,
  query: 'music',
  text: 'x',
  entities: [],
  numbers: {},
  verdict: null,
  confidence: 'high' as const,
  why: '',
  context: { city: null, ages: [], tags: [], country: null, yearFrom: null, audience: null },
  callIds: [],
});

describe('rank kept', () => {
  const finding = (id: string, names: string[]) => ({
    id,
    query: 'music',
    text: 'x',
    entities: names.map((name) => ({ entityId: null, name, affinity: 0.9, detail: null })),
    numbers: {},
    verdict: null,
    confidence: 'high' as const,
    why: '',
    context: { city: null, ages: [], tags: [], country: null, yearFrom: null, audience: null },
    callIds: [],
  });
  const planWith = (text: string): LaunchPlan => ({
    scope: 'full',
    writer: 'model',
    understanding: null,
    rules: null,
    band: null,
    signal: null,
    territories: [],
    calls: [],
    partners: [],
    partnerNotes: [],
    calendar: [],
    opportunities: [],
    review: null,
    process: null,
    comps: [],
    compsNotFound: [],
    sources: [],
    dropped: [],
    findings: [finding('f1', ['Burna Boy', 'Tems', 'Rema'])],
    sections: [
      {
        key: 'partnerships',
        title: 'Partnerships',
        lines: [
          {
            id: 'p',
            kind: 'grounded',
            text,
            findingIds: ['f1'],
            sourceIds: [],
            names: [],
            group: null,
          },
        ],
      },
    ],
  });

  it('is 100 when names appear in the order Qloo ranked them, skipping is fine', () => {
    const r = groundingReport(planWith('Approach Burna Boy first, and Rema after.'), []);
    expect(r).toMatchObject({ rankKept: 100, rankPairs: 1 });
  });

  it('counts a lower-ranked pick put ahead of a higher-ranked one', () => {
    const r = groundingReport(planWith('Lead with Rema, then Tems, then Burna Boy.'), []);
    expect(r).toMatchObject({ rankKept: 0, rankPairs: 3 });
    const mixed = groundingReport(planWith('Tems and Burna Boy, then Rema.'), []);
    expect(mixed).toMatchObject({ rankKept: 67, rankPairs: 3 });
  });
});

describe('groundingReport', () => {
  const plan: LaunchPlan = {
    scope: 'full',
    writer: 'model',
    understanding: null,
    rules: null,
    band: null,
    signal: null,
    territories: [],
    calls: [],
    partners: [],
    partnerNotes: [],
    calendar: [],
    opportunities: [],
    review: null,
    process: null,
    comps: [],
    compsNotFound: [],
    findings: [finding('f1'), finding('f2'), finding('f3')],
    sources: [{ id: 'w1', fact: 'A fact.', title: 'T', url: 'https://example.com/a' }],
    dropped: [{ section: 'route', text: 'x', why: 'y' }],
    sections: [
      { key: 'bottom-line', title: 'In brief', lines: [line('a', 'Open in Lagos first.', ['f1'])] },
      {
        key: 'markets',
        title: 'Markets',
        lines: [
          line('b', 'Houston: screen at Studio Movie Grill.', ['f2']),
          line('c', 'Watermark every screener.'),
          line('d', 'Avoid the weeks around a rival opening.', [], ['w1']),
        ],
      },
      { key: 'budget', title: 'Budget split', lines: [line('e', 'Paid media: 40%.')] },
    ],
  };

  it('counts what rests on Qloo and on web pages, and leaves out what code writes', () => {
    const r = groundingReport(plan, ['Lagos', 'Houston', 'London']);
    expect(r).toMatchObject({
      lines: 4,
      grounded: 2,
      sourced: 1,
      playbook: 1,
      backed: 75,
      findingsUsed: 2,
      findingsTotal: 3,
      dropped: 1,
    });
    expect(r.cities).toEqual({ Lagos: 1, Houston: 1, London: 0 });
  });
});
