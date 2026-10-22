import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, testClient } from '../qloo/fake-fetch';
import { findTasteOutputSchema } from './find-taste';
import { gameProfilesOutputSchema } from './game-profiles';
import { tools } from './index';
import { rivalTypeOf, scoreRivalsOutputSchema } from './score-rivals';
import type { SeenEntity, ToolContext } from './tool';

function context(): ToolContext {
  return { qloo: testClient(), source: 'demo', entities: new Map<string, SeenEntity>() };
}

function sentParams(fetch: ReturnType<typeof stubFetch>, call = 0): URLSearchParams {
  const url = fetch.mock.calls[call]?.[0];
  return new URL(String(url)).searchParams;
}

afterEach(() => vi.unstubAllGlobals());

describe('scoreRivals', () => {
  it('scores the rivals as the type it was given, in one call when asked not to rerun', async () => {
    const fetch = stubFetch(
      jsonResponse({
        success: true,
        results: {
          entities: [
            { entity_id: 'G2', name: 'Rival Quest', query: { affinity: 0.9 } },
            { entity_id: 'G3', name: 'Far Away', query: { affinity: 0.1 } },
          ],
        },
      }),
    );
    const { data } = await tools.scoreRivals.run(context(), {
      entityIds: ['G1', 'A1', 'A2'],
      type: 'urn:entity:videogame',
      rivals: ['G2', 'G3'],
      leaveOneOut: false,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sentParams(fetch).get('filter.type')).toBe('urn:entity:videogame');
    const out = scoreRivalsOutputSchema.parse(data);
    expect(out.rivals.map((r) => [r.name, r.overlap, r.band])).toEqual([
      ['Rival Quest', 90, 'risky'],
      ['Far Away', 10, 'low'],
    ]);
  });

  it('picks the first rival type Qloo can score', () => {
    expect(rivalTypeOf(['urn:entity:artist'])).toBe('urn:entity:artist');
    expect(rivalTypeOf(['urn:entity:place', 'urn:entity:movie'])).toBe('urn:entity:movie');
    expect(rivalTypeOf(['urn:entity:place'])).toBeUndefined();
  });
});

describe('findTaste', () => {
  it('asks for video games and people like any other type', async () => {
    const fetch = stubFetch(
      jsonResponse({
        success: true,
        results: {
          entities: [{ entity_id: 'G9', name: 'Hollow Hills', query: { affinity: 0.6 } }],
        },
      }),
    );
    const { data } = await tools.findTaste.run(context(), {
      entityIds: ['G1'],
      type: 'urn:entity:videogame',
      tags: ['urn:tag:genre:media:roguelike'],
    });
    expect(sentParams(fetch).get('filter.type')).toBe('urn:entity:videogame');
    expect(findTasteOutputSchema.parse(data).candidates.map((c) => c.name)).toEqual([
      'Hollow Hills',
    ]);
  });
});

describe('gameProfiles', () => {
  it('reads platforms, rating and tag groups, and says nothing is scored', async () => {
    stubFetch(
      jsonResponse({
        success: true,
        results: [
          {
            entity_id: 'G1',
            name: 'Ember Keep',
            popularity: 0.36,
            properties: {
              platforms: ['PC (Windows)', 'Nintendo Switch'],
              content_rating: 'T',
              developer: 'Cinder Works',
            },
            tags: [
              { type: 'urn:tag:gameplay_type:qloo', name: 'Single-player' },
              { type: 'urn:tag:gameplay_type:qloo', name: 'Single-player' },
              { type: 'urn:tag:emotional_tone:qloo', name: 'tense' },
              { type: 'urn:tag:category:qloo', name: 'Roguelite' },
              { type: 'urn:tag:other:qloo', name: 'ignored' },
            ],
          },
          { entity_id: 'G2', name: 'Bare Game', popularity: null },
        ],
      }),
    );
    const ctx = context();
    const { data, receipts } = await tools.gameProfiles.run(ctx, { entityIds: ['G1', 'G2'] });
    const out = gameProfilesOutputSchema.parse(data);
    expect(out.games[0]).toMatchObject({
      platforms: ['PC (Windows)', 'Nintendo Switch'],
      contentRating: 'T',
      tags: {
        gameplay_type: ['Single-player'],
        emotional_tone: ['tense'],
        category: ['Roguelite'],
      },
    });
    expect(out.games[1]?.platforms).toEqual([]);
    expect(receipts).toHaveLength(1);
    expect(ctx.entities.get('G1')?.popularity).toBe(0.36);
  });

  it('is cannot test when no game has data', async () => {
    stubFetch(jsonResponse({ success: true, results: [{ entity_id: 'G2', name: 'Bare Game' }] }));
    const { data } = await tools.gameProfiles.run(context(), { entityIds: ['G2'] });
    expect(gameProfilesOutputSchema.parse(data).confidence).toBe('lower');
  });
});
