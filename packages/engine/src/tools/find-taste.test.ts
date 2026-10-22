import { afterEach, describe, expect, it, vi } from 'vitest';
import { entityInsightsBody, jsonResponse, stubFetch, testClient } from '../qloo/fake-fetch';
import { tools } from './index';
import type { SeenEntity, ToolContext } from './tool';

afterEach(() => vi.unstubAllGlobals());

const context = (): ToolContext => ({
  qloo: testClient(),
  source: 'demo',
  entities: new Map<string, SeenEntity>(),
});

async function sent(input: Record<string, unknown>) {
  const fetch = stubFetch(jsonResponse(entityInsightsBody));
  await tools.findTaste.run(context(), { entityIds: ['A1'], ...input });
  return new URL(String(fetch.mock.calls[0]?.[0])).searchParams;
}

describe('findTaste shaping', () => {
  it('sends the gender of the audience', async () => {
    const params = await sent({ type: 'urn:entity:movie', gender: 'female' });
    expect(params.get('signal.demographics.gender')).toBe('female');
  });

  it('keeps films and series to family or adult-only ratings', async () => {
    const family = await sent({ type: 'urn:entity:movie', rating: 'family' });
    expect(family.get('filter.content_rating')).toBe('G,PG,TV-G,TV-PG,TV-Y,TV-Y7');
    const adult = await sent({ type: 'urn:entity:tv_show', rating: 'adult' });
    expect(adult.get('filter.content_rating')).toBe('R,NC-17,TV-MA');
  });

  it('does not send a rating for a type it does not apply to', async () => {
    const params = await sent({ type: 'urn:entity:artist', rating: 'adult' });
    expect(params.has('filter.content_rating')).toBe(false);
  });

  it('sends a popularity band with its floor and its cap', async () => {
    const params = await sent({
      type: 'urn:entity:brand',
      popularity: { min: 0.4, max: 0.85 },
    });
    expect(params.get('filter.popularity.min')).toBe('0.4');
    expect(params.get('filter.popularity.max')).toBe('0.85');
  });

  it('asks with no anchors for a city and an age band, and sends no signal title', async () => {
    const params = await sent({
      entityIds: [],
      type: 'urn:entity:artist',
      city: 'Lagos',
      ages: ['25_to_29', '30_to_34'],
    });
    expect(params.has('signal.interests.entities')).toBe(false);
    expect(params.has('filter.exclude.entities')).toBe(false);
    expect(params.get('signal.location.query')).toBe('Lagos');
    expect(params.get('signal.demographics.age')).toBe('25_to_29,30_to_34');
  });

  it('refuses no anchors without both a city and an age band', async () => {
    stubFetch(jsonResponse(entityInsightsBody));
    await expect(
      tools.findTaste.run(context(), { entityIds: [], type: 'urn:entity:artist', city: 'Lagos' }),
    ).rejects.toThrow('needs an anchor');
    await expect(
      tools.findTaste.run(context(), {
        entityIds: [],
        type: 'urn:entity:artist',
        ages: ['25_to_29'],
      }),
    ).rejects.toThrow('needs an anchor');
  });
});
