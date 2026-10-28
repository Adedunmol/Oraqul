import { describe, expect, it } from 'vitest';
import { type Analysis, applyAnalysis, understandingBlock } from './analyse.js';
import type { LaunchRead } from './read-core.js';

const read: LaunchRead = {
  genre: null,
  country: null,
  places: [],
  comps: ['Black Panther'],
  suggestedComps: [],
  ages: [],
  gender: null,
  window: null,
  budget: null,
  partners: [],
  scope: 'full',
  ask: null,
};

const analysis = (
  inferred: Analysis['inferred'],
  more: Partial<Pick<Analysis, 'readers' | 'comps'>> = {},
): Analysis => ({
  asked: 'A launch plan for a Nigerian film.',
  goals: ['Open strong at home'],
  constraints: [],
  inferred,
  readers: more.readers ?? null,
  comps: more.comps ?? [],
  criteria: [
    { text: 'Says which city to open in and why', evidence: true },
    { text: 'Names the first partner to approach', evidence: true },
  ],
});

describe('applyAnalysis comps and readers', () => {
  const none: LaunchRead = { ...read, comps: [] };
  const readers = {
    who: 'Teenage boys and young men, and the parents who buy for them',
    ages: ['24_and_younger', '25_to_29'],
    consumes: 'motivational books, YouTube advice channels',
    why: 'The book is about growing from boyhood to manhood.',
  };

  it('turns the proposed comps into suggestions, with the reason for each', () => {
    const out = applyAnalysis(
      none,
      analysis([], {
        readers,
        comps: [
          { name: 'Atomic Habits', why: 'Practical self improvement for young men.' },
          { name: 'Can’t Hurt Me', why: 'A hard-won route to discipline.' },
        ],
      }),
      'How to be a man',
    );
    expect(out.read.suggestedComps).toEqual(['Atomic Habits', 'Can’t Hurt Me']);
    expect(out.understanding.proposed?.map((c) => c.name)).toEqual([
      'Atomic Habits',
      'Can’t Hurt Me',
    ]);
    expect(out.understanding.readers?.who).toMatch(/Teenage boys/);
  });

  it('never proposes the title, a comp the person named, or a repeat', () => {
    const out = applyAnalysis(
      { ...none, comps: ['Black Panther'] },
      analysis([], {
        comps: [
          { name: 'How to be a man', why: 'itself' },
          { name: 'black panther', why: 'already theirs' },
          { name: 'Atomic Habits', why: 'fits' },
          { name: 'ATOMIC HABITS', why: 'repeat' },
        ],
      }),
      'How to be a man',
    );
    expect(out.read.suggestedComps).toEqual(['Atomic Habits']);
  });

  it('treats a series mark or a subtitle as the same title', () => {
    const out = applyAnalysis(
      { ...none, comps: ['Fourth Wing'] },
      analysis([], {
        comps: [
          { name: 'Fourth Wing (The Empyrean, #1)', why: 'already theirs' },
          { name: 'Atomic Habits: An Easy & Proven Way', why: 'fits' },
          { name: 'Atomic Habits', why: 'repeat' },
        ],
      }),
    );
    expect(out.read.suggestedComps).toEqual(['Atomic Habits: An Easy & Proven Way']);
  });

  it('adds no comps when the person already named three', () => {
    const out = applyAnalysis(
      { ...none, comps: ['A', 'B', 'C'] },
      analysis([], { comps: [{ name: 'Atomic Habits', why: 'fits' }] }),
    );
    expect(out.read.suggestedComps).toEqual([]);
    expect(out.understanding.proposed).toEqual([]);
  });

  it('does not turn a guess about the readers into the team’s age band', () => {
    const out = applyAnalysis(none, analysis([], { readers }));
    expect(out.read.ages).toEqual([]);
    expect(out.understanding.readers?.who).toMatch(/Teenage boys/);
  });

  it('never takes a country or cities from the subject matter', () => {
    const out = applyAnalysis(
      none,
      analysis([
        { field: 'country', value: 'United States', why: 'American self-help culture' },
        { field: 'places', value: 'New York, Los Angeles', why: 'major publishing hubs' },
      ]),
      'How to be a man',
      'I wrote a book about growing up. I do not know where to launch it.',
    );
    expect(out.read.country).toBeNull();
    expect(out.read.places).toEqual([]);
    expect(out.understanding.assumed).toEqual([]);
  });

  it('takes a country the words point to, and cities only inside it', () => {
    const out = applyAnalysis(
      none,
      analysis([
        { field: 'country', value: 'Nigeria', why: 'they say Nigerian' },
        { field: 'places', value: 'Lagos, London', why: 'home market' },
      ]),
      'T',
      'A Nigerian film about a heist.',
    );
    expect(out.read.country).toBe('Nigeria');
    expect(out.read.places).toEqual(['Lagos']);
  });
});

describe('applyAnalysis', () => {
  it('fills what the person left empty and returns it as an assumption', () => {
    const out = applyAnalysis(
      read,
      analysis([
        { field: 'genre', value: 'crime drama', why: 'the logline is about a heist' },
        { field: 'country', value: 'Nigeria', why: 'it is set in Lagos' },
        { field: 'places', value: 'Lagos, Atlantis', why: 'home market' },
      ]),
      'T',
      'A Nigerian crime film, set in Lagos.',
    );
    expect(out.read.genre).toBe('crime drama');
    expect(out.read.country).toBe('Nigeria');
    // A place outside the city table cannot be queried, so it is dropped.
    expect(out.read.places).toEqual(['Lagos']);
    expect(out.understanding.assumed.map((a) => a.what)).toEqual(['genre', 'country', 'places']);
    expect(out.understanding.by).toBe('model');
  });

  it('never overrides a value the person gave', () => {
    const stated = { ...read, genre: 'comedy', places: ['London'] };
    const out = applyAnalysis(
      stated,
      analysis([
        { field: 'genre', value: 'horror', why: 'guess' },
        { field: 'places', value: 'Lagos', why: 'guess' },
      ]),
    );
    expect(out.read.genre).toBe('comedy');
    expect(out.read.places).toEqual(['London']);
    expect(out.understanding.assumed).toEqual([]);
  });

  it('only takes age values that are Qloo bands', () => {
    const out = applyAnalysis(
      read,
      analysis([
        { field: 'ages', value: '18 to 24', why: 'students' },
        { field: 'ages', value: '25_to_29, 30_to_34', why: 'young adults' },
      ]),
    );
    expect(out.read.ages).toEqual(['25_to_29', '30_to_34']);
  });

  it('pads the checks to at least three and gives a scripted reading when there is no analysis', () => {
    const padded = applyAnalysis(read, analysis([]));
    expect(padded.understanding.criteria.length).toBeGreaterThanOrEqual(3);
    const scripted = applyAnalysis(read, null);
    expect(scripted.understanding.by).toBe('scripted');
    expect(scripted.read).toBe(read);
  });
});

describe('understandingBlock', () => {
  it('marks assumptions as not the person’s words and lists the checks', () => {
    const { understanding } = applyAnalysis(
      read,
      analysis([{ field: 'country', value: 'Nigeria', why: 'set in Lagos' }]),
      'T',
      'A film set in Lagos.',
    );
    const block = understandingBlock(understanding);
    expect(block).toContain('Assumed, not said by the person');
    expect(block).toContain('- country: Nigeria (set in Lagos)');
    expect(block).toContain('A good answer must:');
  });
});
