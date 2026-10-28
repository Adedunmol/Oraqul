import { describe, expect, it } from 'vitest';
import { BOOKS_QUERIES, booksQueryKeys, citiesForRegions, genrePhrase } from './catalog';
import {
  BOOKS_MODULES,
  beatsFor,
  beatTags,
  datedBeats,
  formatsFrom,
  KIND_PROFILES,
  kindFrom,
  launchKinds,
  pickModules,
  readershipFrom,
  routeFrom,
  routes,
  SECTION_TITLES,
  TASTE_CLAIM,
} from './modules';

const full = {
  scope: 'full',
  ask: null,
  kind: 'debut',
  route: 'traditional',
  readership: 'adult',
  audio: true,
  hasBudget: false,
} as const;

describe('kindFrom, routeFrom, readershipFrom and formatsFrom', () => {
  it('reads a debut, a series book, a reissue and a new book by an author, and nothing otherwise', () => {
    expect(kindFrom('My debut novel')).toBe('debut');
    expect(kindFrom('Book three of the trilogy')).toBe('series');
    expect(kindFrom('A paperback reissue with a film tie-in')).toBe('backlist');
    expect(kindFrom('The latest novel by an author with two earlier books')).toBe('frontlist');
    expect(kindFrom('My second novel')).toBe('frontlist');
    expect(kindFrom('I want to work on my new book')).toBeNull();
    expect(kindFrom('A book about money')).toBeNull();
  });

  it('reads a debut over a series word, since a debut has no earlier book', () => {
    expect(kindFrom('A debut that is the first in a trilogy')).toBe('debut');
  });

  it('reads self-publishing over a publisher word, and nothing from neither', () => {
    expect(routeFrom('I am self-publishing on KDP')).toBe('indie');
    expect(routeFrom('Self published, no publisher')).toBe('indie');
    expect(routeFrom('Our imprint publishes it in May')).toBe('traditional');
    expect(routeFrom('Published by an independent press')).toBe('traditional');
    expect(routeFrom('A novel')).toBeNull();
  });

  it('reads children and young adult readerships, and leaves adult to the default', () => {
    expect(readershipFrom('A middle grade adventure')).toBe('children');
    expect(readershipFrom("A children's picture book")).toBe('children');
    expect(readershipFrom('A YA fantasy')).toBe('ya');
    expect(readershipFrom('A literary novel')).toBeNull();
  });

  it('reads the formats a brief names, in a fixed order', () => {
    expect(formatsFrom('hardcover, ebook and an Audible audiobook')).toEqual([
      'print',
      'ebook',
      'audio',
    ]);
    expect(formatsFrom('A novel')).toEqual([]);
  });
});

describe('pickModules (books)', () => {
  it('gives a debut its own modules in its own order', () => {
    const { modules, ruledOut } = pickModules(full);
    expect(modules).toEqual(KIND_PROFILES.debut.modules.filter((m) => m !== 'schools'));
    expect(ruledOut.map((r) => r.key)).toEqual(['schools']);
  });

  it('leads a series book with the earlier readers and a reissue with the screen angle', () => {
    expect(pickModules({ ...full, kind: 'series' }).modules.slice(0, 2)).toEqual([
      'comps',
      'cadence',
    ]);
    expect(pickModules({ ...full, kind: 'backlist' }).modules.slice(0, 2)).toEqual([
      'comps',
      'adaptation',
    ]);
  });

  it('drops retail sell-in for a self-published book, with a reason', () => {
    const { modules, ruledOut } = pickModules({ ...full, route: 'indie' });
    expect(modules).not.toContain('retail');
    expect(ruledOut.map((r) => r.key)).toContain('retail');
  });

  it('drops the audiobook section when there is no audiobook', () => {
    expect(pickModules({ ...full, audio: false }).modules).not.toContain('audio');
  });

  it('adds schools and libraries for young readers only', () => {
    expect(pickModules({ ...full, readership: 'children' }).modules).toContain('schools');
    expect(pickModules({ ...full, readership: 'ya' }).modules).toContain('schools');
    expect(pickModules(full).modules).not.toContain('schools');
  });

  it('gives a narrow ask only the module it names, and says why when it is ruled out', () => {
    expect(pickModules({ ...full, scope: 'narrow', ask: 'comps' }).modules).toEqual(['comps']);
    expect(pickModules({ ...full, scope: 'narrow', ask: null }).modules).toEqual([]);
    const indie = pickModules({ ...full, route: 'indie', scope: 'narrow', ask: 'retail' });
    expect(indie.modules).toEqual([]);
    expect(indie.ruledOut.map((r) => r.key)).toEqual(['retail']);
  });

  it('never offers a module Film, Music, Games or Podcasts own', () => {
    for (const key of [
      'placement',
      'route',
      'tour',
      'support',
      'sync',
      'store',
      'crosspromo',
      'guests',
    ]) {
      expect(BOOKS_MODULES).not.toContain(key);
    }
  });
});

describe('launch kinds', () => {
  it('has a profile, a budget per route that adds up to 1, and measures for each kind', () => {
    for (const kind of launchKinds) {
      const p = KIND_PROFILES[kind];
      expect(p.measures.length).toBeGreaterThan(0);
      expect(p.defaultCities.length).toBeGreaterThan(0);
      for (const route of routes) {
        expect(p.budget[route].reduce((sum, c) => sum + c.share, 0)).toBeCloseTo(1, 5);
      }
    }
  });

  it('offers only modules the pack carries, each once', () => {
    for (const kind of launchKinds) {
      const { modules } = KIND_PROFILES[kind];
      expect(new Set(modules).size).toBe(modules.length);
      for (const key of modules) expect(BOOKS_MODULES).toContain(key);
    }
  });

  it('gives every module a kind offers to a full plan, so none is dead', () => {
    const everything = pickModules({ ...full, readership: 'children' });
    expect(everything.modules.sort()).toEqual([...KIND_PROFILES.debut.modules].sort());
  });
});

describe('beats', () => {
  it('keeps sell-in for a publisher and the upload for a self-published book', () => {
    const publisher = beatsFor('debut', beatTags('traditional', false, 'adult')).map((b) => b.key);
    expect(publisher).toContain('sell-in');
    expect(publisher).not.toContain('upload');
    const indie = beatsFor('debut', beatTags('indie', false, 'adult')).map((b) => b.key);
    expect(indie).toContain('upload');
    expect(indie).not.toContain('sell-in');
  });

  it('keeps the audiobook and school beats for the launches that have them', () => {
    const plain = beatsFor('debut', beatTags('traditional', false, 'adult')).map((b) => b.key);
    expect(plain).not.toContain('audiobook');
    expect(plain).not.toContain('schools');
    const both = beatsFor('debut', beatTags('traditional', true, 'children')).map((b) => b.key);
    expect(both).toContain('audiobook');
    expect(both).toContain('schools');
  });

  it('tells the earlier readers first for a series book and a new book by an author, not a debut', () => {
    const keys = (kind: 'debut' | 'frontlist' | 'series') =>
      beatsFor(kind, ['traditional']).map((b) => b.key);
    expect(keys('series')).toContain('earlier-readers');
    expect(keys('series')).toContain('book-one');
    expect(keys('frontlist')).toContain('earlier-readers');
    expect(keys('debut')).not.toContain('earlier-readers');
  });

  it('opens a reissue with the new edition and leaves out the advance copies of a first printing', () => {
    const keys = beatsFor('backlist', ['traditional']).map((b) => b.key);
    expect(keys[0]).toBe('new-edition');
    expect(keys).toContain('tie-in');
    expect(keys).not.toContain('advance-copies');
  });

  it('puts dates on the beats from the release, and drops any already over', () => {
    const beats = beatsFor('debut', ['traditional']);
    const dated = datedBeats(beats, '2099-03-01', '2099-02-01');
    expect(dated.find((b) => b.key === 'launch')?.from).toBe('2099-03-01');
    expect(dated.some((b) => b.key === 'metadata')).toBe(false);
    expect(datedBeats(beats, '2019-03-01', '2026-10-20')).toEqual([]);
  });

  it('keeps the weeks and no dates with no release date', () => {
    const beats = beatsFor('frontlist', ['indie']);
    const dated = datedBeats(beats, null, '2026-10-20');
    expect(dated).toHaveLength(beats.length);
    expect(dated.every((b) => b.from === null)).toBe(true);
  });

  it('keeps playbook free of taste words in the beats and the budget lines', () => {
    for (const kind of launchKinds) {
      for (const beat of KIND_PROFILES[kind].beats) expect(beat.text).not.toMatch(TASTE_CLAIM);
      for (const route of routes) {
        for (const line of KIND_PROFILES[kind].budget[route])
          expect(line.line).not.toMatch(TASTE_CLAIM);
      }
    }
  });
});

describe('catalog', () => {
  it('has a spec for each query key, and a query only ties to a module the pack offers', () => {
    for (const key of booksQueryKeys) {
      const spec = BOOKS_QUERIES[key];
      expect(spec.key).toBe(key);
      if (spec.for !== 'core') expect(BOOKS_MODULES).toContain(spec.for);
    }
  });

  it('titles every section a feed names', () => {
    for (const key of booksQueryKeys) {
      for (const section of BOOKS_QUERIES[key].feeds) expect(SECTION_TITLES[section]).toBeTruthy();
    }
  });

  it('turns region words into table cities without repeats', () => {
    expect(citiesForRegions(['West Africa', 'Nigeria'])).toEqual(['Lagos', 'Accra', 'Abuja']);
    expect(citiesForRegions(['Atlantis'])).toEqual([]);
  });

  it('reads a book genre phrase from the words, and nothing from an unrelated brief', () => {
    expect(genrePhrase('a literary novel')).toBe('literary fiction');
    expect(genrePhrase('a romantasy series')).toBe('fantasy romance');
    expect(genrePhrase('a YA thriller')).toBe('young adult');
    expect(genrePhrase('a Nigerian family saga')).toBe('african literature');
    expect(genrePhrase('a book')).toBeNull();
  });
});
