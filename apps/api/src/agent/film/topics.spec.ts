import {
  tools as engineTools,
  QlooClient,
  type SeenEntity,
  type ToolContext,
} from '@oraqul/engine';
import type { Receipt } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import type { GroundKit } from '../launch/findings.js';
import { topicsAgainstRecentFilms } from './findings.js';
import type { QueryPlan } from './planner.js';
import type { FilmRead } from './read.js';

const tag = (name: string, count?: number) => ({
  tag_id: `urn:tag:theme:qloo:${name.toLowerCase().replace(/ /g, '_')}`,
  name,
  query: count === undefined ? { score: 0.7 } : { count: String(count) },
});

const films = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    entity_id: `F${i}`,
    name: `Recent film ${i}`,
    subtype: 'urn:entity:movie',
    popularity: 0.5,
    properties: { release_year: 2024 },
    query: { affinity: 0.6 },
  }));

function setup(recent: number) {
  const paths: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    paths.push(url.pathname);
    const body =
      url.pathname === '/v2/analysis/compare'
        ? {
            success: true,
            // Two comps both carry Moral ambiguity and Heist; four recent films carry Politics in 2.
            results: {
              tags: [],
              a: [tag('Moral ambiguity', 2), tag('Heist', 2), tag('Crime', 2)],
              b: [tag('Politics', 2), tag('Crime', 2), tag('Family', 1)],
            },
          }
        : { success: true, results: { entities: films(recent) } };
    return new Response(JSON.stringify(body), { status: 200 });
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
  const added: { id: string; text: string; call: Receipt }[] = [];
  const kit = {
    deps: { tools },
    ids: ['C1', 'C2'],
    safely: async (_label: string, run: () => Promise<unknown>) => run(),
    add: (finding: { id: string; text: string }, call: Receipt) => {
      added.push({ id: finding.id, text: finding.text, call });
    },
  } as unknown as GroundKit<FilmRead, QueryPlan>;
  return { kit, added, paths };
}

const shape = { type: 'urn:entity:movie' as const, yearFrom: 2020, country: 'Nigeria' };

describe('topicsAgainstRecentFilms', () => {
  it('names the topics only the comps carry, from one comparison call', async () => {
    const { kit, added, paths } = setup(5);
    await topicsAgainstRecentFilms(kit, shape, 'films from Nigeria');
    expect(paths.filter((p) => p === '/v2/analysis/compare')).toHaveLength(1);
    expect(added).toHaveLength(1);
    expect(added[0]?.id).toBe('f-film-topics');
    expect(added[0]?.text).toContain('moral ambiguity');
    expect(added[0]?.text).toContain('films from Nigeria');
    expect(added[0]?.text).not.toContain('politics');
  });

  it('makes no comparison when fewer than three recent films came back', async () => {
    const { kit, added, paths } = setup(2);
    await topicsAgainstRecentFilms(kit, shape, 'films from Nigeria');
    expect(paths).not.toContain('/v2/analysis/compare');
    expect(added).toHaveLength(0);
  });

  it('reuses the recent films request the finding already made, so only the comparison is new', async () => {
    const { kit, paths } = setup(5);
    await engineTools.findTaste.run(kit.deps.tools, {
      entityIds: kit.ids,
      take: 6,
      ...shape,
      exclude: [],
    });
    await topicsAgainstRecentFilms(kit, shape, 'films from Nigeria');
    expect(paths.filter((p) => p === '/v2/insights')).toHaveLength(1);
    expect(paths.filter((p) => p === '/v2/analysis/compare')).toHaveLength(1);
  });
});
