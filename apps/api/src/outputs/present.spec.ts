import { briefSchema, launchPlanSchema } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import type { outputs } from '../db/schema.js';
import { toMarkdown } from './export.js';
import { presentOutput } from './present.js';

type OutputRow = typeof outputs.$inferSelect;

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

const place = (name: string, lift: number) => ({
  id: `place-${name.toLowerCase()}`,
  name,
  lift,
  band: 'strong',
  audience: 'Women',
  confidence: 'high',
  note: '',
});

const callId = '00000000-0000-4000-8000-000000000001';
const supportFinding = {
  id: 'f-support-lagos',
  query: 'support',
  text: 'In Lagos, the acts that rank highest are Burna Boy.',
  entities: [{ entityId: null, name: 'Burna Boy', affinity: 0.9, detail: null }],
  numbers: {},
  verdict: null,
  confidence: 'high',
  why: 'high',
  context: { city: 'Lagos', ages: [], tags: [], country: null, yearFrom: null, audience: null },
  callIds: [callId],
};

const plan = (findings: unknown[] = []) =>
  launchPlanSchema.parse({
    scope: 'full',
    sections: [],
    comps: [],
    findings,
    dropped: [],
    writer: 'template',
  });

function row(brief: unknown, planValue: unknown, kind: OutputRow['kind'] = 'build'): OutputRow {
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    threadId: '00000000-0000-4000-8000-0000000000bb',
    projectId: '00000000-0000-4000-8000-0000000000cc',
    kind,
    parentId: null,
    title: 'Night Ferry',
    brief,
    plan: planValue,
    report: null,
    inputs: null,
    versions: null,
    changedIds: [],
    headline: 'Open in Lagos first.',
    moves: [],
    confidence: { level: 'high', why: 'enough data' },
    dataAsOf: new Date('2026-10-01T00:00:00Z'),
    createdAt: new Date('2026-10-01T00:00:00Z'),
  };
}

const tabsOf = (category: 'film' | 'music' | 'books', value: OutputRow) =>
  presentOutput({
    row: value,
    receipts: [],
    category,
    createdBy: 'Ada',
    version: 1,
    parentBrief: null,
  }).tabs.map((t) => t.key);

describe('presentOutput tabs for a plan', () => {
  const cities = [place('Lagos', 1.6), place('London', 0.9)];

  it('gives a Film plan with two cities Territories, and every plan With and without Qloo', () => {
    const brief = briefSchema.parse({ ...emptyBrief, places: cities });
    expect(tabsOf('film', row(brief, plan()))).toEqual([
      'plan',
      'territories',
      'audience',
      'assumptions',
      'contrast',
      'evidence',
    ]);
  });

  it('leaves out Territories for one city and for other categories', () => {
    const one = briefSchema.parse({ ...emptyBrief, places: [place('Lagos', 1.6)] });
    expect(tabsOf('film', row(one, plan()))).not.toContain('territories');
    const two = briefSchema.parse({ ...emptyBrief, places: cities });
    expect(tabsOf('books', row(two, plan()))).not.toContain('territories');
  });

  it('gives a Music plan the tour route once it is scored, and support acts once they are listed', () => {
    const route = {
      score: 1.2,
      bestScore: 1.3,
      bestOrder: ['Lagos', 'London'],
      isBestOrder: false,
    };
    const scored = briefSchema.parse({ ...emptyBrief, places: cities, route });
    expect(tabsOf('music', row(scored, plan([supportFinding])))).toEqual([
      'plan',
      'route',
      'supportacts',
      'audience',
      'assumptions',
      'contrast',
      'evidence',
    ]);
    const bare = briefSchema.parse({ ...emptyBrief, places: cities });
    expect(tabsOf('music', row(bare, plan()))).not.toContain('route');
    expect(tabsOf('music', row(bare, plan()))).not.toContain('supportacts');
  });

  it('does not add plan tabs to an output with no plan', () => {
    const brief = briefSchema.parse({ ...emptyBrief, places: cities });
    expect(tabsOf('film', row(brief, null))).not.toContain('contrast');
  });
});

describe('presentOutput tabs for the launch rules', () => {
  const cities = [place('Lagos', 1.6), place('London', 0.9)];
  const territory = (name: string, role: 'home' | 'diaspora', callId: string | null) => ({
    id: `territory-${name.toLowerCase()}`,
    name,
    role,
    order: role === 'home' ? 0 : 1,
    callId,
    channels: [{ name: 'WhatsApp', lead: true }],
    partnerIds: [],
    lineIds: [],
  });
  const call = {
    id: 'call-territory-lagos',
    subject: 'territory',
    name: 'Lagos',
    direction: 'okay',
    confidence: 'high',
    why: 'Audience strength 1.6.',
    findingIds: ['f-markets'],
    teamChoice: true,
    territory: 'Lagos',
  };
  const planWith = (extra: Record<string, unknown>) =>
    launchPlanSchema.parse({
      scope: 'full',
      sections: [],
      comps: [],
      findings: [],
      dropped: [],
      writer: 'template',
      ...extra,
    });

  it('gives any category a Territories tab once its plan has territories, and a Calls tab with calls', () => {
    const brief = briefSchema.parse({ ...emptyBrief, places: cities });
    const value = planWith({
      territories: [territory('Lagos', 'home', call.id), territory('London', 'diaspora', null)],
      calls: [call],
    });
    for (const category of ['film', 'music', 'books'] as const) {
      const tabs = tabsOf(category, row(brief, value));
      expect(tabs[0]).toBe('plan');
      expect(tabs).toContain('territories');
      expect(tabs.indexOf('calls')).toBe(tabs.indexOf('territories') + 1);
    }
  });

  it('shows the Date tab for a build that checked rival dates', () => {
    const dated = briefSchema.parse({
      ...emptyBrief,
      places: cities,
      dates: [
        {
          id: 'date-1',
          date: '2099-03-12',
          week: 0,
          rival: 'X',
          overlap: 80,
          band: 'moderate',
          advice: '',
        },
      ],
    });
    expect(tabsOf('film', row(dated, planWith({})))).toContain('date');
  });

  it('gives a creative kit the kit and the evidence, and nothing else', () => {
    const brief = briefSchema.parse({ ...emptyBrief, places: cities });
    expect(tabsOf('film', row(brief, planWith({ scope: 'narrow' }), 'creative'))).toEqual([
      'kit',
      'evidence',
    ]);
  });
});

describe('exports of the launch rules', () => {
  const brief = briefSchema.parse({ ...emptyBrief, places: [place('Lagos', 1.6)] });
  const value = launchPlanSchema.parse({
    scope: 'full',
    sections: [],
    comps: [],
    findings: [],
    dropped: [],
    writer: 'template',
    rules: { category: 'film', version: 'film@2026-10-22.1' },
    territories: [
      {
        id: 'territory-lagos',
        name: 'Lagos',
        role: 'home',
        order: 0,
        callId: 'call-territory-lagos',
        channels: [
          { name: 'WhatsApp', lead: true },
          { name: 'Instagram', lead: true },
        ],
        partnerIds: ['partner-bolt'],
        lineIds: [],
      },
    ],
    calls: [
      {
        id: 'call-territory-lagos',
        subject: 'territory',
        name: 'Lagos',
        direction: 'okay',
        confidence: 'high',
        why: 'Audience strength 1.6.',
        findingIds: [],
        teamChoice: true,
        territory: 'Lagos',
      },
    ],
    partners: [
      {
        id: 'partner-bolt',
        name: 'Bolt',
        tier: 'B',
        market: 'Nigeria',
        from: 'qloo',
        fit: { place: 1, of: 6, direction: 'okay' },
        budgetFit: 'fits',
        price: 'unknown',
        findingIds: [],
      },
    ],
  });

  it('writes each territory with its call, channels and partners, the rules version, and no price', () => {
    const output = presentOutput({
      row: row(brief, value),
      receipts: [],
      category: 'film',
      createdBy: 'Ada',
      version: 1,
      parentBrief: null,
    });
    const md = toMarkdown(output);
    expect(md).toContain('Rules film@2026-10-22.1');
    expect(md).toContain('**Lagos, home market: Okay**');
    expect(md).toContain('Lead on WhatsApp, Instagram.');
    expect(md).toContain('Bolt. Qloo fit: 1 of 6 (okay). Budget: fits the budget. Price: unknown.');
    expect(md).toContain('Tier B, category and integration');
  });
});
