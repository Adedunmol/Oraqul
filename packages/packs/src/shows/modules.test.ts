import { describe, expect, it } from 'vitest';
import { ASSET_OFFER } from '../rules/shared';
import { SHOWS_PLAN_RULES, SHOWS_RULES } from '../rules/shows';
import {
  beatsFor,
  isLastMinute,
  onSaleDates,
  onSaleFor,
  pacingFor,
  phasesFor,
  pickModules,
  showTypeFrom,
  TASTE_CLAIM,
  ticketTarget,
  weeksLeft,
} from './modules';

describe('on-sale window (E1)', () => {
  it('uses the researched weeks for comedy, concerts and club nights', () => {
    expect(onSaleFor('comedy', null)).toEqual({ source: 'rule', weeks: { min: 4, max: 6 } });
    expect(onSaleFor('concert', null).weeks).toEqual({ min: 6, max: 10 });
    expect(onSaleFor('club', null).weeks).toEqual({ min: 2, max: 4 });
  });

  it('leaves theatre and screenings to the team, and marks the window as theirs', () => {
    expect(onSaleFor('theatre', null)).toEqual({ source: 'missing', weeks: null });
    expect(onSaleFor('screening', null).source).toBe('missing');
    expect(onSaleFor('theatre', 8)).toEqual({ source: 'user', weeks: { min: 8, max: 8 } });
    expect(onSaleFor('comedy', 3).source).toBe('user');
  });

  it('works the dates back from the show', () => {
    const dates = onSaleDates('2099-03-12', onSaleFor('comedy', null));
    expect(dates?.general).toEqual({ from: '2099-01-29', to: '2099-02-12' });
    expect(dates?.critical).toEqual({ from: '2099-01-29', to: '2099-01-31' });
    expect(dates?.firstWeekEnds).toBe('2099-02-05');
    expect(dates?.finalWeek).toEqual({ from: '2099-03-05', to: '2099-03-12' });
    expect(onSaleDates(null, onSaleFor('comedy', null))).toBeNull();
    expect(onSaleDates('2099-03-12', onSaleFor('theatre', null))).toBeNull();
  });
});

describe('last minute and the budget by phase (E4)', () => {
  it('is last minute when fewer weeks are left than the shortest window', () => {
    const concert = onSaleFor('concert', null);
    expect(weeksLeft('2099-03-12', '2099-03-01')).toBe(1);
    expect(isLastMinute('2099-03-12', '2099-03-01', concert)).toBe(true);
    expect(isLastMinute('2099-03-12', '2099-01-01', concert)).toBe(false);
    expect(isLastMinute(null, '2099-01-01', concert)).toBe(false);
    expect(isLastMinute('2099-03-12', '2099-03-01', onSaleFor('theatre', null))).toBe(false);
  });

  it('splits 40, 20 and 40, and 50, 10 and 40 for comedy and last-minute shows', () => {
    expect(phasesFor('concert', false)).toEqual({ announce: 40, middle: 20, final: 40 });
    expect(phasesFor('comedy', false)).toEqual({ announce: 50, middle: 10, final: 40 });
    expect(phasesFor('club', true)).toEqual({ announce: 50, middle: 10, final: 40 });
    for (const p of Object.values(SHOWS_PLAN_RULES.phases.value)) {
      expect(p.announce + p.middle + p.final).toBe(100);
    }
  });
});

describe('pacing (E2)', () => {
  it('back-loads comedy: about 6 percent in the first week and 75 in the last', () => {
    const shares = Object.fromEntries(pacingFor('comedy').map((c) => [c.key, c.share]));
    expect(shares).toEqual({ 'first-week': 6, 'final-week': 25, show: 100 });
  });

  it('puts 57 percent of tickets in the final week across other events', () => {
    const shares = Object.fromEntries(pacingFor('concert').map((c) => [c.key, c.share]));
    expect(shares).toEqual({ 'final-week': 43, show: 100 });
  });

  it('takes a target only from the team, as tickets or as a share of capacity', () => {
    expect(ticketTarget(500, { value: 80, unit: 'percent' })).toBe(400);
    expect(ticketTarget(500, { value: 350, unit: 'tickets' })).toBe(350);
    expect(ticketTarget(null, { value: 80, unit: 'percent' })).toBeNull();
    expect(ticketTarget(500, null)).toBeNull();
    expect(SHOWS_RULES.signal.value.benchmark).toBeNull();
  });
});

describe('the calendar (E1, E3, E5)', () => {
  it('opens a presale 3 to 7 days ahead behind a code and never without an end date', () => {
    const presale = beatsFor('comedy', onSaleFor('comedy', null)).find((b) => b.key === 'presale');
    expect(presale?.text).toContain('access code');
    expect(presale?.text).toContain('end date');
    expect(presale?.text).toContain('3 to 7 days');
  });

  it('ends the presale before general on sale opens, whatever window the team gave', () => {
    for (const weeks of [null, 6, 8]) {
      const beats = beatsFor('comedy', onSaleFor('comedy', weeks));
      const presale = beats.find((b) => b.key === 'presale');
      const onSale = beats.find((b) => b.key === 'on-sale');
      if (!presale || !onSale) throw new Error('Expected a presale and an on sale beat');
      expect(presale.until).toBeUndefined();
      expect(presale.at).toBeLessThan(onSale.at);
    }
  });

  it('holds the final push by intent and tells ticket holders show information', () => {
    const final = beatsFor('concert', onSaleFor('concert', null)).find(
      (b) => b.key === 'final-push',
    );
    expect(final?.text).toContain('clicked a purchase link');
    expect(final?.text).toContain('show information, not sales messages');
  });

  it('places only the final week and the night when there is no window', () => {
    expect(beatsFor('theatre', onSaleFor('theatre', null)).map((b) => b.key)).toEqual([
      'final-push',
      'show',
    ]);
  });

  it('claims nothing about taste and offers to make no asset', () => {
    for (const type of ['concert', 'comedy', 'club'] as const) {
      for (const b of beatsFor(type, onSaleFor(type, null))) {
        expect(TASTE_CLAIM.test(b.text), b.key).toBe(false);
        expect(ASSET_OFFER.test(b.text), b.key).toBe(false);
      }
    }
  });
});

describe('reading a show and picking modules', () => {
  it('reads the kind of show from the brief', () => {
    expect(showTypeFrom('A stand-up night in Lagos')).toBe('comedy');
    expect(showTypeFrom('a club night with a DJ set')).toBe('club');
    expect(showTypeFrom('A one night premiere')).toBe('screening');
    expect(showTypeFrom('Neon Tide live at the O2')).toBeNull();
    expect(showTypeFrom('a concert in London')).toBe('concert');
  });

  it('carries the on-sale and final push modules in a full plan, and one for a narrow ask', () => {
    const full = pickModules({ scope: 'full', ask: null, hasBudget: false }).modules;
    expect(full).toEqual(expect.arrayContaining(['onsale', 'finalpush', 'budget']));
    expect(pickModules({ scope: 'narrow', ask: 'venues', hasBudget: false }).modules).toEqual([
      'venues',
    ]);
    expect(pickModules({ scope: 'narrow', ask: 'tour', hasBudget: false }).modules).toEqual([]);
  });
});
