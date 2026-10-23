import { describe, expect, it } from 'vitest';
import { checkLine } from './check.js';
import { beatsSection, measureSection, signalOf, targetFrom } from './signal.js';

describe('targetFrom', () => {
  it('reads the number the team set, with its unit', () => {
    expect(targetFrom('Our target of 10,000 wishlists by launch.')).toEqual({
      value: 10000,
      unit: 'wishlists',
    });
    expect(targetFrom('Aiming for 20k downloads per episode')).toEqual({
      value: 20000,
      unit: 'downloads per episode',
    });
    expect(targetFrom('goal: 5k')).toEqual({ value: 5000, unit: null });
  });

  it('reads nothing when no target is written', () => {
    expect(targetFrom('Launch plan for a thriller opening in Lagos.')).toBeNull();
  });
});

describe('signalOf', () => {
  it('uses the team target first, then the rule library benchmark, and none otherwise (D2)', () => {
    const team = signalOf('games', 'Target 12,000 wishlists.');
    expect(team.target).toMatchObject({ value: 12000, from: 'team', floor: null });

    const rule = signalOf('games', 'A premium game.');
    expect(rule.target).toMatchObject({ value: 7000, floor: 5000, from: 'rule' });

    expect(signalOf('film', 'A thriller.').target).toBeNull();
    expect(signalOf('podcasts', 'A show.').checkpoints).toEqual([30, 60]);
  });
});

describe('measureSection', () => {
  it('names one primary signal, labels the target, and keeps followers secondary', () => {
    const section = measureSection('What to measure', signalOf('games', 'A game.'), [
      'Day 7 retention',
    ]);
    const text = section.lines.map((l) => l.text).join('\n');
    expect(text).toContain('Judge this plan on one signal: wishlists.');
    expect(text).toContain('a target, not a forecast');
    expect(text).toContain('Followers, Views, Demo plays are secondary');
    expect(text).toContain('Also track day 7 retention.');
    expect(section.lines.every((l) => l.kind === 'playbook' && l.findingIds.length === 0)).toBe(
      true,
    );
  });

  it('writes lines the line check would accept', () => {
    const ctx = {
      rules: {
        titles: {} as never,
        tasteClaim: /\b(fans?|likes?)\b/i,
        tagOnly: [],
      },
      findings: [],
      sources: [],
      briefNames: [],
      briefText: '',
      teamCities: [],
      teamAges: [],
      allowed: ['measure' as const],
    };
    for (const cat of ['film', 'music', 'books', 'podcasts', 'games'] as const) {
      for (const line of measureSection('What to measure', signalOf(cat, ''), []).lines) {
        expect(checkLine('measure', line, ctx), `${cat}: ${line.text}`).toBeNull();
      }
    }
  });
});

describe('beatsSection', () => {
  const beats = [
    { at: -8, key: 'a', text: 'Deliver the release.' },
    { at: -2, key: 'b', text: 'Release the video.' },
  ];

  it('puts dates on the beats from the release date (D1)', () => {
    const section = beatsSection('Timeline', beats, '2099-03-12', '2099-01-01');
    expect(section.lines[0]?.text).toContain('T-8 (2099-01-15)');
    expect(section.lines[1]?.text).toContain('T-2 (2099-02-26)');
  });

  it('keeps weeks only when no release day is known', () => {
    const section = beatsSection('Timeline', beats, 'Spring', '2099-01-01');
    expect(section.lines[0]?.text).toBe('T-8: Deliver the release.');
  });

  it('drops a beat that is already over and says when all are', () => {
    const section = beatsSection('Timeline', beats, '2099-03-12', '2099-04-01');
    expect(section.lines).toHaveLength(1);
    expect(section.lines[0]?.id).toBe('timeline-passed');
  });
});
