import { describe, expect, it } from 'vitest';
import { namesBook } from './findings.js';

describe('namesBook: the Qloo title for a book the team named', () => {
  it('accepts the same title and a longer one that goes on after a break', () => {
    expect(namesBook('Zero to One', 'zero to one')).toBe(true);
    expect(
      namesBook('Zero to One: Notes on Startups, or How to Build the Future', 'Zero to One'),
    ).toBe(true);
    expect(namesBook('Fourth Wing (The Empyrean, #1)', 'Fourth Wing')).toBe(true);
  });

  it('refuses a different book that only starts with the same letters', () => {
    expect(namesBook('Builders', 'Build')).toBe(false);
    expect(namesBook('Angelina Ballerina', 'Angel')).toBe(false);
  });
});
