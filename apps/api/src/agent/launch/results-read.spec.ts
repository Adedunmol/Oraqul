import { describe, expect, it } from 'vitest';
import { checkResults, ScriptedResultsReader } from './results-read.js';

const read = async (text: string) => {
  const { reading } = await new ScriptedResultsReader().read({ text });
  return checkResults(reading, text);
};

describe('reading the results a team supplies', () => {
  it('keeps the source only when the person wrote it', async () => {
    const withSource = await read(
      'It opened last week.\nLagos: 4,200\nLondon: 1,800\nSource: Instagram insights',
    );
    expect(withSource.results?.source).toBe('Instagram insights');
    const without = await read('It opened last week.\nLagos: 4,200\nLondon: 1,800');
    expect(without.results?.source).toBeNull();
  });

  it('drops a source the model wrote that is not in the person’s words', () => {
    const text = 'It opened.\nLagos: 4,200';
    const out = checkResults(
      {
        launched: { value: true, quote: 'It opened' },
        measure: null,
        asOf: null,
        source: { value: 'Nielsen', quote: 'Nielsen panel' },
        byPlace: [{ place: 'Lagos', value: 4200, quote: 'Lagos: 4,200' }],
        byAge: null,
      },
      text,
    );
    expect(out.results?.source).toBeNull();
    expect(out.results?.byPlace).toEqual([{ place: 'Lagos', value: 4200 }]);
  });
});
