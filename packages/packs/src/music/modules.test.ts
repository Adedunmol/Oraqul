import { describe, expect, it } from 'vitest';
import { MUSIC_QUERIES, musicQueryKeys } from './catalog';
import { MUSIC_MODULES, pickModules, SECTION_TITLES, TASTE_CLAIM } from './modules';

const full = {
  scope: 'full',
  ask: null,
  releaseType: 'album',
  cities: 3,
  hasBudget: false,
} as const;

describe('pickModules (music)', () => {
  it('gives a full album plan every module, budget split included', () => {
    const { modules, ruledOut } = pickModules(full);
    expect(modules).toEqual([...MUSIC_MODULES]);
    expect(ruledOut).toEqual([]);
  });

  it('rules out the tour route for one city, and says why', () => {
    const { modules, ruledOut } = pickModules({ ...full, cities: 1 });
    expect(modules).not.toContain('tour');
    expect(ruledOut).toEqual([{ key: 'tour', why: 'A tour route needs at least two cities.' }]);
  });

  it('rules out support acts for a single', () => {
    const { modules, ruledOut } = pickModules({ ...full, releaseType: 'single' });
    expect(modules).not.toContain('support');
    expect(ruledOut.map((r) => r.key)).toEqual(['support']);
  });

  it('gives a narrow ask only the module it names', () => {
    expect(pickModules({ ...full, scope: 'narrow', ask: 'support' }).modules).toEqual(['support']);
  });

  it('gives a narrow ask for a module the brief rules out nothing, and reports why', () => {
    const { modules, ruledOut } = pickModules({ ...full, scope: 'narrow', ask: 'tour', cities: 1 });
    expect(modules).toEqual([]);
    expect(ruledOut.map((r) => r.key)).toEqual(['tour']);
  });

  it('gives a narrow ask about the core no module', () => {
    expect(pickModules({ ...full, scope: 'narrow' }).modules).toEqual([]);
  });

  it('never offers a module Film owns', () => {
    expect(MUSIC_MODULES).not.toContain('placement');
    expect(MUSIC_MODULES).not.toContain('route');
    expect(MUSIC_MODULES).not.toContain('cadence');
  });
});

describe('music catalog', () => {
  it('has a spec for every query key', () => {
    expect(Object.keys(MUSIC_QUERIES).sort()).toEqual([...musicQueryKeys].sort());
  });

  it('only ties a query to a module the pack offers', () => {
    for (const spec of Object.values(MUSIC_QUERIES)) {
      if (spec.for !== 'core') expect(MUSIC_MODULES).toContain(spec.for);
    }
  });

  it('titles every section a music plan can have', () => {
    for (const key of ['tour', 'support', 'sync', 'publicity', 'markets'] as const) {
      expect(SECTION_TITLES[key]).toBeTruthy();
    }
  });
});

describe('TASTE_CLAIM (music)', () => {
  it('flags a playbook line that claims what an audience likes', () => {
    expect(TASTE_CLAIM.test('Fans of the artist love a late set.')).toBe(true);
    expect(TASTE_CLAIM.test('Book the late slot on the second night.')).toBe(false);
  });
});
