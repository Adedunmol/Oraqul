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

const analysis = (inferred: Analysis['inferred']): Analysis => ({
  asked: 'A launch plan for a Nigerian film.',
  goals: ['Open strong at home'],
  constraints: [],
  inferred,
  criteria: [
    { text: 'Says which city to open in and why', evidence: true },
    { text: 'Names the first partner to approach', evidence: true },
  ],
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
    );
    const block = understandingBlock(understanding);
    expect(block).toContain('Assumed, not said by the person');
    expect(block).toContain('- country: Nigeria (set in Lagos)');
    expect(block).toContain('A good answer must:');
  });
});
