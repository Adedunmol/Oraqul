import { randomUUID } from 'node:crypto';
import { type Receipt, receiptSchema } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { demoFetch, QlooClient } from '../qloo';
import { liftBand } from '../scoring';
import { findTasteOutputSchema } from './find-taste';
import { tools } from './index';
import { leaveOneOut } from './leave-one-out';
import { liftOutputSchema } from './lift';
import { rankPlacesOutputSchema } from './rank-places';
import { resolveBundleOutputSchema, sameTitle } from './resolve-bundle';
import { resolveTagsOutputSchema } from './resolve-tags';
import { themeTagsOutputSchema } from './theme-tags';
import type { SeenEntity, ToolContext } from './tool';

const films = ['DEMO-FILM-0001', 'DEMO-FILM-0003', 'DEMO-FILM-0004'];

function demoContext(callBudget?: number): ToolContext {
  const qloo = new QlooClient({
    baseUrl: 'https://demo.invalid',
    apiKey: 'demo',
    fetch: demoFetch,
    callBudget,
  });
  return { qloo, source: 'demo', entities: new Map<string, SeenEntity>() };
}

/** A context that already searched the three demo films, as a pipeline would have. */
function searched(callBudget?: number): ToolContext {
  const ctx = demoContext(callBudget);
  ctx.entities.set('DEMO-FILM-0001', { name: 'Midnight Harbor', popularity: 0.31 });
  ctx.entities.set('DEMO-FILM-0003', { name: 'Salt Road', popularity: 0.44 });
  ctx.entities.set('DEMO-FILM-0004', { name: 'The Glass Lantern', popularity: 0.09 });
  return ctx;
}

describe('resolveBundle', () => {
  it('keeps exact matches only, and says which need a pick or were not found', async () => {
    const ctx = demoContext();
    const { data, receipts } = await tools.resolveBundle.run(ctx, {
      names: ['Salt Road', 'Midnight Harbor', 'Lagos Nights'],
      types: ['urn:entity:movie', 'urn:entity:tv_show'],
    });
    const out = resolveBundleOutputSchema.parse(data);
    expect(out.anchors.map((a) => [a.name, a.status])).toEqual([
      ['Salt Road', 'found'],
      ['Midnight Harbor', 'ambiguous'],
      ['Lagos Nights', 'not_found'],
    ]);
    expect(out.entityIds).toEqual(['DEMO-FILM-0003']);
    expect(out.anchors[1]?.candidates).toHaveLength(2);
    expect(receipts).toHaveLength(3);
    for (const r of receipts) receiptSchema.parse(r);
    expect(ctx.entities.get('DEMO-FILM-0003')?.popularity).toBe(0.44);
  });
});

describe('sameTitle', () => {
  it('ignores case, spacing and the style of apostrophes', () => {
    expect(
      sameTitle('Elesin Oba: The King\u2019s Horseman', "elesin oba:  the king's horseman"),
    ).toBe(true);
    expect(sameTitle('Lionheart', 'Lionhearts')).toBe(false);
  });
});

describe('rankPlaces', () => {
  it('ranks known cities from one call, reruns each anchor left out, and skips unknown ones', async () => {
    const { data, receipts } = await tools.rankPlaces.run(searched(), {
      entityIds: films,
      places: ['Lagos', 'London', 'Atlantis'],
    });
    const out = rankPlacesOutputSchema.parse(data);
    const lagos = out.places.find((p) => p.place === 'Lagos');
    expect(lagos).toMatchObject({ status: 'ranked', cells: 120 });
    expect(out.places.map((p) => p.rank).sort()).toEqual([1, 2, null]);
    expect(out.places.find((p) => p.place === 'Atlantis')).toMatchObject({
      status: 'unknown_place',
      confidence: 'lower',
    });
    // The main call and one rerun per anchor.
    expect(receipts).toHaveLength(4);
    expect(receipts[0]?.callId).toBe(out.receiptId);
  });

  it('caps confidence at medium when the budget does not cover leave one out', async () => {
    const { data, receipts } = await tools.rankPlaces.run(searched(2), {
      entityIds: films,
      places: ['Lagos', 'London'],
    });
    const out = rankPlacesOutputSchema.parse(data);
    expect(receipts).toHaveLength(1);
    for (const place of out.places) {
      expect(place.confidence).not.toBe('high');
    }
    expect(out.places.some((p) => p.why.includes('budget'))).toBe(true);
  });

  it('makes no call when no city is in the table', async () => {
    const { data, receipts } = await tools.rankPlaces.run(searched(), {
      entityIds: films,
      places: ['Atlantis'],
    });
    expect(receipts).toEqual([]);
    expect(rankPlacesOutputSchema.parse(data).receiptId).toBeNull();
  });
});

describe('lift', () => {
  it('computes lift in code from one scoring call', async () => {
    const { data, receipts } = await tools.lift.run(searched(), {
      entityIds: films,
      type: 'urn:entity:movie',
      candidates: ['DEMO-FILM-0002'],
      baseline: ['DEMO-BOOK-0001'],
    });
    const out = liftOutputSchema.parse(data);
    const kind = out.candidates[0]?.affinity ?? Number.NaN;
    const base = out.baseline[0]?.affinity ?? Number.NaN;
    expect(out.lift).toBeCloseTo(kind / base, 10);
    expect(out.band).toBe(liftBand(kind / base));
    expect(receipts).toHaveLength(4);
  });

  it('cannot test when the baseline comes back without scores', async () => {
    const { data } = await tools.lift.run(searched(), {
      entityIds: films,
      type: 'urn:entity:movie',
      candidates: ['DEMO-FILM-0002'],
      baseline: ['NOT-IN-QLOO'],
    });
    const out = liftOutputSchema.parse(data);
    expect(out).toMatchObject({ lift: null, band: null, confidence: 'lower' });
  });
});

describe('leaveOneOut', () => {
  const receipt = (): Receipt => ({
    callId: randomUUID(),
    endpoint: '/v2/insights',
    input: {},
    returned: null,
    rule: 'rerun',
    confidence: 'medium',
    calledAt: new Date().toISOString(),
    source: 'demo',
  });
  const compare = {
    same: (a: string, b: string) => a === b,
    moved: (a: string, b: string) => a !== b,
  };

  it('names the anchor the answer rests on', async () => {
    const ctx = searched();
    const result = await leaveOneOut(
      ctx,
      films,
      'Lagos',
      async (_without, left) => ({
        value: left === 'DEMO-FILM-0003' ? 'London' : 'Lagos',
        receipt: receipt(),
      }),
      compare,
    );
    expect(result.check).toEqual({ result: 'changes', restsOn: 'Salt Road' });
    expect(result.contributing).toEqual(['DEMO-FILM-0003']);
    expect(result.receipts).toHaveLength(3);
  });

  it('holds when no anchor changes the answer', async () => {
    const result = await leaveOneOut(
      searched(),
      films,
      'Lagos',
      async () => ({
        value: 'Lagos',
        receipt: receipt(),
      }),
      compare,
    );
    expect(result.check).toEqual({ result: 'holds' });
  });

  it('does not run with fewer than 3 anchors', async () => {
    const result = await leaveOneOut(
      searched(),
      films.slice(0, 2),
      'Lagos',
      async () => {
        throw new Error('should not rerun');
      },
      compare,
    );
    expect(result).toEqual({ contributing: films.slice(0, 2), check: undefined, receipts: [] });
  });
});

describe('findTaste', () => {
  it('sends the context it was given and keeps what matched it', async () => {
    const ctx = searched();
    const urls: string[] = [];
    ctx.qloo = new QlooClient({
      baseUrl: 'https://demo.invalid',
      apiKey: 'demo',
      fetch: async (input, init) => {
        urls.push(String(input instanceof Request ? input.url : input));
        return demoFetch(input, init);
      },
    });
    const { data, receipts } = await tools.findTaste.run(ctx, {
      entityIds: films,
      type: 'urn:entity:place',
      tags: ['urn:tag:category:place:movie_theater'],
      city: 'Lagos',
    });
    const out = findTasteOutputSchema.parse(data);
    expect(out.candidates.map((c) => c.name).sort()).toEqual([
      'Lekki Screens',
      'Marina Picturehouse',
    ]);
    const sent = new URL(urls[0] ?? '').searchParams;
    expect(sent.get('filter.location.query')).toBe('Lagos');
    expect(sent.get('signal.location.query')).toBeNull();
    expect(receipts).toHaveLength(1);
  });

  it('filters films by release country with the full name', async () => {
    const { data } = await tools.findTaste.run(searched(), {
      entityIds: films,
      type: 'urn:entity:movie',
      country: 'Nigeria',
    });
    const names = findTasteOutputSchema.parse(data).candidates.map((c) => c.name);
    expect(names.sort()).toEqual(['Harbor Lights', 'Third Mainland']);
  });
});

describe('resolveTags', () => {
  it('keeps the first tag in the wanted namespace, and null when there is none', async () => {
    const { data, receipts } = await tools.resolveTags.run(demoContext(), {
      phrases: [
        { phrase: 'afrobeats', prefix: 'urn:tag:genre:music' },
        { phrase: 'telecom', prefix: 'urn:tag:genre:brand', parent: 'urn:entity:brand' },
        { phrase: 'telecom', prefix: 'urn:tag:theme:qloo' },
      ],
    });
    const out = resolveTagsOutputSchema.parse(data);
    expect(out.tags.map((t) => t.tagId)).toEqual([
      'urn:tag:genre:music:afrobeats',
      'urn:tag:genre:brand:telecom',
      null,
    ]);
    expect(receipts).toHaveLength(3);
  });
});

describe('themeTags', () => {
  it('asks one tag type per kind', async () => {
    const { data, receipts } = await tools.themeTags.run(searched(), {
      entityIds: films,
      kinds: ['theme', 'archetype'],
    });
    const out = themeTagsOutputSchema.parse(data);
    expect(out.kinds.map((k) => k.kind)).toEqual(['theme', 'archetype']);
    expect(out.kinds[0]?.tags.length).toBeGreaterThan(0);
    expect(receipts).toHaveLength(2);
  });
});
