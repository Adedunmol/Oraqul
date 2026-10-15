/**
 * Live check of whether a place ranking from a bundle of comps can be trusted. The proxy bundle
 * run found Nigerian locality rankings flip when one comp was left out. This asks whether that
 * was noise in Qloo (the same call twice), whether a geohash heatmap is steadier, whether several
 * cities fit in one call so their scores can be compared, and whether the ranking holds when a
 * comp is dropped or the bundle changes kind.
 *
 *   pnpm --filter @oraqul/engine qloo:places-stability
 *
 * Only public names go to Qloo. The output is for the person running it and names titles so it
 * can be judged by eye. It saves nothing, because Qloo's terms on republishing responses are not
 * confirmed. Copy conclusions into the docs, not names or scores. About 40 calls.
 */
import type { QlooEntityType } from '@oraqul/schema';
import { insights, lookup, QlooClient, QlooError } from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Skipping places stability test: QLOO_API_KEY and QLOO_BASE_URL are not set');
  process.exit(0);
}

const options = { apiKey, baseUrl, callBudget: 60, timeoutMs: 120_000 };
const qloo = new QlooClient(options);

const BOOK = 'urn:entity:book' satisfies QlooEntityType;

const thrillerNames = [
  'My Sister, the Serial Killer',
  'Lightseekers',
  'The Girl with the Dragon Tattoo',
  'Gone Girl',
];
// A second, coherent bundle of a different kind, to see whether places move with the bundle.
const literaryNames = [
  'Americanah',
  'Half of a Yellow Sun',
  'Purple Hibiscus',
  'Things Fall Apart',
];

// Boxes around the cities a Nigerian release would compare, as [name, west, south, east, north].
const cities: [string, number, number, number, number][] = [
  ['Lagos', 3.1, 6.35, 3.65, 6.7],
  ['London', -0.5, 51.3, 0.3, 51.7],
  ['Houston', -95.8, 29.5, -95.0, 30.1],
  ['Toronto', -79.65, 43.55, -79.1, 43.85],
];

const box = (w: number, s: number, e: number, n: number) =>
  `((${w} ${s}, ${e} ${s}, ${e} ${n}, ${w} ${n}, ${w} ${s}))`;
const lagosBox = cities[0] as [string, number, number, number, number];
const lagosWkt = `POLYGON${box(lagosBox[1], lagosBox[2], lagosBox[3], lagosBox[4])}`;
const allWkt = `MULTIPOLYGON(${cities.map(([, w, s, e, n]) => box(w, s, e, n)).join(',')})`;

interface Cell {
  geohash: string;
  lat: number;
  lon: number;
  affinity: number;
}

async function resolveBooks(names: string[]) {
  const found: { id: string; name: string }[] = [];
  for (const name of names) {
    const { data } = await lookup.search(qloo, { query: name, types: [BOOK], take: 1 });
    const hit = data.results[0];
    if (hit) found.push({ id: hit.entity_id, name: hit.name });
    else console.log(`NOT FOUND: ${name}`);
  }
  return found;
}

async function cellsFor(client: QlooClient, location: string, ids: string[]): Promise<Cell[]> {
  const { data } = await insights.heatmap(client, {
    'filter.location': location,
    'signal.interests.entities': ids,
  });
  return data.results.heatmap.map((p) => ({
    geohash: p.location.geohash,
    lat: p.location.latitude,
    lon: p.location.longitude,
    affinity: p.query.affinity,
  }));
}

async function step(label: string, run: () => Promise<void>): Promise<void> {
  console.log(`\n## ${label}`);
  try {
    await run();
  } catch (err) {
    if (err instanceof QlooError) {
      console.log(
        `error [${err.kind}, status ${err.call.status ?? 'none'}]: ${JSON.stringify(err.call.returned ?? err.message).slice(0, 300)}`,
      );
    } else {
      console.log(`error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN);
const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : 'n/a');

function ranks(xs: number[]): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length).fill(0);
  order.forEach(([, i], pos) => {
    r[i] = pos;
  });
  return r;
}

/** Spearman rank correlation over the cells both lists have. Ties are not averaged. */
function spearman(a: Cell[], b: Cell[]): { n: number; rho: number } {
  const bBy = new Map(b.map((c) => [c.geohash, c.affinity]));
  const common = a.filter((c) => bBy.has(c.geohash));
  if (common.length < 3) return { n: common.length, rho: Number.NaN };
  const ra = ranks(common.map((c) => c.affinity));
  const rb = ranks(common.map((c) => bBy.get(c.geohash) as number));
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  ra.forEach((x, i) => {
    const y = rb[i] as number;
    num += (x - ma) * (y - mb);
    da += (x - ma) ** 2;
    db += (y - mb) ** 2;
  });
  return { n: common.length, rho: num / Math.sqrt(da * db) };
}

function cityOf(c: Cell): string | null {
  for (const [name, w, s, e, n] of cities) {
    if (c.lon >= w && c.lon <= e && c.lat >= s && c.lat <= n) return name;
  }
  return null;
}

function cityOrder(cells: Cell[]): { order: string[]; counts: string; means: string } {
  const by = new Map<string, number[]>();
  for (const c of cells) {
    const name = cityOf(c);
    if (name) by.set(name, [...(by.get(name) ?? []), c.affinity]);
  }
  const scored = [...by.entries()].map(([name, xs]) => ({ name, m: mean(xs), n: xs.length }));
  scored.sort((a, b) => b.m - a.m);
  return {
    order: scored.map((s) => s.name),
    counts: scored.map((s) => `${s.name} ${s.n}`).join(', '),
    means: scored.map((s) => `${s.name} ${fmt(s.m)}`).join(', '),
  };
}

console.log(`Qloo places stability test against ${baseUrl}`);

let thriller: { id: string; name: string }[] = [];
let literary: { id: string; name: string }[] = [];

await step('Resolve the bundles', async () => {
  thriller = await resolveBooks(thrillerNames);
  literary = await resolveBooks(literaryNames);
  console.log(`thriller ${thriller.length} comps, literary ${literary.length} comps`);
});

const tIds = () => thriller.map((t) => t.id);
const lIds = () => literary.map((t) => t.id);
const without = (ids: string[], i: number) => ids.filter((_, j) => j !== i);

const lagosByVariant = new Map<string, Cell[]>();

await step('1. Is Qloo itself steady? The same Lagos call from two fresh clients', async () => {
  const a = await cellsFor(new QlooClient(options), lagosWkt, tIds());
  const b = await cellsFor(new QlooClient(options), lagosWkt, tIds());
  const s = spearman(a, b);
  const same = a.length === b.length && a.every((c, i) => c.geohash === (b[i]?.geohash ?? ''));
  console.log(
    `cells ${a.length} and ${b.length}; same order: ${same}; rank correlation over ${s.n} shared cells: ${fmt(s.rho)}`,
  );
  lagosByVariant.set('thriller', a);
});

await step(
  '2. Lagos cells: does the ranking hold when a comp is dropped, or the bundle changes?',
  async () => {
    const base = lagosByVariant.get('thriller') ?? [];
    const variants: [string, string[]][] = [
      ...thriller.map(
        (t, i) => [`thriller without ${t.name}`, without(tIds(), i)] as [string, string[]],
      ),
      ['literary', lIds()],
    ];
    for (const [label, ids] of variants) {
      const cells = await cellsFor(qloo, lagosWkt, ids);
      lagosByVariant.set(label, cells);
      const s = spearman(base, cells);
      console.log(
        `${label}: ${cells.length} cells, rank correlation with the full thriller bundle over ${s.n} shared cells: ${fmt(s.rho)}`,
      );
    }
  },
);

await step(
  '3. Several cities in one call (MULTIPOLYGON): is it accepted, and how are cells spread?',
  async () => {
    const cells = await cellsFor(qloo, allWkt, tIds());
    const { order, counts, means } = cityOrder(cells);
    console.log(`${cells.length} cells in total; cells per city: ${counts}`);
    console.log(`city order by mean affinity: ${order.join(' > ')}  (${means})`);
  },
);

await step(
  '4. City ranking from one call: leave one comp out, and a different bundle',
  async () => {
    const variants: [string, string[]][] = [
      ['thriller (full)', tIds()],
      ...thriller.map(
        (t, i) => [`thriller without ${t.name}`, without(tIds(), i)] as [string, string[]],
      ),
      ['literary', lIds()],
    ];
    for (const [label, ids] of variants) {
      const cells = await cellsFor(qloo, allWkt, ids);
      const { order, counts, means } = cityOrder(cells);
      console.log(`${label}: ${order.join(' > ')}  (${means}; cells ${counts})`);
    }
  },
);

await step('5. The locality entity path (docs say it needs a locality as the signal)', async () => {
  const { data } = await insights.entities(qloo, {
    'filter.type': 'urn:entity:locality',
    'signal.interests.entities': tIds(),
    take: 10,
  });
  console.log(
    `${data.results.entities.length} localities, first 5: ${data.results.entities
      .slice(0, 5)
      .map((e) => e.name)
      .join(' | ')}`,
  );
});

console.log('\nDone.');
