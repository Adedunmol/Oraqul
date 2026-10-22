import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import type { Finding } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { type ConsultOffer, runConsult } from './consult.js';

const context = (): ToolContext => ({
  qloo: new QlooClient({
    baseUrl: 'https://demo.invalid',
    apiKey: 'demo',
    fetch: demoFetch,
    callBudget: 20,
    retryDelayMs: 0,
  }),
  source: 'demo',
  entities: new Map<string, SeenEntity>(),
});

const offer = (name: string): ConsultOffer => ({
  id: `consult-music-${name}`,
  category: 'music',
  types: ['urn:entity:artist'],
  name,
  why: 'on the soundtrack',
});

const brief = { ages: { '18_to_24': 0.4 }, teamOrder: [] };

describe('runConsult', () => {
  it('runs the other side’s audience test on a named artist and cites its receipt', async () => {
    const emitted: Finding[] = [];
    const out = await runConsult(context(), brief, offer('Neon Tide'), (f) => emitted.push(f));
    expect(out.found).toBe(true);
    expect(out.findings.map((f) => f.id)).toEqual(['f-consult-music-audience-neon-tide']);
    expect(out.findings[0]?.query).toBe('consult');
    expect(emitted).toEqual(out.findings);
    // Every finding has a receipt that names it.
    const lineIds = new Set(out.receipts.flatMap((r) => (r.lineId ? [r.lineId] : [])));
    for (const f of out.findings) expect(lineIds.has(f.id)).toBe(true);
  });

  it('finds nothing, and makes no claim, for a name Qloo does not know', async () => {
    const emitted: Finding[] = [];
    const out = await runConsult(context(), brief, offer('Nobody At All'), (f) => emitted.push(f));
    expect(out.found).toBe(false);
    expect(out.findings).toEqual([]);
    expect(emitted).toEqual([]);
  });
});
