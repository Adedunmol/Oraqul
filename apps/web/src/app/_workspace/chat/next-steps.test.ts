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
