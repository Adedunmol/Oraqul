import type { Finding, LaunchPlan } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import {
  brandsFrom,
  flagshipNames,
  flagsOf,
  marketsOf,
  partnerKit,
  partnerNotes,
  partnerOptions,
  tierOf,
  toneOf,
  withTeamBrands,
  withTeamPartners,
} from './partners.js';
import type { QueryPlanCore } from './planner.js';

const brands = (city: string, names: string[], popularity: number | null = null): Finding => ({
  id: `f-brands-${city}`,
  query: 'brands',
  text: '',
  entities: names.map((name) => ({
    entityId: null,
    name,
    affinity: 0.5,
    detail: null,
    popularity,
  })),
  numbers: {},
  verdict: null,
  confidence: 'medium',
  why: '',
  context: { city, ages: [], tags: [], country: null, yearFrom: null, audience: null },
  callIds: [],
});

const base = { signed: [], band: 'mid' as const, category: 'film' as const };

describe('partner market', () => {
  it('gives a ranked partner the country of the city it was ranked in, and a seed its own market', () => {
    const { partners } = partnerOptions({
      ...base,
      findings: [brands('London', ['Revolut'])],
      markets: ['Nigeria', 'United Kingdom'],
      home: 'Nigeria',
    });
    expect(partners.find((p) => p.name === 'Revolut')?.market).toBe('United Kingdom');
    expect(partners.find((p) => p.name === 'EE')?.market).toBe('United Kingdom');
    expect(partners.find((p) => p.name === 'MTN')?.market).toBe('Nigeria');
  });

  it('lists seeds only for the markets the plan reaches', () => {
    const { partners } = partnerOptions({
      ...base,
      findings: [],
      markets: marketsOf(null, ['London']),
      home: 'United Kingdom',
    });
    const names = partners.map((p) => p.name);
    expect(names).toContain('EE');
    expect(names).not.toContain('MTN');
    expect(names).not.toContain('Lyft');
  });
});

describe('partner tier', () => {
  it('puts a mass-market ranked brand in tier A and a mid-size one in tier B', () => {
    expect(tierOf('Coca-Cola', 0.97)).toBe('A');
    expect(tierOf('Ride Co', 0.5)).toBe('B');
    expect(tierOf('Ride Co')).toBe('B');
    expect(tierOf('Guinness')).toBe('A');
  });

  it('names mass-market brands as flagships for the line check', () => {
    expect(flagshipNames([brands('Lagos', ['Coca-Cola'], 0.95)])).toContain('Coca-Cola');
    expect(flagshipNames([brands('Lagos', ['Ride Co'], 0.5)])).not.toContain('Ride Co');
  });
});

describe('reserved slots', () => {
  it('keeps the local partners even when many brands are ranked', () => {
    const many = Array.from({ length: 20 }, (_, i) => `Brand ${i}`);
    const { partners } = partnerOptions({
      ...base,
      findings: [brands('Lagos', many, 0.5)],
      markets: ['Nigeria'],
      home: 'Nigeria',
    });
    expect(partners.length).toBeLessThanOrEqual(14);
    expect(partners.filter((p) => p.tier === 'C').length).toBeGreaterThanOrEqual(3);
    expect(partners.filter((p) => p.tier === 'B').length).toBeLessThanOrEqual(7);
  });

  it('gives each category its own local kinds', () => {
    const kindsOf = (category: 'books' | 'games') =>
      partnerOptions({ ...base, category, findings: [], markets: ['United Kingdom'] })
        .partners.filter((p) => p.tier === 'C')
        .map((p) => p.name);
    expect(kindsOf('books')).toContain('Bookshops');
    expect(kindsOf('games')).toContain('Streamers');
    expect(kindsOf('games')).not.toContain('Bookshops');
  });
});

describe('content fit', () => {
  it('reads a tone only from the line the team gave', () => {
    expect(toneOf('Content rating or tone: R, violent crime')).toBe('adult');
    expect(toneOf('Content rating or tone: a family adventure')).toBe('family');
    expect(toneOf('A violent crime thriller')).toBeNull();
    expect(toneOf('A violent crime thriller', 'adult')).toBe('adult');
  });

  it('flags a flagship beside adult content, and a drinks brand for a young audience', () => {
    const adultFlag = flagsOf({ name: 'MTN', tier: 'A', kind: 'brand', tone: 'adult', ages: [] });
    expect(adultFlag.map((f) => f.type)).toEqual(['backlash']);
    const drinks = flagsOf({
      name: 'Guinness',
      tier: 'A',
      kind: 'brand',
      tone: null,
      ages: ['24_and_younger'],
    });
    expect(drinks.map((f) => f.type)).toEqual(['content']);
    expect(flagsOf({ name: 'Ride Co', tier: 'B', kind: 'brand', tone: null, ages: [] })).toEqual(
      [],
    );
  });

  it('keeps a flagged partner in the list', () => {
    const { partners } = partnerOptions({
      ...base,
      findings: [],
      markets: ['Nigeria'],
      home: 'Nigeria',
      tone: 'adult',
    });
    const mtn = partners.find((p) => p.name === 'MTN');
    expect(mtn?.flags.length).toBeGreaterThan(0);
  });
});

describe('partner notes (T1)', () => {
  it('says plainly when the release is closer than 18 months', () => {
    const notes = partnerNotes({ release: '2027-03-01', today: '2026-10-23', band: 'independent' });
    expect(notes[0]?.text).toContain('short of the 18 months');
    expect(notes.some((n) => n.text.includes('tier B and tier C'))).toBe(true);
    expect(notes.at(-1)?.text).toContain('Never assume a cash sponsorship');
    expect(notes.every((n) => n.ruleId === 'partners.lead-time')).toBe(true);
  });

  it('adds no independent note for a major band, and none about dates without a release', () => {
    const notes = partnerNotes({ release: null, today: '2026-10-23', band: 'major' });
    expect(notes.map((n) => n.id)).toEqual(['partner-note-barter']);
  });
});

describe('the team’s own partners on a saved plan', () => {
  const planWith = (names: string[]): LaunchPlan => {
    const findings = [brands('Lagos', ['Bolt', 'Verve', 'Ride Co'], 0.5)];
    const built = partnerOptions({
      ...base,
      findings,
      signed: names,
      markets: ['Nigeria'],
      home: 'Nigeria',
    });
    return {
      scope: 'full',
      sections: [],
      comps: [],
      findings,
      sources: [],
      dropped: [],
      writer: 'template',
      understanding: null,
      review: null,
      process: null,
      rules: null,
      band: { band: 'mid', source: 'brief' },
      signal: null,
      territories: [
        {
          id: 't-lagos',
          name: 'Lagos',
          role: 'home',
          order: 0,
          callId: null,
          channels: [],
          partnerIds: [],
          lineIds: [],
        },
      ],
      calls: built.calls,
      partners: built.partners,
      partnerNotes: [],
      calendar: [],
      opportunities: [],
    };
  };

  it('adds a partner Qloo ranked with its place, and one it did not as not ranked', () => {
    const next = withTeamPartners(planWith([]), ['Verve', 'Corner Cafe'], 'film');
    const verve = next.partners.find((p) => p.name === 'Verve');
    expect(verve).toMatchObject({ from: 'team', fit: { place: 2, of: 3 } });
    expect(next.partners.find((p) => p.name === 'Corner Cafe')).toMatchObject({
      from: 'team',
      fit: null,
    });
    expect(next.calls.filter((c) => c.name === 'Verve')).toHaveLength(1);
    expect(next.territories[0]?.partnerIds).toContain('partner-verve');
  });

  it('removes only the team’s partners, and leaves Oraqul’s suggestions alone', () => {
    const before = planWith(['Corner Cafe']);
    const next = withTeamPartners(before, [], 'film');
    expect(next.partners.some((p) => p.name === 'Corner Cafe')).toBe(false);
    expect(next.partners.some((p) => p.name === 'MTN')).toBe(true);
    expect(next.partners.every((p) => p.from !== 'team')).toBe(true);
  });

  it('keeps every partner the team named, whatever the slots', () => {
    const names = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'];
    const next = withTeamPartners(planWith([]), names, 'film');
    expect(next.partners.filter((p) => p.from === 'team')).toHaveLength(names.length);
  });
});

describe('the partner pitch kit (T3, T4)', () => {
  const kit = (release: string | null) =>
    partnerKit({
      name: 'Page Turner Coffee',
      category: 'books',
      why: { text: 'Page Turner Coffee ranks 1 of 4.', findingIds: ['f-brands-london'] },
      script: 'Hi team',
      release,
      today: '2026-10-23',
    });

  it('names what the partner gets, the ask, a timeline, one or two ideas and a script', () => {
    const k = kit('2027-06-01');
    expect(k.why.findingIds).toEqual(['f-brands-london']);
    expect(k.gets.length).toBeGreaterThan(0);
    expect(k.ask).toContain('Page Turner Coffee');
    expect(k.ask).toContain('cash');
    expect(k.timeline[0]).toContain('2026-10-23');
    expect(k.timeline.some((t) => t.includes('2027-06-01'))).toBe(true);
    expect(k.ideas.length).toBeGreaterThanOrEqual(1);
    expect(k.ideas.length).toBeLessThanOrEqual(2);
    expect(k.script).toBe('Hi team');
  });

  it('leaves the partner room to shape the idea, and says the date plainly when there is none', () => {
    const k = kit(null);
    expect(k.room).toContain('leave the creative open');
    expect(k.timeline.some((t) => t.startsWith('Release:'))).toBe(true);
  });

  it('claims nothing about taste or assets outside the one grounded line', () => {
    const k = kit('2027-06-01');
    for (const t of [...k.gets, k.ask, ...k.timeline, ...k.ideas, k.room]) {
      expect(/\b(fans?|loves?|likes?|affinity|taste)\b/i.test(t), t).toBe(false);
    }
  });
});

describe('the brands the team already knows', () => {
  it('reads the labelled line, de-duplicated and capped', () => {
    expect(brandsFrom('Brands to consider: Guinness, Indomie and Guinness.')).toEqual([
      'Guinness',
      'Indomie',
    ]);
    expect(brandsFrom('Nothing here.')).toEqual([]);
  });

  it('puts them first among the candidates Qloo ranks in every city', () => {
    const plan = {
      cities: ['Lagos', 'London'],
      brandCandidates: [{ city: 'Lagos', names: ['Bolt', 'Guinness'] }],
    } as unknown as QueryPlanCore;
    const next = withTeamBrands(plan, ['Guinness', 'Verve']).brandCandidates;
    expect(next.find((c) => c.city === 'Lagos')?.names).toEqual(['Guinness', 'Verve', 'Bolt']);
    expect(next.find((c) => c.city === 'London')?.names).toEqual(['Guinness', 'Verve']);
    expect(withTeamBrands(plan, [])).toBe(plan);
  });
});
