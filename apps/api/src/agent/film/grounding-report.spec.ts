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

describe('groundingReport', () => {
  const plan: LaunchPlan = {
    scope: 'full',
    writer: 'model',
    comps: [],
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
