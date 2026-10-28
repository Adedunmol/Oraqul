import { describe, expect, it } from 'vitest';
import type { Clash } from './clash.js';
import { dateCalls, directionOf, territoryCalls } from './direction.js';
import { budgetFitOf, partnerOptions, tierOf, withReach } from './partners.js';
import type { QueryPlanCore } from './planner.js';

describe('directionOf', () => {
  it('maps verdicts to a direction, and gives none to what could not be tested', () => {
    expect(directionOf('holds')).toBe('okay');
    expect(directionOf('weak')).toBe('risky');
    expect(directionOf('breaks')).toBe('avoid');
    expect(directionOf('cant')).toBeNull();
  });
});

describe('dateCalls (D3, D5)', () => {
  const line = (
    date: string,
    rival: string,
    overlap: number,
    band: 'low' | 'moderate' | 'high',
  ) => ({
    id: `date-${date}-${rival}`,
    date,
    week: 0,
    rival,
    overlap,
    band,
    advice: '',
  });
  const clash: Clash = {
    lines: [
      line('2099-03-12', 'Harbor Lights', 91, 'high'),
      line('2099-03-12', 'Third Mainland', 40, 'low'),
      line('2099-03-19', 'Tidewater', 30, 'low'),
    ],
    weeks: ['2099-03-12', '2099-03-19'],
    chosen: '2099-03-19',
    missing: [],
    receipts: [],
    call: null,
    confidence: 'medium',
    why: '',
  };

  it('calls a day by its riskiest rival, with the confidence the scoring gave', () => {
    const calls = dateCalls(clash, null);
    expect(calls.map((c) => [c.name, c.direction, c.confidence])).toEqual([
      ['2099-03-12', 'avoid', 'medium'],
      ['2099-03-19', 'okay', 'medium'],
    ]);
    expect(calls[0]?.why).toContain('Do not open that week');
  });

  it('keeps the team release date and says how to handle it', () => {
    const [first] = dateCalls(clash, '2099-03-12');
    expect(first?.teamChoice).toBe(true);
    expect(first?.why).toContain('Keep the date only with a campaign');
    expect(first?.why).toContain('2099-03-19');
  });

  it('makes no call without a clash', () => {
    expect(dateCalls(null, null)).toEqual([]);
  });
});

describe('territoryCalls (D5)', () => {
  const territory = (name: string) => ({
    id: `territory-${name.toLowerCase()}`,
    name,
    role: 'other' as const,
    order: 0,
    callId: null,
    channels: [],
    partnerIds: [],
    lineIds: [],
  });
  const row = (place: string, lift: number | null, status: 'ranked' | 'not_ranked' = 'ranked') => ({
    place,
    status,
    lift,
    cells: 200,
    confidence: 'high' as const,
  });

  it('turns the place verdict into a direction and links it to the territory', () => {
    const { territories, calls } = territoryCalls(
      [territory('Lagos'), territory('London'), territory('Houston')],
      [row('Lagos', 1.4), row('London', 1.1), row('Houston', 0.8)],
      'Lagos',
    );
    expect(calls.map((c) => [c.name, c.direction])).toEqual([
      ['Lagos', 'okay'],
      ['London', 'risky'],
      ['Houston', 'avoid'],
    ]);
    expect(calls[2]?.why).toContain('Keep it, and open it after Lagos');
    expect(territories.map((t) => t.callId)).toEqual([
      'call-territory-lagos',
      'call-territory-london',
      'call-territory-houston',
    ]);
  });

  it('makes no call for a city Qloo could not rank', () => {
    const { territories, calls } = territoryCalls(
      [territory('Accra')],
      [row('Accra', null, 'not_ranked')],
      null,
    );
    expect(calls).toEqual([]);
    expect(territories[0]?.callId).toBeNull();
  });
});

describe('partner tiers (D9)', () => {
  // A brand named in `big` is ranked at flagship popularity; Qloo's popularity is what sets tier A.
  const brands = (city: string, names: string[], big: string[] = []) => ({
    id: `f-brands-${city.toLowerCase()}`,
    query: 'brands',
    text: '',
    entities: names.map((name) => ({
      entityId: null,
      name,
      affinity: 0.5,
      detail: null,
      popularity: (big.includes(name) ? 0.9 : null) as number | null,
    })),
    numbers: {},
    verdict: null,
    confidence: 'medium' as const,
    why: '',
    context: { city, ages: [], tags: [], country: null, yearFrom: null, audience: null },
    callIds: [],
  });

  it('tiers a brand Qloo ranks at flagship popularity as A and any other brand as B', () => {
    expect(tierOf(0.9)).toBe('A');
    expect(tierOf(0.5)).toBe('B');
    expect(tierOf()).toBe('B');
  });

  it('sizes the budget fit by band', () => {
    expect(budgetFitOf('micro', 'A')).toBe('out');
    expect(budgetFitOf('independent', 'A')).toBe('out');
    expect(budgetFitOf('independent', 'A', 'established')).toBe('stretch');
    expect(budgetFitOf('mid', 'A')).toBe('fits');
    expect(budgetFitOf('mid', 'A', 'solo')).toBe('out');
    expect(budgetFitOf('micro', 'B')).toBe('stretch');
    expect(budgetFitOf('micro', 'C')).toBe('fits');
  });

  it('keeps flagships for later on a micro budget, with no call, beside the local ones, and never prices one', () => {
    const { partners, calls } = partnerOptions({
      findings: [brands('Lagos', ['MTN', 'Bolt', 'Verve', 'Ride Co'], ['MTN'])],
      signed: [],
      band: 'micro',
      markets: ['Nigeria'],
      category: 'film',
    });
    const names = partners.map((p) => p.name);
    expect(partners.find((p) => p.name === 'MTN')?.budgetFit).toBe('out');
    expect(calls.find((c) => c.name === 'MTN')).toBeUndefined();
    expect(names).toContain('Bolt');
    expect(names).toContain('Cinemas');
    expect(partners.every((p) => p.price === 'unknown')).toBe(true);
    expect(partners.find((p) => p.tier === 'C')?.fit).toBeNull();
  });

  it('shows Qloo fit as a place in the ranking, and calls it', () => {
    const { partners, calls } = partnerOptions({
      findings: [brands('Lagos', ['Bolt', 'Verve', 'Ride Co', 'Cab Co', 'Eat Co', 'Pay Co'])],
      signed: [],
      band: 'mid',
      markets: ['Nigeria'],
      category: 'film',
    });
    const bolt = partners.find((p) => p.name === 'Bolt');
    expect(bolt?.fit).toEqual({ place: 1, of: 6, direction: 'okay', local: null });
    expect(calls.find((c) => c.name === 'Bolt')?.direction).toBe('okay');
    expect(partners.find((p) => p.name === 'Guinness')).toBeUndefined();
  });

  it('keeps every flagship for later for a solo launcher, even on a mid-size budget', () => {
    const { partners } = partnerOptions({
      findings: [brands('Lagos', ['MTN', 'Bolt', 'Verve', 'Ride Co'], ['MTN'])],
      signed: [],
      band: 'mid',
      launcher: 'solo',
      markets: ['Nigeria'],
      category: 'books',
    });
    const later = partners.filter((p) => p.tier === 'A');
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((p) => p.budgetFit === 'out')).toBe(true);
    expect(partners.map((p) => p.name)).toContain('Bolt');
    expect(partners.find((p) => p.name === 'Bolt')?.budgetFit).toBe('stretch');
  });

  it('puts the city place on a brand and drops a flagship the city likes as much as this audience', () => {
    const city = {
      ...brands('Lagos', ['Fanta', 'Peak', 'Bolt', 'Ride Co']),
      id: 'f-brands-city-lagos',
      query: 'brands-city',
    };
    const ranked = brands('Lagos', ['Peak', 'Bolt', 'Ride Co', 'Fanta']);
    ranked.entities[3] = { ...ranked.entities[3]!, popularity: 0.95 };
    const { partners } = partnerOptions({
      findings: [ranked, city],
      signed: [],
      band: 'mid',
      markets: ['Nigeria'],
      category: 'film',
    });
    expect(partners.find((p) => p.name === 'Fanta')).toBeUndefined();
    const peak = partners.find((p) => p.name === 'Peak');
    expect(peak?.fit?.local).toEqual({ place: 2, of: 4 });
    expect(peak?.findingIds).toEqual([ranked.id, 'f-brands-city-lagos']);
  });

  it('does not offer a brand Qloo ranks against this audience, unless the team named it', () => {
    const findings = [brands('Lagos', ['Bolt', 'Verve', 'Ride Co', 'Cab Co', 'Eat Co', 'Pay Co'])];
    const base = {
      findings,
      band: 'mid' as const,
      markets: ['Nigeria'],
      category: 'film' as const,
    };
    const offered = partnerOptions({ ...base, signed: [] });
    expect(offered.partners.find((p) => p.name === 'Pay Co')).toBeUndefined();
    expect(offered.calls.find((c) => c.name === 'Pay Co')).toBeUndefined();
    const named = partnerOptions({ ...base, signed: ['Pay Co'] });
    expect(named.calls.find((c) => c.name === 'Pay Co')?.direction).toBe('avoid');
  });

  it('keeps a partner the team signed, whatever the band', () => {
    const { partners, calls } = partnerOptions({
      findings: [
        brands('Lagos', ['Bolt', 'Verve', 'Ride Co', 'Cab Co', 'Eat Co', 'Pay Co', 'Guinness']),
      ],
      signed: ['Guinness'],
      band: 'micro',
      markets: ['Nigeria'],
      category: 'film',
    });
    expect(partners.find((p) => p.name === 'Guinness')?.from).toBe('team');
    const call = calls.find((c) => c.name === 'Guinness');
    expect(call?.direction).toBe('avoid');
    expect(call?.teamChoice).toBe(true);
    expect(call?.why).toContain('Keep it');
  });
});

describe('withReach', () => {
  const plan = {
    brandCandidates: [{ city: 'Lagos', names: ['Bolt'] }],
  } as unknown as QueryPlanCore;

  it('adds no brand of its own: only the team and the model name candidates', () => {
    const mid = withReach(plan, 'mid', ['Lagos', 'London']).brandCandidates;
    expect(mid).toEqual([{ city: 'Lagos', names: ['Bolt'] }]);
  });

  it('lets an independent budget ask for flagships only when an established launcher can stretch', () => {
    expect(withReach(plan, 'independent', ['Lagos']).reach).toEqual({ flagship: false });
    expect(withReach(plan, 'independent', ['Lagos'], 'established').reach).toEqual({
      flagship: true,
    });
  });

  it('leaves flagships out for a solo launcher whatever the budget', () => {
    expect(withReach(plan, 'major', ['Lagos'], 'solo').reach).toEqual({ flagship: false });
  });

  it('leaves flagships out for a micro budget', () => {
    expect(withReach(plan, 'micro', ['Lagos']).reach).toEqual({ flagship: false });
  });
});
