import { describe, expect, it } from 'vitest';
import {
  citiesForRegions,
  FALLBACK_COMPS,
  fallbackComps,
  genreFallback,
  genrePhrase,
  PODCASTS_QUERIES,
  podcastsQueryKeys,
} from './catalog';
import {
  beatsFor,
  datedBeats,
  formatFrom,
  KIND_PROFILES,
  kindFrom,
  launchKinds,
  type Platform,
  PODCASTS_MODULES,
  pickModules,
  platformsFor,
  platformsFrom,
  SECTION_TITLES,
  styleFrom,
  TASTE_CLAIM,
} from './modules';

const full = {
  scope: 'full',
  ask: null,
  kind: 'debut',
  format: 'both',
  style: 'interview',
  hasGuests: false,
  hasBudget: false,
} as const;

describe('platformsFrom, formatFrom, kindFrom and styleFrom', () => {
  it('reads the platforms a brief names, in a fixed order', () => {
    expect(platformsFrom('On Spotify and YouTube')).toEqual(['spotify', 'youtube']);
    expect(platformsFrom('Apple Podcasts first')).toEqual(['apple']);
    expect(platformsFrom('A show')).toEqual([]);
  });

  it('reads the format, and calls a filmed show on an audio platform both', () => {
    expect(formatFrom('A filmed show', [])).toBe('video');
    expect(formatFrom('An audio only show', ['youtube'])).toBe('audio');
    expect(formatFrom('A show on Spotify and YouTube', ['spotify', 'youtube'])).toBe('both');
    expect(formatFrom('A show on Spotify', ['spotify'])).toBe('audio');
    expect(formatFrom('A show', [])).toBeNull();
  });

  it('says a new show is a debut and season two is a season, and nothing otherwise', () => {
    expect(kindFrom('Our new podcast')).toBe('debut');
    expect(kindFrom('Season 2 of our show')).toBe('season');
    expect(kindFrom('A show about money')).toBeNull();
  });

  it('reads the style from the words', () => {
    expect(styleFrom('A narrative true crime series')).toBe('narrative');
    expect(styleFrom('A chat show with two co-hosts')).toBe('chat');
    expect(styleFrom('A show about money')).toBeNull();
  });
});

describe('pickModules (podcasts)', () => {
  it('gives a new show its own modules in its own order', () => {
    const { modules, ruledOut } = pickModules(full);
    expect(modules).toEqual(KIND_PROFILES.debut.modules);
    expect(ruledOut).toEqual([]);
  });

  it('orders a new season by its own profile', () => {
    const { modules } = pickModules({ ...full, kind: 'season' });
    expect(modules).toEqual(KIND_PROFILES.season.modules);
    expect(modules.indexOf('partnerships')).toBeLessThan(modules.indexOf('guests'));
  });

  it('drops the video section for an audio show, with a reason', () => {
    const { modules, ruledOut } = pickModules({ ...full, format: 'audio' });
    expect(modules).not.toContain('video');
    expect(ruledOut.map((r) => r.key)).toEqual(['video']);
  });

  it('drops guests for a narrative show unless guests are named', () => {
    expect(pickModules({ ...full, style: 'narrative' }).modules).not.toContain('guests');
    expect(pickModules({ ...full, style: 'narrative', hasGuests: true }).modules).toContain(
      'guests',
    );
  });

  it('gives a narrow ask only the module it names, and says why when the kind has none', () => {
    expect(pickModules({ ...full, scope: 'narrow', ask: 'crosspromo' }).modules).toEqual([
      'crosspromo',
    ]);
    expect(pickModules({ ...full, scope: 'narrow', ask: null }).modules).toEqual([]);
    const audio = pickModules({ ...full, format: 'audio', scope: 'narrow', ask: 'video' });
    expect(audio.modules).toEqual([]);
    expect(audio.ruledOut.map((r) => r.key)).toEqual(['video']);
  });

  it('never offers a module Film, Music or Games own', () => {
    for (const key of ['placement', 'route', 'tour', 'support', 'sync', 'store', 'events']) {
      expect(PODCASTS_MODULES).not.toContain(key);
    }
  });
});

describe('launch kinds', () => {
  it('has a profile, budget that adds up to 1, and measures for each kind', () => {
    for (const kind of launchKinds) {
      const p = KIND_PROFILES[kind];
      expect(p.measures.length).toBeGreaterThan(0);
      expect(p.budget.reduce((sum, c) => sum + c.share, 0)).toBeCloseTo(1, 5);
      expect(p.defaultCities.length).toBeGreaterThan(0);
    }
  });

  it('offers only modules the pack carries', () => {
    for (const kind of launchKinds) {
      for (const key of KIND_PROFILES[kind].modules) expect(PODCASTS_MODULES).toContain(key);
    }
  });
});

describe('beats', () => {
  it('keeps the YouTube beats for a show on YouTube and the editorial pitch for audio platforms', () => {
    const audio = beatsFor('debut', ['apple', 'spotify']).map((b) => b.key);
    expect(audio).toContain('editorial');
    expect(audio).not.toContain('clips');
    const video = beatsFor('debut', ['youtube']).map((b) => b.key);
    expect(video).toContain('clips');
    expect(video).not.toContain('editorial');
  });

  it('puts dates on the beats from the release, and drops any already over', () => {
    const beats = beatsFor('debut', ['apple', 'spotify'] satisfies Platform[]);
    const dated = datedBeats(beats, '2099-03-01', '2099-02-01');
    expect(dated.find((b) => b.key === 'launch')?.from).toBe('2099-03-01');
    expect(dated.some((b) => b.key === 'artwork-feed')).toBe(false);
    expect(datedBeats(beats, '2019-03-01', '2026-10-20')).toEqual([]);
  });

  it('keeps the weeks and no dates with no release date', () => {
    const beats = beatsFor('season', ['apple']);
    const dated = datedBeats(beats, null, '2026-10-20');
    expect(dated).toHaveLength(beats.length);
    expect(dated.every((b) => b.from === null)).toBe(true);
  });

  it('chooses the platforms a show is on, or the usual ones for its format', () => {
    expect(platformsFor(['spotify'], 'both')).toEqual(['spotify']);
    expect(platformsFor([], 'audio')).toEqual(['apple', 'spotify']);
    expect(platformsFor([], 'video')).toEqual(['apple', 'spotify', 'youtube']);
  });
});

describe('catalog', () => {
  it('has a spec for each query key, and a query only ties to a module the pack offers', () => {
    for (const key of podcastsQueryKeys) {
      const spec = PODCASTS_QUERIES[key];
      expect(spec.key).toBe(key);
      if (spec.for !== 'core') expect(PODCASTS_MODULES).toContain(spec.for);
    }
  });

  it('titles every section a feed names', () => {
    for (const key of podcastsQueryKeys) {
      for (const section of PODCASTS_QUERIES[key].feeds)
        expect(SECTION_TITLES[section]).toBeTruthy();
    }
  });

  it('turns region words into table cities without repeats', () => {
    expect(citiesForRegions(['West Africa', 'Nigeria'])).toEqual(['Lagos', 'Accra', 'Abuja']);
    expect(citiesForRegions(['Atlantis'])).toEqual([]);
  });

  it('reads a podcast genre phrase from the words, and nothing from an unrelated brief', () => {
    expect(genrePhrase('a true crime show')).toBe('true crime');
    expect(genrePhrase('football chat')).toBe('sports');
    expect(genrePhrase('a show')).toBeNull();
  });

  it('reads football as soccer outside the US, where Qloo means American football otherwise', () => {
    expect(genrePhrase('a football chat show for Nigerians')).toBe('soccer');
    expect(genrePhrase('football show in London')).toBe('soccer');
    expect(genrePhrase('Premier League talk')).toBe('soccer');
    expect(genrePhrase('a football show')).toBe('sports');
    expect(genrePhrase('NFL football in Lagos')).toBe('sports');
    expect(genreFallback('soccer')).toBe('sports');
    expect(genreFallback('sports')).toBeNull();
  });

  it('always has fallback shows for a genre, with no repeats', () => {
    expect(fallbackComps('anything at all')).not.toEqual([]);
    expect(fallbackComps('true crime')).toEqual([
      'Crime Junkie',
      'Serial',
      'My Favorite Murder with Karen Kilgariff and Georgia Hardstark',
      'Casefile True Crime',
    ]);
    expect(fallbackComps('true crime', 2)).toHaveLength(2);
    for (const rule of FALLBACK_COMPS) expect(new Set(rule.names).size).toBe(rule.names.length);
  });

  it('keeps playbook free of taste words in the beats', () => {
    for (const kind of launchKinds) {
      for (const beat of KIND_PROFILES[kind].beats) expect(beat.text).not.toMatch(TASTE_CLAIM);
    }
  });
});
