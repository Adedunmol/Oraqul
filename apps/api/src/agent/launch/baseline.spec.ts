import { QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import type { Receipt } from '@oraqul/schema';
import { clearBaselineCache, marketBaseline } from './baseline.js';

function context(entities: { entity_id: string; name: string; popularity: number }[]) {
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    urls.push(input.toString());
    return new Response(JSON.stringify({ success: true, results: { entities } }), { status: 200 });
  };
  const qloo = new QlooClient({
    baseUrl: 'https://qloo.test',
    apiKey: 'k',
    retryDelayMs: 0,
    fetch: fetchImpl,
  });
  const ctx: ToolContext = { qloo, source: 'qloo', entities: new Map<string, SeenEntity>() };
  return { ctx, urls };
}

describe('marketBaseline', () => {
  beforeEach(clearBaselineCache);

  it('takes the favourites Qloo lists for the city, skips obscure names, and keeps a receipt', async () => {
    const { ctx, urls } = context([
      { entity_id: 'B1', name: 'Guaranty Trust Bank', popularity: 0.99 },
      { entity_id: 'B2', name: 'Obscure Shop', popularity: 0.3 },
      { entity_id: 'B3', name: 'MTN', popularity: 0.9 },
    ]);
    const kept: Receipt[] = [];
    const out = await marketBaseline(ctx, (r) => kept.push(...r), 'urn:entity:brand', 'Lagos');
    expect(out.map((b) => b.name)).toEqual(['Guaranty Trust Bank', 'MTN']);
    expect(urls[0]).toContain('signal.location.query=Lagos');
    expect(kept).toHaveLength(1);
    expect(kept[0]?.confidence).toBe('lower');
  });

  it('asks once per city and type', async () => {
    const { ctx, urls } = context([{ entity_id: 'B1', name: 'GTBank', popularity: 0.99 }]);
    await marketBaseline(ctx, () => {}, 'urn:entity:brand', 'Lagos');
    await marketBaseline(ctx, () => {}, 'urn:entity:brand', 'lagos');
    expect(urls).toHaveLength(1);
    await marketBaseline(ctx, () => {}, 'urn:entity:brand', 'London');
    expect(urls).toHaveLength(2);
  });
});
