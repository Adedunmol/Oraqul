import { QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import type { Receipt } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { type GroundKit, regionSeeds } from './findings.js';
import type { QueryPlanCore } from './planner.js';
import type { LaunchRead } from './read-core.js';

function setup(opts: { ages: string[]; gender: 'male' | 'female' | null; results: string[] }) {
  const urls: URL[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    urls.push(new URL(input instanceof Request ? input.url : String(input)));
    const entities = opts.results.map((name, i) => ({
      entity_id: `E${i}`,
      name,
      subtype: 'urn:entity:artist',
      query: { affinity: 0.5 },
    }));
    return new Response(JSON.stringify({ success: true, results: { entities } }), { status: 200 });
  };
  const tools: ToolContext = {
    qloo: new QlooClient({
      baseUrl: 'https://recorded.invalid',
      apiKey: 'test',
      fetch: fetchImpl,
      callBudget: 10,
      retryDelayMs: 0,
    }),
    source: 'qloo',
    entities: new Map<string, SeenEntity>(),
  };
  const added: { id: string; text: string; confidence: string; audience: string | null }[] = [];
  const kit = {
    deps: { tools },
    ids: ['A1'],
    read: { ages: opts.ages, gender: opts.gender } as unknown as LaunchRead,
    plan: { cities: ['Lagos', 'London', 'Houston'] },
    safely: async (_label: string, run: () => Promise<unknown>) => run(),
    add: (
      f: { id: string; text: string; confidence: string; context: { audience: string | null } },
      _call: Receipt,
    ) => {
      added.push({
        id: f.id,
        text: f.text,
        confidence: f.confidence,
        audience: f.context.audience,
      });
    },
  } as unknown as GroundKit<LaunchRead, QueryPlanCore>;
  return { kit, added, urls };
}

describe('regionSeeds', () => {
  it('adds a separate, lower confidence finding per list for the first two cities', async () => {
    const { kit, added, urls } = setup({
      ages: ['25_to_29', '30_to_34'],
      gender: null,
      results: ['Mayorkun', 'BOJ', 'Sean Tizzle', 'Rayce'],
    });
    await regionSeeds(kit);
    expect(added.map((a) => a.id)).toEqual([
      'f-region-lagos-artists',
      'f-region-lagos-brands',
      'f-region-london-artists',
      'f-region-london-brands',
    ]);
    expect(added.every((a) => a.confidence === 'lower')).toBe(true);
    expect(added[0]?.text).toContain('With no comps to go on');
    expect(added[0]?.text).toContain('Mayorkun, BOJ and Sean Tizzle');
    expect(added[0]?.text).toContain('not for your comps');
    expect(urls.every((u) => !u.searchParams.has('signal.interests.entities'))).toBe(true);
    expect(urls[0]?.searchParams.get('signal.location.query')).toBe('Lagos');
  });

  it('records the gender it asked with', async () => {
    const { kit, added, urls } = setup({ ages: ['25_to_29'], gender: 'female', results: ['Tems'] });
    await regionSeeds(kit);
    expect(added[0]?.audience).toBe('mostly women, region and age only');
    expect(urls[0]?.searchParams.get('signal.demographics.gender')).toBe('female');
  });

  it('asks nothing without an age band, and adds nothing when Qloo lists nothing', async () => {
    const none = setup({ ages: [], gender: null, results: ['X'] });
    await regionSeeds(none.kit);
    expect(none.urls).toHaveLength(0);
    const empty = setup({ ages: ['25_to_29'], gender: null, results: [] });
    await regionSeeds(empty.kit);
    expect(empty.added).toHaveLength(0);
  });
});
