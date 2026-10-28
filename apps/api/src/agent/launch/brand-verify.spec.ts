import type { Finding, PartnerCheck } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { type BrandPresence, presenceKey } from '../../verify/brand-presence.js';
import { type VenueCheck, venueKey } from '../../verify/venue-check.js';
import type { Verifier } from '../../verify/verifier.js';
import { brandNames, verifyBrands, verifyVenues } from './brand-verify.js';
import type { Grounded } from './findings.js';

const brands = (city: string, names: string[], query = 'brands'): Finding => ({
  id: `f-${query}-${city}`,
  query,
  text: `People in ${city} like ${names.join(', ')}.`,
  entities: names.map((name) => ({
    entityId: null,
    name,
    affinity: 0.5,
    detail: null,
    popularity: null,
  })),
  numbers: {},
  verdict: null,
  confidence: 'medium',
  why: '',
  context: { city, ages: [], tags: [], country: null, yearFrom: null, audience: null },
  callIds: [],
});

const grounded = (findings: Finding[]) => ({ findings }) as unknown as Grounded;
const says = (
  answers: Record<string, PartnerCheck['state']> = {},
  venues: Record<string, VenueCheck['state']> = {},
  sells: Record<string, BrandPresence['state']> = {},
  based: Record<string, string> = {},
): Verifier => ({
  async presence(items) {
    return new Map(
      items.map((i) => [
        presenceKey(i.name, i.country),
        {
          state: sells[`${i.name}|${i.country}`] ?? 'unknown',
          source: sells[`${i.name}|${i.country}`]
            ? { title: 'Page', url: 'https://example.test/p' }
            : null,
        } as BrandPresence,
      ]),
    );
  },
  async brands(names) {
    return new Map(
      names.map((n) => [
        n,
        {
          state: answers[n] ?? 'unverified',
          note: null,
          country: based[n] ?? null,
          operates: [],
        } as PartnerCheck,
      ]),
    );
  },
  async venues(items) {
    return new Map(
      items.map((v) => [
        venueKey(v),
        { state: venues[v.name] ?? 'unverified', kind: null } as VenueCheck,
      ]),
    );
  },
});

describe('verifyBrands', () => {
  const atlanta = brands('Atlanta', ['Green Dot Bank', 'SunTrust Banks', 'Chime']);

  it('takes a closed brand out of the findings and rewords the sentence that named it', async () => {
    const out = await verifyBrands(says({ 'SunTrust Banks': 'problem' }), grounded([atlanta]));
    const [f] = out.grounded.findings;
    expect(f?.entities.map((e) => e.name)).toEqual(['Green Dot Bank', 'Chime']);
    expect(f?.text).not.toContain('SunTrust');
    expect(f?.text).toContain('Green Dot Bank');
    expect(out.checks['SunTrust Banks']?.state).toBe('problem');
  });

  it('takes a brand out of a city when a page says it does not sell there', async () => {
    const accra = brands('Accra', ['Cell C', 'MTN Ghana']);
    const out = await verifyBrands(
      says({}, {}, { 'Cell C|Ghana': 'absent', 'MTN Ghana|Ghana': 'present' }),
      grounded([accra]),
    );
    expect(out.grounded.findings[0]?.entities.map((e) => e.name)).toEqual(['MTN Ghana']);
    expect(out.grounded.findings[0]?.text).not.toContain('Cell C');
    expect(out.checks['MTN Ghana']?.operates).toEqual([
      { country: 'Ghana', title: 'Page', url: 'https://example.test/p' },
    ]);
  });

  it('never removes a brand the team named, even when a page says it does not sell there', async () => {
    const accra = brands('Accra', ['Cell C', 'MTN Ghana']);
    const out = await verifyBrands(says({}, {}, { 'Cell C|Ghana': 'absent' }), grounded([accra]), [
      'cell c',
    ]);
    expect(out.grounded.findings[0]?.entities).toHaveLength(2);
  });

  it('does not look up a brand Wikidata places in the country it was ranked for', async () => {
    const accra = brands('Accra', ['MTN Ghana']);
    const out = await verifyBrands(
      says(
        { 'MTN Ghana': 'verified' },
        {},
        { 'MTN Ghana|Ghana': 'absent' },
        { 'MTN Ghana': 'Ghana' },
      ),
      grounded([accra]),
    );
    expect(out.grounded.findings[0]?.entities).toHaveLength(1);
  });

  it('keeps unverified brands: a brand the source cannot place is never dropped', async () => {
    const out = await verifyBrands(says({}), grounded([atlanta]));
    expect(out.grounded.findings[0]?.entities).toHaveLength(3);
  });

  it('removes a finding when every brand in it has closed', async () => {
    const only = brands('Atlanta', ['SunTrust Banks']);
    const out = await verifyBrands(says({ 'SunTrust Banks': 'problem' }), grounded([only]));
    expect(out.grounded.findings).toHaveLength(0);
  });

  it('leaves other findings and the findings untouched with no checker', async () => {
    const other = { ...atlanta, query: 'markets', id: 'f-markets' };
    const g = grounded([other]);
    expect((await verifyBrands(undefined, g)).grounded).toBe(g);
    const out = await verifyBrands(says({ 'SunTrust Banks': 'problem' }), g);
    expect(out.grounded.findings[0]?.entities).toHaveLength(3);
  });

  it('lists each brand name once across the brand findings', () => {
    const city = brands('Atlanta', ['Chime', 'Lyft'], 'brands-city');
    expect(brandNames([atlanta, city])).toEqual([
      'Green Dot Bank',
      'SunTrust Banks',
      'Chime',
      'Lyft',
    ]);
  });
});

describe('verifyVenues', () => {
  const cinemas = {
    ...brands('Los Angeles', ['Dolby Theatre', 'IPIC Theaters', 'The Egyptian Theatre']),
    query: 'venues',
    context: {
      city: 'Los Angeles',
      ages: [],
      tags: ['movie theater'],
      country: null,
      yearFrom: null,
      audience: null,
    },
  } as Finding;

  it('takes out a place the map shows is a stage theatre, and rewords the sentence', async () => {
    const out = await verifyVenues(says({}, { 'Dolby Theatre': 'problem' }), grounded([cinemas]));
    const [f] = out.grounded.findings;
    expect(f?.entities.map((e) => e.name)).toEqual(['IPIC Theaters', 'The Egyptian Theatre']);
    expect(f?.text).not.toContain('Dolby');
    expect(out.removed).toEqual(['Dolby Theatre']);
  });

  it('keeps a venue the map cannot place', async () => {
    const out = await verifyVenues(says(), grounded([cinemas]));
    expect(out.grounded.findings[0]?.entities).toHaveLength(3);
    expect(out.removed).toEqual([]);
  });

  it('only looks at cinema lists, not other places', async () => {
    const clubs = { ...cinemas, context: { ...cinemas.context, tags: ['night club'] } } as Finding;
    const out = await verifyVenues(says({}, { 'Dolby Theatre': 'problem' }), grounded([clubs]));
    expect(out.grounded.findings[0]?.entities).toHaveLength(3);
  });

  it('changes nothing with no checker', async () => {
    const g = grounded([cinemas]);
    expect((await verifyVenues(undefined, g)).grounded).toBe(g);
  });
});
