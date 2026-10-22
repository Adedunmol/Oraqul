import { describe, expect, it } from 'vitest';
import {
  ageVerdict,
  audienceIndex,
  averageBands,
  compAgeVerdict,
  compsVerdict,
  genderVerdict,
  placeVerdict,
  platformVerdict,
  routeVerdict,
  storeTagVerdict,
  topicVerdict,
} from './verdicts';

const ages = { '24_and_younger': 0.3, '25_to_29': 0.27, '35_to_44': 0.1, '55_and_older': -0.4 };

describe('ageVerdict (spec §5.2)', () => {
  it.each([
    ['24_and_younger', 'holds'],
    ['25_to_29', 'holds'],
    ['35_to_44', 'weak'],
    ['55_and_older', 'breaks'],
  ] as const)('%s %s', (band, verdict) => {
    expect(ageVerdict(band, ages).verdict).toBe(verdict);
  });

  it('cannot test with no profile', () => {
    expect(ageVerdict('25_to_29', {}).verdict).toBe('cant');
  });
});

describe('genderVerdict', () => {
  it.each([
    [0.2, 'holds'],
    [0.05, 'weak'],
    [-0.05, 'weak'],
    [-0.2, 'breaks'],
  ] as const)('affinity %s %s', (value, verdict) => {
    expect(genderVerdict('female', { female: value }).verdict).toBe(verdict);
  });
});

describe('placeVerdict', () => {
  it.each([
    [1.2, 'holds'],
    [1.1, 'weak'],
    [0.9, 'breaks'],
  ] as const)('lift %s %s', (lift, verdict) => {
    expect(placeVerdict({ status: 'ranked', lift, cells: 200 }).verdict).toBe(verdict);
  });

  it('cannot test an unknown or unranked city', () => {
    expect(placeVerdict({ status: 'unknown_place', lift: null, cells: 0 }).verdict).toBe('cant');
    expect(placeVerdict({ status: 'not_ranked', lift: null, cells: 12 }).why).toContain('12 cells');
  });
});

describe('compsVerdict', () => {
  it('is weak when the order rests on one comp, and names it', () => {
    expect(compsVerdict({ result: 'changes', restsOn: 'Gangs of Lagos' })).toEqual({
      verdict: 'weak',
      why: 'The city order rests on Gangs of Lagos.',
    });
    expect(compsVerdict(null).verdict).toBe('cant');
  });
});

describe('audienceIndex and averageBands', () => {
  it('shows 0 affinity as 50 and clamps', () => {
    expect(audienceIndex(0)).toBe(50);
    expect(audienceIndex(0.3)).toBe(65);
    expect(audienceIndex(-2)).toBe(0);
  });

  it('averages each band over the rows that have it', () => {
    expect(averageBands([{ a: 0.2, b: 0.4 }, { a: 0.4 }])).toEqual({
      a: 0.30000000000000004,
      b: 0.4,
    });
  });
});

describe('routeVerdict (spec §5.4)', () => {
  it.each([
    [1.5, 1.5, 'holds'],
    [1.46, 1.5, 'holds'],
    [1.45, 1.5, 'weak'],
    [1.4, 1.5, 'weak'],
    [1.39, 1.5, 'breaks'],
    [1.2, 1.5, 'breaks'],
  ] as const)('route score %s against best %s is %s', (actual, best, verdict) => {
    expect(routeVerdict(actual, best).verdict).toBe(verdict);
  });

  it('cannot test a route with no positive lift', () => {
    expect(routeVerdict(0, 0).verdict).toBe('cant');
  });
});

describe('platformVerdict', () => {
  it('holds when every platform is where at least two thirds of the comps live', () => {
    expect(
      platformVerdict([
        { platform: 'PC', listing: 3, withData: 3 },
        { platform: 'Switch', listing: 2, withData: 3 },
      ]).verdict,
    ).toBe('holds');
  });

  it('judges by the weakest platform named', () => {
    const weak = platformVerdict([
      { platform: 'PC', listing: 3, withData: 3 },
      { platform: 'Xbox', listing: 1, withData: 3 },
    ]);
    expect(weak.verdict).toBe('weak');
    expect(weak.why).toContain('Xbox');
    expect(platformVerdict([{ platform: 'Switch', listing: 0, withData: 3 }]).verdict).toBe(
      'breaks',
    );
  });

  it('cannot test with fewer than two comps that have platform data', () => {
    expect(platformVerdict([{ platform: 'PC', listing: 1, withData: 1 }]).verdict).toBe('cant');
    expect(platformVerdict([]).verdict).toBe('cant');
  });
});

describe('storeTagVerdict', () => {
  it('holds with two matches, is weak with fewer, and never breaks', () => {
    expect(storeTagVerdict(2, 5, 3).verdict).toBe('holds');
    expect(storeTagVerdict(1, 5, 3).verdict).toBe('weak');
    expect(storeTagVerdict(0, 5, 3).verdict).toBe('weak');
  });

  it('cannot test without shared tags or enough comps', () => {
    expect(storeTagVerdict(0, 0, 3).verdict).toBe('cant');
    expect(storeTagVerdict(2, 5, 1).verdict).toBe('cant');
  });
});

describe('topicVerdict', () => {
  it('holds for a topic that is yours, is weak when shared and breaks when the rivals own it', () => {
    expect(topicVerdict('yours').verdict).toBe('holds');
    expect(topicVerdict('shared').verdict).toBe('weak');
    expect(topicVerdict('rivals').verdict).toBe('breaks');
  });

  it('does not test a topic Qloo did not return', () => {
    expect(topicVerdict(null).verdict).toBe('cant');
  });
});

describe('compAgeVerdict', () => {
  it('holds for a book from the last five years, is weak to ten and breaks beyond', () => {
    expect(compAgeVerdict(2023, 2026).verdict).toBe('holds');
    expect(compAgeVerdict(2021, 2026).verdict).toBe('holds');
    expect(compAgeVerdict(2018, 2026).verdict).toBe('weak');
    expect(compAgeVerdict(2016, 2026).verdict).toBe('weak');
    expect(compAgeVerdict(2006, 2026).verdict).toBe('breaks');
  });

  it('does not test a book with no publication year', () => {
    expect(compAgeVerdict(null, 2026).verdict).toBe('cant');
  });

  it('never counts a book published after the launch year as old', () => {
    expect(compAgeVerdict(2027, 2026).verdict).toBe('holds');
  });
});
