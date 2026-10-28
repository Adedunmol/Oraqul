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
    refresh: null,
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

  it('gives a Film plan with two cities Territories', () => {
    const brief = briefSchema.parse({ ...emptyBrief, places: cities });
    expect(tabsOf('film', row(brief, plan()))).toEqual([
      'plan',
      'territories',
      'funding',
      'watch',
      'audience',
      'assumptions',
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
      'funding',
      'watch',
      'audience',
      'assumptions',
      'evidence',
    ]);
    const bare = briefSchema.parse({ ...emptyBrief, places: cities });
    expect(tabsOf('music', row(bare, plan()))).not.toContain('route');
    expect(tabsOf('music', row(bare, plan()))).not.toContain('supportacts');
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
    expect(md).toContain(
      'Bolt (Nigeria). Qloo fit: 1 of 6 (okay). Budget: fits the budget. Price: unknown.',
    );
    expect(md).toContain('Tier B, category and integration');
  });
});

describe('export of a partner brief', () => {
  it('writes the pitch kit as a document, with the ask, the timeline and the room for the partner', () => {
    const brief = briefSchema.parse({
      ...emptyBrief,
      places: [place('Lagos', 1.6)],
      partners: [
        {
          id: 'partner-bolt',
          name: 'Bolt',
          type: 'Brand',
          fits: 'The comps’ audience',
          evidence: 'Fit 72',
          draft: 'Hi Bolt team',
          kit: {
            why: { text: 'Bolt fits this audience: fit 72.', findingIds: ['f-partner-bolt'] },
            gets: ['A mention on the cinema ticket'],
            ask: 'Ask Bolt for a call.',
            timeline: ['Now (2026-10-23): send the pitch.'],
            ideas: ['A premiere evening hosted with the partner'],
            script: 'Hi Bolt team',
            room: 'Leave the creative open to them.',
          },
        },
      ],
    });
    const output = presentOutput({
      row: { ...row(brief, null, 'partner'), title: 'Partner brief: Bolt' },
      receipts: [],
      category: 'film',
      createdBy: 'Ada',
      version: 1,
      parentBrief: null,
    });
    const md = toMarkdown(output);
    expect(md).toContain('Draft only. Oraqul never sends it.');
    expect(md).toContain('## What the partner gets');
    expect(md).toContain('Ask Bolt for a call.');
    expect(md).toContain('## A proposed timeline');
    expect(md).toContain('Leave the creative open to them.');
    expect(md).toContain('## A short pitch script');
  });
});

describe('export of the content calendar', () => {
  it('carries the calendar rows by territory and the paid ads note', () => {
    const brief = briefSchema.parse({ ...emptyBrief, places: [place('Lagos', 1.6)] });
    const line = (id: string, text: string, group: string | null) => ({
      id,
      kind: 'playbook' as const,
      text,
      findingIds: [],
      sourceIds: [],
      names: [],
      group,
    });
    const value = launchPlanSchema.parse({
      scope: 'full',
      sections: [
        {
          key: 'calendar',
          title: 'Content calendar',
          lines: [
            line(
              'calendar-lagos-exclusive',
              'T-4: Offer the trailer to one outlet first.',
              'Lagos',
            ),
            line(
              'calendar-ads-1',
              'Put about 80 percent behind creative that has worked.',
              'Paid ads',
            ),
          ],
        },
      ],
      comps: [],
      findings: [],
      dropped: [],
      writer: 'template',
    });
    const output = presentOutput({
      row: row(brief, value),
      receipts: [],
      category: 'film',
      createdBy: 'Ada',
      version: 1,
      parentBrief: null,
    });
    const md = toMarkdown(output);
    expect(md).toContain('## Content calendar');
    expect(md).toContain('**Lagos**');
    expect(md).toContain('Offer the trailer to one outlet first.');
    expect(md).toContain('**Paid ads**');
  });
});

describe('the Campaign tab', () => {
  const brief = briefSchema.parse({ ...emptyBrief, places: [place('Lagos', 1.6)] });
  const planWith = (calendar: unknown[]) =>
    launchPlanSchema.parse({
      scope: 'full',
      sections: [],
      comps: [],
      findings: [],
      dropped: [],
      writer: 'template',
      calendar,
    });
  const present = (value: ReturnType<typeof planWith>) =>
    presentOutput({
      row: row(brief, value),
      receipts: [],
      category: 'film',
      createdBy: 'Ada',
      version: 1,
      parentBrief: null,
    });
  const rowOf = {
    id: 'calendar-lagos-teaser',
    territory: 'Lagos',
    key: 'teaser',
    at: -2,
    from: '2099-02-26',
    to: '2099-02-26',
    asset: 'teaser',
    post: 'Post a teaser.',
    channel: 'Instagram',
    count: null,
    per: null,
    ruleId: 'film.calendar',
    grade: 'directional',
  };

  it('appears on a plan that has a calendar, and not on one that has none', () => {
    expect(present(planWith([rowOf])).tabs.map((t) => t.key)).toContain('campaign');
    expect(present(planWith([])).tabs.map((t) => t.key)).not.toContain('campaign');
  });

  it('says the actions are guides to adapt', () => {
    const tab = present(planWith([rowOf])).tabs.find((t) => t.key === 'campaign');
    expect(tab?.label).toBe('Campaign');
    expect(tab?.note).toMatch(/no final asset/i);
  });
});
