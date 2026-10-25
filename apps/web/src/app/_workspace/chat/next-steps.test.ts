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

describe('nextStepsFor', () => {
  it('suggests the strongest city as the lead when the team started elsewhere', () => {
    const steps = nextStepsFor([plan()]);
    expect(steps.map((s) => s.id)).toEqual(['scn:lead:lagos', 'date', 'partner']);
    expect(steps[0]?.message).toBe('What if we open in Lagos first?');
    expect(steps[2]?.message).toBe('Draft a partner brief for Lagoon Mobile');
  });

  it('tries the runner-up when the team already leads with the strongest city', () => {
    const brief = plan().brief;
    const steps = nextStepsFor([
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
    expect(nextStepsFor(outputs).map((s) => s.id)).toEqual(['partner', 'fix']);
  });

  it('offers no partner when no brand was found, and nothing without a plan', () => {
    const noBrands = plan({ plan: { findings: [] } });
    expect(nextStepsFor([noBrands]).map((s) => s.id)).not.toContain('partner');
    expect(nextStepsFor([plan({ plan: null, kind: 'audit' })])).toEqual([]);
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
    const steps = nextStepsFor([withTerritories]);
    expect(steps.map((s) => s.id)).toEqual(['scn:lead:lagos', 'creative', 'date']);
    expect(steps[1]?.message).toBe('Make the creative kit for Lagos');
  });

  it('is left out once a kit exists, or when the plan has no territory', () => {
    const kit = plan({ kind: 'creative', title: 'Creative kit', plan: null });
    expect(nextStepsFor([withTerritories, kit]).map((s) => s.id)).not.toContain('creative');
    expect(nextStepsFor([plan()]).map((s) => s.id)).not.toContain('creative');
  });

  it('offers the top market opportunity as a what-if, once, and never an area', () => {
    const withOpp = (opportunities: { kind: string; name: string }[]) =>
      plan({ plan: { findings: [], territories: [{ name: 'Lagos' }], opportunities } });
    const ids = nextStepsFor([withOpp([{ kind: 'market', name: 'Accra' }])]).map((s) => s.id);
    expect(ids).toContain('scn:opp:accra');
    expect(
      nextStepsFor([withOpp([{ kind: 'area', name: 'Surulere' }])]).map((s) => s.id),
    ).not.toContain('scn:opp:surulere');
    const tried = plan({
      kind: 'scenario',
      title: 'What if we add Accra?',
      createdAt: '2026-10-02T10:00:00.000Z',
      plan: { findings: [], opportunities: [{ kind: 'market', name: 'Accra' }] },
    });
    expect(
      nextStepsFor([withOpp([{ kind: 'market', name: 'Accra' }]), tried]).map((s) => s.id),
    ).not.toContain('scn:opp:accra');
  });
});
