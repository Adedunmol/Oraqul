import { describe, expect, it } from 'vitest';
import { ScriptedFilmReader } from './read.js';

const partners = async (text: string) =>
  (await new ScriptedFilmReader().read({ title: 'Third Bridge', text })).reading.partners.map(
    (p) => p.value,
  );

describe('ScriptedFilmReader partners', () => {
  it('takes a capitalised brand named next to partner or sponsor', async () => {
    expect(await partners('A thriller opening in Lagos, with Nike as a partner.')).toEqual([
      'Nike',
    ]);
    expect(await partners('We are partnering with Red Bull and sponsored by MTN.')).toEqual([
      'Red Bull',
      'MTN',
    ]);
  });

  it('takes nothing from a plan that names no partner', async () => {
    expect(await partners('A thriller opening in Lagos for the partner of a lawyer.')).toEqual([]);
  });
});
