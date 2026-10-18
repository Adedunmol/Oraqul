import { categories, projectInputSchema, toolNames } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { BASE_PROMPT, demoProjects, packs, refusalFor } from './index';

// The fields every pack must fill today. Plan sections, assumption tests and coverage join this
// list with Film's deep pass, since no pack fills them yet.
describe('pack contract', () => {
  it.each(categories)('%s fills every required field', (category) => {
    const pack = packs[category];
    for (const field of [pack.title, pack.blurb, pack.covers, pack.systemPrompt]) {
      expect(field.trim()).not.toBe('');
    }
    expect(pack.assumptionChecklist.length).toBeGreaterThan(0);
    expect(pack.toolAllowlist.length).toBeGreaterThan(0);
    expect(new Set(pack.toolAllowlist).size).toBe(pack.toolAllowlist.length);
    expect(pack.qloo.titles.length).toBeGreaterThan(0);
  });

  it.each(categories)('%s leaves the shared rules to the base prompt', (category) => {
    const own = packs[category].systemPrompt.toLowerCase();
    for (const rule of ['receipt', 'never set', 'forecast', 'pricing']) {
      expect(own).not.toContain(rule);
    }
    expect(BASE_PROMPT.toLowerCase()).toContain('receipt');
  });
});

describe('packs', () => {
  it('has one pack per category, keyed by its own category', () => {
    for (const category of categories) expect(packs[category].category).toBe(category);
  });

  it('only allows tools that exist', () => {
    for (const category of categories) {
      for (const name of packs[category].toolAllowlist) expect(toolNames).toContain(name);
    }
  });

  it('lets only Books consult, and only Film (spec §3.4)', () => {
    for (const category of categories) {
      const expected = category === 'books' ? ['film'] : [];
      expect(packs[category].consults).toEqual(expected);
    }
  });
});

describe('demoProjects', () => {
  it('are valid projects in their own category', () => {
    for (const category of categories) {
      expect(projectInputSchema.parse(demoProjects[category]).category).toBe(category);
    }
  });
});

describe('refusals (spec §10)', () => {
  it.each([
    'How much will it make at the box office?',
    'Can you forecast our opening weekend?',
    'Predict the first weekend numbers',
    'What ticket price should we set?',
    'How much should we charge for the premiere?',
    'Send the brief to Nike',
    'Please email it to them',
  ])('refuses: %s', (text) => {
    expect(refusalFor(text)).not.toBeNull();
  });

  it.each([
    'Why Houston first?',
    'What if we open in Accra?',
    'Draft a partner brief for Nike',
    'Which age group responds best?',
  ])('lets through: %s', (text) => {
    expect(refusalFor(text)).toBeNull();
  });
});
