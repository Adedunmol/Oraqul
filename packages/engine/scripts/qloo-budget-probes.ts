/**
 * Live check of three ways to spend fewer or better calls (decisions D5, D6, D7, D36):
 * whether `feature.explainability` can stand in for the leave-one-out reruns, whether
 * `filter.popularity.max` gives partner brands without the model naming candidates, and what
 * `/v2/trending` answers per type, with and without a signal.
 *
 *   pnpm --filter @oraqul/engine qloo:budget-probes
 *
 * Only public names go to Qloo. The output names entities so it can be judged by eye. It saves
 * nothing. Copy conclusions into docs/backend/qloo.md, not names or scores. About 35 calls.
 */
import {
  analysis,
  insights,
  lookup,
  QlooClient,
  QlooError,
  type SeenEntity,
  type ToolContext,
} from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Set QLOO_API_KEY and QLOO_BASE_URL in .env to run this.');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 50, timeoutMs: 120_000 });
const ctx: ToolContext = { qloo, source: 'qloo', entities: new Map<string, SeenEntity>() };

const comps = ['City of God', 'Sicario', 'Heat'];
const rivals = ['Joker', 'Parasite', 'The Batman', 'Oppenheimer', 'Dune'];

async function step(label: string, run: () => Promise<void>): Promise<void> {
  console.log(`\n## ${label}`);
  try {
    await run();
  } catch (err) {
    const detail = err instanceof QlooError ? `${err.kind}: ${err.message}` : String(err);
    console.log(`failed: ${detail}`);
  }
}

// The top search hit, because several of these names are shared and this probe is about scoring,
// not about picking the right title.
async function resolve(names: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const name of names) {
    const { data } = await lookup.search(qloo, {
      query: name,
      types: ['urn:entity:movie'],
      take: 1,
    });
    const top = data.results[0];
    if (!top) continue;
    found.set(name, top.entity_id);
    ctx.entities.set(top.entity_id, { name: top.name, popularity: top.popularity ?? null });
  }
  return found;
}

const compIds = [...(await resolve(comps)).values()];
const rivalMap = await resolve(rivals);
const rivalIds = [...rivalMap.values()];
if (compIds.length < 3 || rivalIds.length < 3) {
  console.log('The comps or rivals did not resolve, stopping.');
  process.exit(0);
}
const nameOf = (id: string) => ctx.entities.get(id)?.name ?? id;

await step('D6: what feature.explainability returns on a scoring call', async () => {
  const { data } = await insights.entities(qloo, {
    'filter.type': 'urn:entity:movie',
    'signal.interests.entities': compIds,
    'filter.results.entities': rivalIds,
    'feature.explainability': true,
    take: rivalIds.length,
  });
  for (const e of data.results.entities) {
    const x = JSON.stringify(e.query?.explainability ?? null);
    console.log(
      `${e.name}: affinity ${e.query?.affinity ?? 'n/a'}, explainability ${x.slice(0, 400)}`,
    );
  }
});

await step('D6: leave-one-out on the same call, to compare with explainability', async () => {
  const score = async (ids: string[]) => {
    const { data } = await insights.entities(qloo, {
      'filter.type': 'urn:entity:movie',
      'signal.interests.entities': ids,
      'filter.results.entities': rivalIds,
      take: rivalIds.length,
    });
    return new Map(data.results.entities.map((e) => [e.entity_id, e.query?.affinity ?? null]));
  };
  const full = await score(compIds);
  for (const left of compIds) {
    const without = await score(compIds.filter((id) => id !== left));
    const moves = rivalIds.map((r) => {
      const a = full.get(r);
      const b = without.get(r);
      return `${nameOf(r)} ${a != null && b != null ? (b - a).toFixed(3) : 'n/a'}`;
    });
    console.log(`without ${nameOf(left)}: change in affinity: ${moves.join(' | ')}`);
  }
});

await step('D7: partner brands, open list against a popularity cap', async () => {
  for (const max of [undefined, 0.6, 0.3]) {
    const { data } = await insights.entities(qloo, {
      'filter.type': 'urn:entity:brand',
      'signal.interests.entities': compIds,
      ...(max === undefined ? {} : { 'filter.popularity.max': max }),
      take: 8,
    });
    const rows = data.results.entities.map(
      (e) => `${e.name} (${e.popularity?.toFixed(2) ?? 'n/a'})`,
    );
    console.log(`popularity.max ${max ?? 'none'}: ${rows.join(' | ') || '(nothing)'}`);
  }
});

const day = 24 * 3600 * 1000;
const end = new Date();
const dateOf = (back: number) => new Date(end.getTime() - back * day).toISOString().slice(0, 10);

await step('D5: trending per type with a signal', async () => {
  const lead = compIds[0] as string;
  for (const type of ['urn:entity:movie', 'urn:entity:artist'] as const) {
    const { data } = await analysis.trending(qloo, {
      'filter.type': type,
      'signal.interests.entities': [lead],
      'filter.start_date': dateOf(365),
      'filter.end_date': dateOf(0),
      take: 5,
    });
    const rows = data.results.trending;
    console.log(
      `${type} (signal is a movie): ${rows.length} point(s), first: ${JSON.stringify(rows[0] ?? null).slice(0, 300)}`,
    );
  }
});

await step('D36: trending with no signal', async () => {
  try {
    const { data } = await analysis.trending(qloo, {
      'filter.type': 'urn:entity:movie',
      'filter.start_date': dateOf(365),
      'filter.end_date': dateOf(0),
      take: 5,
    } as unknown as Parameters<typeof analysis.trending>[1]);
    console.log(`accepted: ${data.results.trending.length} point(s)`);
  } catch (err) {
    console.log(err instanceof QlooError ? `rejected: ${err.kind} ${err.message}` : String(err));
  }
});

console.log(`\nCalls made: ${qloo.callsUsed}`);
