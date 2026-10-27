import { describe, expect, it } from 'vitest';
import { nextStepsFor, type StepSource } from './next-steps';

const plan = (over: Partial<StepSource> = {}): StepSource => ({
  kind: 'build',
  title: 'Night Ferry',
  createdAt: '2026-10-01T10:00:00.000Z',
  brief: {
    places: [
      { name: 'Lagos', lift: 1.6 },
      { name: 'London', lift: 0.9 },
    ],
    assumptions: [
      { id: 'a-place-london', text: 'London is a strong market for this film' },
      { id: 'a-place-lagos', text: 'Lagos is a strong market for this film' },
    ],
  },
  plan: { findings: [{ query: 'brands', entities: [{ name: 'Lagoon Mobile' }] }] },
  ...over,
});

const NOW = new Date('2026-10-02T10:00:00.000Z');
const nextSteps = (outputs: StepSource[], now: Date = NOW) => nextStepsFor(outputs, now);

describe('nextStepsFor', () => {
  it('suggests the strongest city as the lead when the team started elsewhere', () => {
    const steps = nextSteps([plan()]);
    expect(steps.map((s) => s.id)).toEqual(['scn:lead:lagos', 'date', 'partner']);
    expect(steps[0]?.message).toBe('What if we open in Lagos first?');
    expect(steps[2]?.message).toBe('Draft a partner brief for Lagoon Mobile');
  });

  it('tries the runner-up when the team already leads with the strongest city', () => {
    const brief = plan().brief;
    const steps = nextSteps([
      plan({
        brief: {
          ...brief,
          assumptions: [...brief.assumptions].reverse(),
        },
      }),
    ]);
    expect(steps[0]?.label).toBe('What if we open in London first?');
  });

  it('leaves out what the project already has', () => {
    const outputs = [
      plan(),
      plan({
        kind: 'scenario',
        title: 'Open in Lagos first',
        createdAt: '2026-10-02T10:00:00.000Z',
        plan: null,
      }),
      plan({
        kind: 'date',
        title: 'Rival date check',
        createdAt: '2026-10-03T10:00:00.000Z',
        plan: null,
      }),
    ];
    expect(nextSteps(outputs).map((s) => s.id)).toEqual(['partner', 'fix']);
  });

  it('offers no partner when no brand was found, and nothing without a plan', () => {
    const noBrands = plan({ plan: { findings: [] } });
    expect(nextSteps([noBrands]).map((s) => s.id)).not.toContain('partner');
    expect(nextSteps([plan({ plan: null, kind: 'audit' })])).toEqual([]);
  });
});

describe('the creative kit step', () => {
  const withTerritories = plan({
    plan: {
      findings: [{ query: 'brands', entities: [{ name: 'Lagoon Mobile' }] }],
      territories: [{ name: 'Lagos' }, { name: 'London' }],
    },
  });

  it('offers the kit for the home territory, after the what-if', () => {
    const steps = nextSteps([withTerritories]);
    expect(steps.map((s) => s.id)).toEqual(['scn:lead:lagos', 'creative', 'date']);
    expect(steps[1]?.message).toBe('Make the creative kit for Lagos');
  });

  it('is left out once a kit exists, or when the plan has no territory', () => {
    const kit = plan({ kind: 'creative', title: 'Creative kit', plan: null });
    expect(nextSteps([withTerritories, kit]).map((s) => s.id)).not.toContain('creative');
    expect(nextSteps([plan()]).map((s) => s.id)).not.toContain('creative');
  });

  it('offers the top market opportunity as a what-if, once, and never an area', () => {
    const withOpp = (opportunities: { kind: string; name: string }[]) =>
      plan({ plan: { findings: [], territories: [{ name: 'Lagos' }], opportunities } });
    const ids = nextSteps([withOpp([{ kind: 'market', name: 'Accra' }])]).map((s) => s.id);
    expect(ids).toContain('scn:opp:accra');
    expect(
      nextSteps([withOpp([{ kind: 'area', name: 'Surulere' }])]).map((s) => s.id),
    ).not.toContain('scn:opp:surulere');
    const tried = plan({
      kind: 'scenario',
      title: 'What if we add Accra?',
      createdAt: '2026-10-02T10:00:00.000Z',
      plan: { findings: [], opportunities: [{ kind: 'market', name: 'Accra' }] },
    });
    expect(
      nextSteps([withOpp([{ kind: 'market', name: 'Accra' }]), tried]).map((s) => s.id),
    ).not.toContain('scn:opp:accra');
  });

  it('puts a check on what has changed first once a plan is two weeks old, and only until it is done', () => {
    const later = new Date('2026-10-20T10:00:00.000Z');
    expect(nextSteps([plan()], later)[0]).toMatchObject({
      id: 'refresh',
      message: 'Check what has changed since this plan was made',
    });
    expect(nextSteps([plan()], NOW).map((s) => s.id)).not.toContain('refresh');
    const checked = plan({ kind: 'refresh', createdAt: '2026-10-19T10:00:00.000Z', plan: null });
    expect(nextSteps([plan(), checked], later).map((s) => s.id)).not.toContain('refresh');
  });
});

describe('the watch step', () => {
  const id = '00000000-0000-4000-8000-000000000001';

  it('opens the Watch tab of the latest plan, ahead of the what-ifs', () => {
    const steps = nextSteps([plan({ id })]);
    expect(steps[0]).toMatchObject({
      id: 'watch',
      label: 'Watch this launch',
      href: `/outputs/${id}?tab=watch`,
    });
    expect(steps[0]?.message).toBeUndefined();
    expect(steps).toHaveLength(3);
  });

  it('is left out once the plan is watched, and for a plan with no id', () => {
    expect(nextSteps([plan({ id, watching: true })]).map((s) => s.id)).not.toContain('watch');
    expect(nextSteps([plan()]).map((s) => s.id)).not.toContain('watch');
  });

  it('comes after the check on a plan that has grown old', () => {
    const later = new Date('2026-11-01T10:00:00.000Z');
    expect(
      nextSteps([plan({ id })], later)
        .map((s) => s.id)
        .slice(0, 2),
    ).toEqual(['refresh', 'watch']);
  });

  it('is never offered on a scenario', () => {
    const scenario = plan({ id, kind: 'scenario' });
    expect(nextSteps([scenario]).map((s) => s.id)).not.toContain('watch');
  });
});
