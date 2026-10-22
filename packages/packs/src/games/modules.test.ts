import { describe, expect, it } from 'vitest';
import {
  citiesForRegions,
  FALLBACK_COMPS,
  fallbackComps,
  GAMES_QUERIES,
  gamesQueryKeys,
} from './catalog';
import {
  beatsFor,
  datedBeats,
  GAMES_MODULES,
  KIND_PROFILES,
  kindFrom,
  launchKinds,
  PLATFORM_RULES,
  type Platform,
  pickModules,
  platformsFrom,
  rulesFor,
  SECTION_TITLES,
  TASTE_CLAIM,
} from './modules';

const full = {
  scope: 'full',
  ask: null,
  kind: 'premium',
  platforms: ['pc', 'switch'],
  hasBudget: false,
} as const;

describe('kindFrom and platformsFrom', () => {
  it('reads the platforms a brief names, in a fixed order', () => {
    expect(platformsFrom('A roguelike for Switch and Steam')).toEqual(['pc', 'switch']);
    expect(platformsFrom('Launching on the App Store and Google Play')).toEqual(['ios', 'android']);
    expect(platformsFrom('A game')).toEqual([]);
  });

  it('puts early access first, then mobile, then free to play', () => {
    expect(kindFrom('Early access on Steam, free to play later', ['pc'])).toBe('early_access');
    expect(kindFrom('A free-to-play mobile game', [])).toBe('mobile');
    expect(kindFrom('A puzzle game', ['ios', 'android'])).toBe('mobile');
    expect(kindFrom('A live service shooter', ['pc'])).toBe('free_to_play');
  });

  it('says nothing when the brief does not say, so the plan can name what it assumed', () => {
    expect(kindFrom('A roguelike with deckbuilding', ['pc'])).toBeNull();
  });
});

describe('pickModules (games)', () => {
  it('gives a premium PC and console plan its own modules in its own order', () => {
    const { modules, ruledOut } = pickModules(full);
    expect(modules).toEqual(KIND_PROFILES.premium.modules);
    expect(ruledOut).toEqual([]);
  });

  it('never offers a premium plan seasons, an early access roadmap or a soft launch', () => {
    const { modules } = pickModules(full);
    for (const key of ['liveops', 'earlyaccess', 'softlaunch'] as const) {
      expect(modules).not.toContain(key);
    }
  });

  it('gives each kind the modules that make it different', () => {
    const picked = (kind: (typeof launchKinds)[number], platforms: Platform[]) =>
      pickModules({ ...full, kind, platforms }).modules;
    expect(picked('early_access', ['pc'])).toContain('earlyaccess');
    expect(picked('free_to_play', ['pc'])).toContain('liveops');
    expect(picked('mobile', ['ios', 'android'])).toEqual(
      expect.arrayContaining(['softlaunch', 'liveops']),
    );
    expect(picked('mobile', ['ios', 'android'])).not.toContain('events');
  });

  it('rules out festivals for a mobile-only free to play launch, and says why', () => {
    const { modules, ruledOut } = pickModules({
      ...full,
      kind: 'free_to_play',
      platforms: ['ios'],
    });
    expect(modules).not.toContain('events');
    expect(ruledOut.map((r) => r.key)).toEqual(['events']);
  });

  it('rules out a soft launch with no mobile platform', () => {
    const { modules, ruledOut } = pickModules({ ...full, kind: 'mobile', platforms: ['pc'] });
    expect(modules).not.toContain('softlaunch');
    expect(ruledOut.map((r) => r.key)).toContain('softlaunch');
  });

  it('gives a narrow ask only the module it names', () => {
    expect(pickModules({ ...full, scope: 'narrow', ask: 'creators' }).modules).toEqual([
      'creators',
    ]);
  });

  it('answers a narrow ask for a module the kind does not carry with why, not silence', () => {
    const { modules, ruledOut } = pickModules({ ...full, scope: 'narrow', ask: 'liveops' });
    expect(modules).toEqual([]);
    expect(ruledOut.map((r) => r.key)).toEqual(['liveops']);
  });

  it('never offers a module Film or Music own', () => {
    for (const key of ['placement', 'route', 'cadence', 'tour', 'support', 'sync']) {
      expect(GAMES_MODULES).not.toContain(key);
    }
  });
});

describe('launch kinds', () => {
  it.each(launchKinds)('%s offers only modules the pack has', (kind) => {
    for (const key of KIND_PROFILES[kind].modules) expect(GAMES_MODULES).toContain(key);
  });

  it.each(launchKinds)('%s has a budget split that adds up to the whole', (kind) => {
    const total = KIND_PROFILES[kind].budget.reduce((sum, b) => sum + b.share, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it.each(launchKinds)('%s keeps taste claims out of its playbook wording', (kind) => {
    for (const beat of KIND_PROFILES[kind].beats) expect(beat.text).not.toMatch(TASTE_CLAIM);
    for (const measure of KIND_PROFILES[kind].measures) expect(measure).not.toMatch(TASTE_CLAIM);
    for (const rule of PLATFORM_RULES) expect(rule.text).not.toMatch(TASTE_CLAIM);
  });

  it.each(launchKinds)('%s defaults to cities the engine table has', (kind) => {
    expect(KIND_PROFILES[kind].defaultCities.length).toBeGreaterThan(0);
    expect(KIND_PROFILES[kind].defaultCities.length).toBeLessThanOrEqual(5);
  });
});

describe('beats', () => {
  it('keeps console steps off a PC-only plan and Steam steps off a console-only plan', () => {
    const pc = beatsFor('premium', ['pc']).map((b) => b.key);
    expect(pc).toContain('demo');
    expect(pc).not.toContain('console-cert');
    const console = beatsFor('premium', ['playstation']).map((b) => b.key);
    expect(console).toContain('console-cert');
    expect(console).not.toContain('demo');
  });

  it('plans early access with a roadmap and a 1.0 launch', () => {
    const keys = beatsFor('early_access', ['pc']).map((b) => b.key);
    expect(keys).toEqual(expect.arrayContaining(['roadmap', 'updates', 'one-point-oh']));
  });

  it('puts dates on the beats from the release and drops the ones already over', () => {
    const beats = beatsFor('premium', ['pc']);
    const dated = datedBeats(beats, '2027-03-01', '2027-01-04');
    const keys = dated.map((b) => b.key);
    expect(keys).not.toContain('store-page');
    expect(keys).toContain('launch');
    expect(dated.find((b) => b.key === 'launch')).toMatchObject({
      from: '2027-03-01',
      to: '2027-03-01',
    });
    expect(dated.find((b) => b.key === 'preview-keys')?.from).toBe('2027-01-18');
  });

  it('keeps every beat, undated, when the release date is not known', () => {
    const beats = beatsFor('premium', ['pc']);
    const dated = datedBeats(beats, null, '2027-01-04');
    expect(dated).toHaveLength(beats.length);
    expect(dated.every((b) => b.from === null && b.to === null)).toBe(true);
  });

  it('gives a platform only its own store rules', () => {
    expect(rulesFor(['pc']).every((r) => r.platforms.includes('pc'))).toBe(true);
    expect(rulesFor(['ios']).map((r) => r.key)).toEqual(['mobile-soft-launch']);
  });
});

describe('games catalog', () => {
  it('has a spec for every query key', () => {
    expect(Object.keys(GAMES_QUERIES).sort()).toEqual([...gamesQueryKeys].sort());
  });

  it('only ties a query to a module the pack offers', () => {
    for (const spec of Object.values(GAMES_QUERIES)) {
      if (spec.for !== 'core') expect(GAMES_MODULES).toContain(spec.for);
    }
  });

  it('titles every section a games plan can have', () => {
    for (const key of GAMES_MODULES) expect(SECTION_TITLES[key]).toBeTruthy();
    expect(SECTION_TITLES.markets).toBe('Regions');
  });

  it('turns region words into table cities, without repeats', () => {
    expect(citiesForRegions(['Europe', 'UK'])).toEqual([
      'London',
      'Berlin',
      'Paris',
      'Stockholm',
      'Warsaw',
      'Manchester',
    ]);
    expect(citiesForRegions(['Atlantis'])).toEqual([]);
  });
});

describe('fallbackComps', () => {
  it('picks games like the one described, by genre and then by kind', () => {
    expect(fallbackComps('a mobile video game that involves shooting', 'mobile')).toContain(
      'Call of Duty Mobile',
    );
    expect(fallbackComps('a cozy farming game', 'premium')).toContain('Stardew Valley');
    expect(fallbackComps('a roguelike', 'early_access')).toContain('Hades');
  });

  it('always has something for a brief with no genre, whatever the kind', () => {
    for (const kind of launchKinds) expect(fallbackComps('a game', kind).length).toBeGreaterThan(2);
    expect(fallbackComps('a game', 'mobile')).toContain('Subway Surfers');
  });

  it('keeps a kind-specific rule for the kind it is for', () => {
    // The mobile shooter list is for mobile only: a premium shooter gets console and PC games.
    expect(fallbackComps('a shooter', 'premium')).not.toContain('Call of Duty Mobile');
  });

  it('never suggests more than asked for, and names no duplicates', () => {
    for (const rule of FALLBACK_COMPS) {
      expect(new Set(rule.names).size).toBe(rule.names.length);
    }
    expect(fallbackComps('a shooter', 'mobile', 2)).toHaveLength(2);
  });
});
