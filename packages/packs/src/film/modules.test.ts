import { describe, expect, it } from 'vitest';
import { FILM_MODULES, pickModules, TASTE_CLAIM } from './modules';

const full = { scope: 'full', ask: null, format: 'film', route: null, hasBudget: false } as const;

describe('FILM_MODULES', () => {
  it('stays the ten modules Film plans have always had, whatever other categories add', () => {
    expect([...FILM_MODULES]).toEqual([
      'partnerships',
      'placement',
      'publicity',
      'community',
      'route',
      'timeline',
      'cadence',
      'budget',
      'measure',
      'risks',
    ]);
  });
});

describe('pickModules', () => {
  it('gives a full film plan every module but cadence, budget split included', () => {
    const { modules, ruledOut } = pickModules(full);
    expect(modules).toEqual([
      'partnerships',
      'placement',
      'publicity',
      'community',
      'route',
      'timeline',
      'budget',
      'measure',
      'risks',
    ]);
    expect(ruledOut.map((r) => r.key)).toEqual(['cadence']);
  });

  it('adds cadence for a series', () => {
    const { modules } = pickModules({ ...full, format: 'series' });
    expect(modules).toContain('cadence');
  });

  it('drops creative placement for a film going straight to streaming', () => {
    expect(pickModules({ ...full, route: 'streaming' }).modules).not.toContain('placement');
    expect(pickModules({ ...full, route: 'streaming', format: 'series' }).modules).toContain(
      'placement',
    );
  });

  it('gives a narrow ask only the module it names, or none', () => {
    expect(pickModules({ ...full, scope: 'narrow', ask: 'partnerships' }).modules).toEqual([
      'partnerships',
    ]);
    expect(pickModules({ ...full, scope: 'narrow', ask: null }).modules).toEqual([]);
    expect(pickModules({ ...full, scope: 'narrow', ask: 'budget' }).modules).toEqual(['budget']);
    expect(pickModules({ ...full, scope: 'narrow', ask: 'cadence' }).modules).toEqual([]);
  });
});

describe('TASTE_CLAIM', () => {
  it('catches claims about what an audience likes, not launch practice', () => {
    expect(TASTE_CLAIM.test('Afrobeats fans will turn out')).toBe(true);
    expect(TASTE_CLAIM.test('The audience loves crime drama')).toBe(true);
    expect(TASTE_CLAIM.test('Send screeners to critics four weeks out')).toBe(false);
    expect(TASTE_CLAIM.test('Watermark every screener to cut piracy')).toBe(false);
  });
});
