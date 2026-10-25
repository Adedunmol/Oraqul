import { type CalendarRow, type Finding, type LaunchPlan, launchPlanSchema } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { actionsFromPlan, guideKindFor, releaseOf, testFor } from './campaign.js';

const finding = (id: string, query: string, names: string[], city: string | null): Finding => ({
  id,
  query,
  text: `${id} text`,
  entities: names.map((name) => ({ entityId: null, name, affinity: null, detail: null })),
  numbers: {},
  verdict: null,
  confidence: 'medium',
  why: '',
  context: { city, ages: [], tags: [], country: null, yearFrom: null, audience: null },
  callIds: ['00000000-0000-4000-8000-000000000001'],
});

const row = (over: Partial<CalendarRow>): CalendarRow => ({
  id: 'calendar-lagos-teaser',
  territory: 'Lagos',
  key: 'teaser',
  at: -2,
  from: '2099-02-26',
  to: '2099-02-26',
  asset: 'teaser, 10 to 30 seconds',
  post: 'Post a teaser.',
  channel: 'Instagram',
  count: null,
  per: null,
  ruleId: 'film.calendar',
  grade: 'directional',
  ...over,
});

const plan = (calendar: CalendarRow[], findings: Finding[] = []): LaunchPlan =>
  launchPlanSchema.parse({
    scope: 'full',
    sections: [],
    comps: [],
    findings,
    dropped: [],
    writer: 'template',
    signal: {
      key: 'streams',
      primary: 'first-week streams',
      secondary: [],
      checkpoints: [],
      target: null,
    },
    territories: [
      {
        id: 't-lagos',
        name: 'Lagos',
        role: 'home',
        order: 1,
        callId: 'c',
        channels: [{ name: 'Instagram', lead: true }],
        partnerIds: [],
        lineIds: [],
      },
    ],
    calendar,
  });

const base = { category: 'film' as const, title: 'Night Ferry' };

describe('releaseOf', () => {
  it('works the release date back from a dated row', () => {
    expect(releaseOf([row({ at: -2, from: '2099-02-26' })])).toBe('2099-03-12');
    expect(releaseOf([row({ at: 0, from: '2099-03-12' })])).toBe('2099-03-12');
  });

  it('is null when no row has a date', () => {
    expect(releaseOf([row({ from: null, to: null })])).toBeNull();
    expect(releaseOf([])).toBeNull();
  });
});

describe('guideKindFor', () => {
  it('chooses the part of the kit that fits the asset', () => {
    expect(guideKindFor('teaser, 10 to 30 seconds')).toBe('hooks');
    expect(guideKindFor('trailer cut-down')).toBe('hooks');
    expect(guideKindFor('key art')).toBe('keyart');
    expect(guideKindFor('daily post')).toBe('captions');
    expect(guideKindFor(null)).toBe('captions');
  });

  it('gives a pitch, a screener or a link no creative guide', () => {
    expect(guideKindFor('press pitch')).toBeNull();
    expect(guideKindFor('online screener')).toBeNull();
    expect(guideKindFor('pre-save link')).toBeNull();
  });
});

describe('actionsFromPlan', () => {
  it('makes one action for each calendar row, in order, with its dates', () => {
    const rows = [
      row({ id: 'r1' }),
      row({ id: 'r2', at: 0, from: '2099-03-12', to: '2099-03-12' }),
    ];
    const actions = actionsFromPlan({ ...base, plan: plan(rows) });
    expect(actions.map((a) => a.rowId)).toEqual(['r1', 'r2']);
    expect(actions.map((a) => a.position)).toEqual([0, 1]);
    expect(actions[0]).toMatchObject({
      territory: 'Lagos',
      channel: 'Instagram',
      startsOn: '2099-02-26',
      week: -2,
    });
  });

  it('attaches a guide from the kit and keeps the findings its grounded lines cite', () => {
    const themes = finding('f-themes', 'themes', ['Noir', 'Road trip'], null);
    const [action] = actionsFromPlan({
      ...base,
      plan: plan([row({ asset: 'key art' })], [themes]),
    });
    expect(action?.guide?.kind).toBe('keyart');
    expect(action?.guide?.lines.some((l) => l.kind === 'grounded')).toBe(true);
    expect(action?.findingIds).toEqual(['f-themes']);
  });

  it('gives a hook guide with no findings to a plain teaser', () => {
    const [action] = actionsFromPlan({ ...base, plan: plan([row({})]) });
    expect(action?.guide?.kind).toBe('hooks');
    expect(action?.guide?.lines.every((l) => l.kind === 'playbook')).toBe(true);
    expect(action?.findingIds).toEqual([]);
  });

  it('leaves a pitch without a guide', () => {
    const [action] = actionsFromPlan({ ...base, plan: plan([row({ asset: 'press pitch' })]) });
    expect(action?.guide).toBeNull();
  });

  it('makes nothing from a plan with no calendar', () => {
    expect(actionsFromPlan({ ...base, plan: plan([]) })).toEqual([]);
  });
});

describe('testFor', () => {
  const territory = (p: LaunchPlan) => {
    const t = p.territories[0];
    if (!t) throw new Error('fixture has a territory');
    return t;
  };

  it('gives two angles with their reasoning and names no winner', () => {
    const p = plan([row({})]);
    const test = testFor({ ...base, plan: p, territory: territory(p), channel: 'Instagram' });
    expect(test.angles.map((a) => a.id)).toEqual(['a', 'b']);
    expect(test.angles.every((a) => a.text.length > 0)).toBe(true);
    expect(JSON.stringify([test.angles, test.measure])).not.toMatch(
      /winner|will win|best performing|outperform/i,
    );
    expect('winner' in test).toBe(false);
  });

  it('cites a finding for a taste-grounded angle and nothing for a craft angle', () => {
    const themes = finding('f-themes', 'themes', ['Noir', 'Road trip'], null);
    const p = plan([row({})], [themes]);
    const [a, b] = testFor({
      ...base,
      plan: p,
      territory: territory(p),
      channel: 'Instagram',
    }).angles;
    expect(a.basis).toBe('grounded');
    expect(a.findingIds).toEqual(['f-themes']);
    expect(b.basis).toBe('playbook');
    expect(b.findingIds).toEqual([]);
  });

  it('labels both angles playbook when no finding names a tone', () => {
    const p = plan([row({})]);
    const { angles } = testFor({ ...base, plan: p, territory: territory(p), channel: 'Instagram' });
    expect(angles.map((a) => a.basis)).toEqual(['playbook', 'playbook']);
  });

  it('measures the plan’s one signal and carries the ad-test conventions', () => {
    const p = plan([row({})]);
    const test = testFor({ ...base, plan: p, territory: territory(p), channel: 'Instagram' });
    expect(test.measure).toContain('first-week streams');
    expect(test.conventions.join(' ')).toMatch(/conversion count/);
  });
});
