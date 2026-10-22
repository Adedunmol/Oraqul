import { briefSchema, launchPlanSchema } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { contrastOf, processOf, supportActsOf, territoriesOf } from './plan-views';

const callId = '00000000-0000-4000-8000-000000000001';

const finding = (
  id: string,
  query: string,
  city: string | null,
  entities: { name: string; affinity: number | null }[] = [],
) => ({
  id,
  query,
  text: `Finding ${id}`,
  entities: entities.map((e) => ({ entityId: null, detail: null, ...e })),
  numbers: {},
  verdict: null,
  confidence: 'high',
  why: 'high',
  context: { city, ages: [], tags: [], country: null, yearFrom: null, audience: null },
  callIds: [callId],
});

const line = (id: string, group: string | null, findingIds: string[] = []) => ({
  id,
  kind: findingIds.length ? 'grounded' : 'playbook',
  text: `Line ${id}`,
  findingIds,
  sourceIds: [],
  names: [],
  group,
});

const plan = launchPlanSchema.parse({
  scope: 'full',
  sections: [
    {
      key: 'markets',
      title: 'Markets',
      lines: [line('m-lagos', 'Lagos', ['f-markets']), line('m-london', 'London')],
    },
    {
      key: 'placement',
      title: 'Placement',
      lines: [line('p-1', null, ['f-cinemas-lagos']), line('p-2', null, ['f-markets'])],
    },
  ],
  comps: [
    { name: 'Salt Road', source: 'you', match: null, choice: null },
    { name: 'Midnight Harbor', source: 'added', match: null, choice: null },
  ],
  findings: [
    finding('f-markets', 'markets', null, [{ name: 'Lagos', affinity: 0.8 }]),
    finding('f-cinemas-lagos', 'cinemas', 'Lagos', [{ name: 'Silverbird', affinity: 0.7 }]),
    finding('f-support-lagos', 'support', 'Lagos', [
      { name: 'Burna Boy', affinity: 0.95 },
      { name: 'Mr Eazi', affinity: 0.8 },
    ]),
    finding('f-support-london', 'support', 'London', [
      { name: 'Burna Boy', affinity: 0.85 },
      { name: 'Amaarae', affinity: 0.7 },
    ]),
  ],
  dropped: [],
  writer: 'template',
});

const place = (name: string, lift: number) => ({
  id: `place-${name.toLowerCase()}`,
  name,
  lift,
  band: lift >= 1.5 ? 'strong' : lift >= 1.2 ? 'usable' : 'weak',
  audience: 'Women',
  confidence: 'high',
  note: '',
});

describe('territoriesOf', () => {
  it('ranks territories by lift and gathers the lines about each', () => {
    const brief = briefSchema.parse({
      ...emptyBrief,
      places: [place('London', 0.8), place('Lagos', 1.6)],
    });
    const [first, second] = territoriesOf(plan, brief.places);
    expect(first?.place.name).toBe('Lagos');
    expect(first?.rank).toBe(1);
    // Grouped under Lagos, or resting only on a Lagos finding.
    expect(first?.parts.flatMap((p) => p.lines.map((l) => l.id))).toEqual(['m-lagos', 'p-1']);
    expect(first?.findings.map((f) => f.id)).toEqual(['f-cinemas-lagos', 'f-support-lagos']);
    expect(second?.parts.flatMap((p) => p.lines.map((l) => l.id))).toEqual(['m-london']);
  });
});

describe('supportActsOf', () => {
  it('lists the acts the support findings name, the ones in most cities first', () => {
    const grid = supportActsOf(plan);
    expect(grid?.cities).toEqual(['Lagos', 'London']);
    expect(grid?.rows[0]).toMatchObject({ name: 'Burna Boy', values: [95, 85], average: 90 });
    const eazi = grid?.rows.find((r) => r.name === 'Mr Eazi');
    expect(eazi?.values).toEqual([80, null]);
    expect(eazi?.levels[1]).toBeNull();
  });

  it('is null when no city has a support list', () => {
    expect(supportActsOf({ ...plan, findings: [] })).toBeNull();
  });
});

const emptyBrief = {
  audience: [],
  assumptions: [],
  s1: [],
  s2: [],
  s3: [],
  s4: [],
  places: [],
  weeks: [],
  dates: [],
  chosenDate: '',
  partners: [],
  risks: [],
  cannot: [],
  groupLabels: [],
  planned: [],
  results: null,
  course: null,
};

describe('contrastOf', () => {
  const brief = briefSchema.parse({
    ...emptyBrief,
    places: [place('Lagos', 1.6), place('London', 0.8)],
    assumptions: [
      {
        id: 'a-place-london',
        text: 'London is a strong market for this film',
        verdict: 'breaks',
        why: '',
        fix: '',
        unstated: false,
      },
      {
        id: 'a-place-lagos',
        text: 'Lagos is a strong market for this film',
        verdict: 'holds',
        why: '',
        fix: '',
        unstated: false,
      },
    ],
  });
  const output = {
    plan,
    brief,
    counts: { holds: 3, weak: 1, breaks: 1, cant: 2 },
    receipts: ['r1', 'r2', 'r3'],
  };

  it('sets the order the team gave beside the order Qloo found', () => {
    const c = contrastOf(output);
    expect(c?.order?.yours.map((p) => p.name)).toEqual(['London', 'Lagos']);
    expect(c?.order?.ranked.map((p) => [p.name, p.verdict])).toEqual([
      ['Lagos', 'holds'],
      ['London', 'breaks'],
    ]);
    expect(c?.order?.moved).toBe(2);
  });

  it('counts the lines that cite Qloo, the playbook lines and the beliefs overturned', () => {
    const c = contrastOf(output);
    expect(c?.basis).toEqual({ grounded: 3, playbook: 1, findings: 4, receipts: 3 });
    expect(c?.beliefs.overturned).toBe(2);
    expect(c?.added.comps).toEqual(['Midnight Harbor']);
    expect(c?.added.named).toBe(5);
  });

  it('is null for an output with no plan', () => {
    expect(contrastOf({ ...output, plan: null })).toBeNull();
  });
});

describe('processOf', () => {
  it('has nothing to show for a plan that kept no record', () => {
    expect(processOf({ process: null, review: null })).toBeNull();
  });

  it('tells each research round, red team round and removed line in plain sentences', () => {
    const view = processOf({
      process: {
        research: [
          {
            round: 1,
            open: ['Says which city to open in'],
            asked: [
              { label: 'The podcasts that audience hears', why: 'press is thin', found: true },
            ],
            retried: [{ label: 'Cinemas in Lagos', says: 'without the genre tag', found: false }],
            consulted: [{ category: 'music', name: 'Tems', found: true }],
          },
        ],
        drafts: 2,
        dropped: [
          { draft: 1, section: 'markets', text: 'Lagos loves it', why: 'no finding backs it' },
        ],
      },
      review: {
        status: 'passed',
        next: [],
        rounds: [
          {
            round: 1,
            action: 'rewrote',
            issues: [
              {
                check: 'c1',
                type: 'missing',
                text: 'No city named.',
                fix: 'Name one.',
                blocking: true,
              },
            ],
          },
          { round: 2, action: 'approved', issues: [] },
        ],
      },
    });
    expect(view?.research[0]?.steps).toEqual([
      'Still open: Says which city to open in.',
      'Asked Qloo for The podcasts that audience hears, because press is thin. Qloo had an answer.',
      'Asked again for Cinemas in Lagos without the genre tag. Qloo had nothing for it.',
      'Asked the music side about Tems. Qloo had an answer.',
    ]);
    expect(view?.review.map((r) => r.steps.at(-1))).toEqual([
      'The plan was written again with these points.',
      'The draft passed.',
    ]);
    expect(view?.dropped).toHaveLength(1);
    expect(view?.drafts).toBe(2);
  });
});
