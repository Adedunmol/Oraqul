import { QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { describe, expect, it } from 'vitest';
import { brandPools } from './brands.js';
import type { GroundKit } from './findings.js';
import type { QueryPlanCore } from './planner.js';
import type { LaunchRead } from './read-core.js';

// A mid-size band answers with two brands, the open category list with the biggest one.
function setup(plan: Partial<QueryPlanCore>) {
  const urls: URL[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    urls.push(url);
    const mid = url.searchParams.has('filter.popularity.min');
    const city = url.searchParams.get('signal.location.query') ?? '';
    const names = mid ? ['Mid One', 'Mid Two'] : ['Big One'];
    const entities = names.map((name) => ({
      entity_id: `${city}:${name}`,
      name,
      subtype: 'urn:entity:brand',
      query: { affinity: 0.5 },
    }));
    return new Response(JSON.stringify({ success: true, results: { entities } }), { status: 200 });
  };
  const tools: ToolContext = {
    qloo: new QlooClient({
      baseUrl: 'https://recorded.invalid',
      apiKey: 'test',
      fetch: fetchImpl,
      callBudget: 20,
      retryDelayMs: 0,
    }),
    source: 'qloo',
    entities: new Map<string, SeenEntity>(),
  };
  const kit = {
    deps: { tools, keep: () => {}, emit: () => {} },
    ids: ['A1'],
    read: { ages: [] } as unknown as LaunchRead,
    plan: { brandCandidates: [], ...plan },
    jobs: [],
    safely: async (_label: string, run: () => Promise<unknown>) => run(),
  } as unknown as GroundKit<LaunchRead, QueryPlanCore>;
  return { kit, urls };
}

const tags = [
  { id: 'urn:tag:genre:brand:beverage', name: 'beverage' },
  { id: 'urn:tag:genre:brand:telecom', name: 'telecom' },
];

describe('brandPools', () => {
  it('finds mid-size brands among each category for the comps, in the first two cities', async () => {
    const { kit, urls } = setup({ reach: { flagship: false } });
    const pools = await brandPools(kit, tags, ['Lagos', 'London', 'Houston']);
    // Houston is the third city, so it is not asked by category with a band.
    expect(pools.map((p) => p.city)).toEqual(['Lagos', 'London']);
    expect(pools[0]?.pool).toEqual(['Lagos:Mid One', 'Lagos:Mid Two']);
    // Two categories in two cities, mid band only: four banded calls. Houston has no brands at
    // all, so it gets one wider read with no band.
    expect(urls).toHaveLength(5);
    expect(urls.filter((u) => u.searchParams.has('filter.popularity.min'))).toHaveLength(4);
    expect(urls.filter((u) => !u.searchParams.has('filter.popularity.min'))).toHaveLength(1);
    expect(urls.every((u) => u.searchParams.has('signal.interests.entities'))).toBe(true);
  });

  it('asks the biggest names too, in the home city only, when the launch can reach one', async () => {
    const { kit, urls } = setup({ reach: { flagship: true } });
    const pools = await brandPools(kit, tags, ['Lagos', 'London']);
    expect(urls).toHaveLength(6);
    expect(urls.filter((u) => !u.searchParams.has('filter.popularity.min'))).toHaveLength(2);
    expect(pools.find((p) => p.city === 'Lagos')?.pool).toContain('Lagos:Big One');
    expect(pools.find((p) => p.city === 'London')?.pool).not.toContain('London:Big One');
  });

  it('never asks the biggest names when the plan carries no reach', async () => {
    const { kit, urls } = setup({});
    await brandPools(kit, tags, ['Lagos']);
    expect(urls.every((u) => u.searchParams.has('filter.popularity.min'))).toBe(true);
  });

  it('asks nothing without a verified category or without comps', async () => {
    const none = setup({ reach: { flagship: true } });
    expect(await brandPools(none.kit, [], ['Lagos'])).toEqual([]);
    expect(none.urls).toHaveLength(0);
    const bare = setup({ reach: { flagship: true } });
    (bare.kit as { ids: string[] }).ids = [];
    expect(await brandPools(bare.kit, tags, ['Lagos'])).toEqual([]);
    expect(bare.urls).toHaveLength(0);
  });
});
