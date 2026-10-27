import { PACE_RULES } from '@oraqul/packs';
import type { PaceSettings } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { expectedShare, type PaceEntry, paceOf } from './pace.js';

const settings = (over: Partial<PaceSettings> = {}): PaceSettings => ({
  target: 1000,
  unit: 'tickets',
  kind: 'cumulative',
  entry: 'daily',
  curve: [
    { day: -28, share: 0 },
    { day: -14, share: 0.4 },
    { day: 0, share: 1 },
  ],
  curveFrom: 'rule',
  rulesVersion: 'pace@test',
  ...over,
});

const daily = (from: string, values: number[], city = ''): PaceEntry[] =>
  values.map((value, i) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { onDate: d.toISOString().slice(0, 10), value, city, channel: '' };
  });

const base = { checkpoints: [-28, -7], releaseDate: '2027-03-15' };

describe('expectedShare', () => {
  it('draws straight lines between points and holds the ends', () => {
    const curve = settings().curve;
    expect(expectedShare(curve, -40)).toBe(0);
    expect(expectedShare(curve, -21)).toBeCloseTo(0.2);
    expect(expectedShare(curve, -14)).toBeCloseTo(0.4);
    expect(expectedShare(curve, -7)).toBeCloseTo(0.7);
    expect(expectedShare(curve, 5)).toBe(1);
  });
});

describe('paceOf, cumulative', () => {
  // Today is 14 days out: 40% of 1,000 is expected, so 400.
  const today = '2027-03-01';
  const run = (values: number[]) =>
    paceOf({ ...base, settings: settings(), entries: daily('2027-02-27', values), today });

  it('is on pace right at the expected figure and at the edges of the band', () => {
    // 3 entries: 200 + 100 + 100 = 400 expected 400. Band is 360 (0.9) to 440 (1.1).
    expect(run([200, 100, 100]).verdict).toBe('on-pace');
    expect(run([120, 120, 120]).verdict).toBe('on-pace'); // 360 = exactly 0.9
    expect(run([140, 150, 149]).verdict).toBe('on-pace'); // 439
    expect(run([140, 150, 150]).verdict).toBe('ahead'); // 440 = exactly 1.1
  });

  it('is behind below 90 percent, with the gap in units and in points of the target', () => {
    const r = run([100, 100, 100]); // 300 against 400
    expect(r).toMatchObject({
      verdict: 'behind',
      actual: 300,
      expected: 400,
      gap: -100,
      gapPoints: -10,
    });
    expect(run([119, 120, 120]).verdict).toBe('behind'); // 359
  });

  it('says it is not a forecast', () => {
    expect(run([100, 100, 100]).note).toMatch(/not a forecast/);
  });

  it('is too early with fewer than three dated entries, and says why', () => {
    const r = paceOf({
      ...base,
      settings: settings(),
      entries: daily('2027-02-27', [10, 10]),
      today,
    });
    expect(r).toMatchObject({ verdict: 'too-early', reason: 'few-entries', gap: null });
  });

  it('is too early while the expected share is tiny, and with no target or release date', () => {
    const far = paceOf({
      ...base,
      settings: settings(),
      entries: daily('2027-02-01', [1, 1, 1]),
      today: '2027-02-05',
    });
    expect(far).toMatchObject({ verdict: 'too-early', reason: 'low-expected' });
    expect(
      paceOf({
        ...base,
        settings: settings({ target: null }),
        entries: daily('2027-02-27', [1, 1, 1]),
        today,
      }).reason,
    ).toBe('no-target');
    expect(
      paceOf({
        ...base,
        releaseDate: null,
        settings: settings(),
        entries: daily('2027-02-27', [1, 1, 1]),
        today,
      }).reason,
    ).toBe('no-release-date');
    expect(paceOf({ ...base, settings: settings(), entries: [], today }).reason).toBe('no-entries');
  });

  it('ignores entries dated after today', () => {
    const entries = [...daily('2027-02-27', [200, 100, 100]), ...daily('2027-03-05', [500])];
    expect(paceOf({ ...base, settings: settings(), entries, today }).actual).toBe(400);
  });

  it('adds cities together, and reads a running total as the latest figure from each city', () => {
    const lagos = daily('2027-02-27', [100, 150, 200], 'Lagos');
    const accra = daily('2027-02-27', [50, 60, 70], 'Accra');
    const daySum = paceOf({ ...base, settings: settings(), entries: [...lagos, ...accra], today });
    expect(daySum.actual).toBe(630);
    const total = paceOf({
      ...base,
      settings: settings({ entry: 'running-total' }),
      entries: [...lagos, ...accra],
      today,
    });
    expect(total.actual).toBe(270);
  });
});

describe('paceOf, level', () => {
  const lvl = settings({ kind: 'level', curve: [], target: 50, unit: 'percent' });
  const entries = daily('2027-03-10', [30, 40, 55]);

  it('is too early before the first checkpoint, then compares the latest reading with the target', () => {
    const before = paceOf({
      ...base,
      checkpoints: [7, 28],
      settings: lvl,
      entries,
      today: '2027-03-12',
    });
    expect(before).toMatchObject({ verdict: 'too-early', reason: 'before-first-checkpoint' });
    const after = paceOf({
      ...base,
      checkpoints: [7, 28],
      releaseDate: '2027-03-01',
      settings: lvl,
      entries,
      today: '2027-03-12',
    });
    expect(after).toMatchObject({ verdict: 'ahead', actual: 55, expected: 50 });
  });
});

describe('the rule defaults', () => {
  it('give every cumulative signal a curve that ends at the whole target and never falls', () => {
    for (const [category, rule] of Object.entries(PACE_RULES)) {
      const { kind, curve } = rule.value;
      if (kind === 'level') {
        expect(curve, category).toEqual([]);
        continue;
      }
      expect(curve.at(-1)?.share, category).toBe(1);
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i]!.share, category).toBeGreaterThanOrEqual(curve[i - 1]!.share);
        expect(curve[i]!.day, category).toBeGreaterThan(curve[i - 1]!.day);
      }
    }
  });
});
