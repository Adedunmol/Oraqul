import { describe, expect, it } from 'vitest';
import { unaccountedNames } from './check.js';

describe('unaccountedNames', () => {
  it('does not join the last word of one sentence to the first of the next', () => {
    expect(
      unaccountedNames('Lead the launch in Montreal. Put the most spend there.', 'Montreal'),
    ).toEqual([]);
  });

  it('keeps a short abbreviation inside a name', () => {
    expect(unaccountedNames('Open in St. Louis and Kansas City.', 'Kansas City')).toEqual([
      'St. Louis',
    ]);
    expect(
      unaccountedNames('Open in St. Louis and Kansas City.', 'St. Louis and Kansas City'),
    ).toEqual([]);
  });

  it('flags a name nothing accounts for', () => {
    expect(unaccountedNames('Pitch Blue Harbor Press first.', 'Montreal')).toEqual([
      'Blue Harbor Press',
    ]);
  });
});
