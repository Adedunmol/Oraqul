import type { Finding, LaunchSection, Output } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import {
  isWorthLine,
  opportunitiesOf,
  withOpportunities,
  withoutOpportunities,
} from './opportunities.js';

const finding = (id: string, names: string[], city: string | null = null): Finding => ({
  id,
  query: id.startsWith('f-areas') ? 'areas' : 'markets',
  text: `${id} text`,
  entities: names.map((name) => ({ entityId: null, name, affinity: null, detail: null })),
  numbers: {},
  verdict: null,
  confidence: 'medium',
  why: '',
  context: { city, ages: [], tags: [], country: null, yearFrom: null, audience: null },
  callIds: ['c1'],
});

const base = {
  findings: [] as Finding[],
  worth: [] as { place: string }[],
  teamOrder: [{ place: 'Lagos' }, { place: 'London' }],
  signal: null,
};

describe('opportunitiesOf', () => {
  it('finds nothing without evidence and never fills a quota', () => {
    const out = opportunitiesOf(base);
    expect(out.opportunities).toEqual([]);
    expect(out.lines).toEqual([]);
  });

  it('writes a market with a grounded why and playbook limit, test and measure', () => {
    const out = opportunitiesOf({
      ...base,
      findings: [finding('f-worth-a-look', ['Accra'])],
      worth: [{ place: 'Accra' }],
    });
    expect(out.opportunities).toHaveLength(1);
    const [why, limit, test, measure] = out.lines;
    expect(why?.kind).toBe('grounded');
    expect(why?.findingIds).toEqual(['f-worth-a-look']);
    expect(why?.text).toContain('Accra ranks above London');
    for (const l of [limit, test, measure]) {
      expect(l?.kind).toBe('playbook');
      expect(l?.findingIds).toEqual([]);
    }
    expect(out.lines.every(isWorthLine)).toBe(true);
    expect(out.opportunities[0]?.lines.why).toBe(why?.id);
  });

  it('skips a worth city the finding does not name', () => {
    const out = opportunitiesOf({
      ...base,
      findings: [finding('f-worth-a-look', ['Accra'])],
      worth: [{ place: 'Kumasi' }],
    });
    expect(out.opportunities).toEqual([]);
  });

  it('reads the strongest area of a team city and cites its finding', () => {
    const out = opportunitiesOf({
      ...base,
      findings: [finding('f-areas-lagos', ['Surulere', 'Lekki'], 'Lagos')],
    });
    expect(out.opportunities).toMatchObject([{ kind: 'area', name: 'Surulere', city: 'Lagos' }]);
    expect(out.lines[0]?.text).toContain('Surulere and Lekki');
    expect(out.lines[0]?.findingIds).toEqual(['f-areas-lagos']);
  });

  it('names the plan signal in what to measure', () => {
    const out = opportunitiesOf({
      ...base,
      findings: [finding('f-worth-a-look', ['Accra'])],
      worth: [{ place: 'Accra' }],
      signal: {
        key: 'streams',
        primary: 'first-week streams',
        secondary: [],
        checkpoints: [],
        target: null,
      },
    });
    expect(out.lines[3]?.text).toContain('first-week streams');
  });

  it('never makes a worth city one of the team cities', () => {
    const out = opportunitiesOf({
      ...base,
      findings: [finding('f-worth-a-look', ['Accra'])],
      worth: [{ place: 'Accra' }],
    });
    expect(base.teamOrder.map((p) => p.place)).not.toContain('Accra');
    expect(out.opportunities.every((o) => o.city === null)).toBe(true);
  });
});

describe('withOpportunities', () => {
  const sections: LaunchSection[] = [
    {
      key: 'markets',
      title: 'Markets',
      lines: [
        {
          id: 'l1',
          kind: 'grounded',
          text: 'Lead with Lagos.',
          findingIds: ['f-markets'],
          sourceIds: [],
          names: ['Lagos'],
          group: 'Lagos',
        },
        {
          id: 'l2',
          kind: 'grounded',
          text: 'Accra has a stronger audience.',
          findingIds: ['f-worth-a-look'],
          sourceIds: [],
          names: ['Accra'],
          group: 'Worth a look',
        },
      ],
    },
  ];

  it('replaces the writer’s one Worth a look line and keeps the team’s lines', () => {
    const found = opportunitiesOf({
      ...base,
      findings: [finding('f-worth-a-look', ['Accra'])],
      worth: [{ place: 'Accra' }],
    });
    const lines = withOpportunities(sections, found)[0]?.lines ?? [];
    expect(lines.map((l) => l.id)).not.toContain('l2');
    expect(lines[0]?.id).toBe('l1');
    expect(lines).toHaveLength(1 + found.lines.length);
  });

  it('leaves sections alone when there is nothing to add', () => {
    expect(withOpportunities(sections, { opportunities: [], lines: [] })).toBe(sections);
  });
});

describe('withoutOpportunities', () => {
  it('drops the Worth a look lines so an audit never reads them as the team’s cities', () => {
    const line = (id: string, group: string) => ({
      id,
      kind: 'playbook' as const,
      text: id,
      findingIds: [],
      sourceIds: [],
      names: [],
      group,
    });
    const output = {
      plan: {
        sections: [
          {
            key: 'markets',
            title: 'Markets',
            lines: [line('a', 'Lagos'), line('b', 'Worth a look')],
          },
        ],
      },
    } as unknown as Output;
    const lines = withoutOpportunities(output).plan?.sections[0]?.lines ?? [];
    expect(lines.map((l) => l.id)).toEqual(['a']);
  });

  it('returns an output with no plan unchanged', () => {
    const output = { plan: null } as unknown as Output;
    expect(withoutOpportunities(output)).toBe(output);
  });
});
