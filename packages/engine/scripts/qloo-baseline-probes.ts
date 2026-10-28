/**
 * Live check of a market's own baseline for a partner's fit (docs/backend/qloo.md): the most
 * popular brands, podcasts and books Qloo lists for a city with no comps behind them. A partner is
 * scored against these in one call, so "fit" means how much more this audience likes it than the
 * biggest names in the same market.
 *
 *   pnpm --filter @oraqul/engine qloo:baseline-probes
 *
 * Only public place names go to Qloo. Nothing is saved. About 20 calls.
 */

import { insights, QlooClient, QlooError } from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;
if (!apiKey || !baseUrl) {
  console.log('Set QLOO_API_KEY and QLOO_BASE_URL in .env to run this.');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 60, timeoutMs: 120_000 });
const cities = (process.env.PROBE_CITIES ?? 'Lagos,London,Mumbai,Kochi').split(',');
const types = (
  process.env.PROBE_TYPES ?? 'urn:entity:brand,urn:entity:podcast,urn:entity:book'
).split(',');

const show = (e: { name: string; popularity?: number | null }) =>
  `${e.name} (${e.popularity?.toFixed(2) ?? '-'})`;

for (const type of types) {
  for (const city of cities) {
    for (const [label, extra] of [
      ['location only', {}],
      ['popularity 0.7 and up', { 'filter.popularity.min': 0.7 }],
    ] as const) {
      try {
        const shape = { take: 6, 'signal.location.query': city, ...extra };
        const { data } = await insights.entities(
          qloo,
          type === 'urn:entity:brand'
            ? { ...shape, 'filter.type': 'urn:entity:brand' }
            : type === 'urn:entity:podcast'
              ? { ...shape, 'filter.type': 'urn:entity:podcast' }
              : { ...shape, 'filter.type': 'urn:entity:book' },
        );
        console.log(
          `${type.split(':').pop()} · ${city} · ${label}: ${data.results.entities.map(show).join(' | ') || '(nothing)'}`,
        );
      } catch (err) {
        console.log(
          `${type} · ${city} · ${label}: failed ${err instanceof QlooError ? `${err.kind}: ${err.message}` : String(err)}`,
        );
      }
    }
  }
}
console.log(`\ncalls used: ${qloo.callsUsed}`);
