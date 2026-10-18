/**
 * Live check of the Film tools on a Nigerian film bundle: does `resolveBundle` find the comps by
 * exact name, does `rankPlaces` give a city order with enough cells from film comps, and does
 * `lift` separate Nollywood titles from other kinds when films are scored with
 * `filter.results.entities` (verified for books only). Leave one out runs inside both tools.
 *
 *   pnpm --filter @oraqul/engine qloo:film-tools
 *
 * Only public names go to Qloo. The output names titles so it can be judged by eye. It saves
 * nothing, because Qloo's terms on republishing responses are not confirmed. Copy conclusions
 * into the docs, not names or scores. About 25 calls.
 */
import {
  liftOutputSchema,
  QlooClient,
  QlooError,
  rankPlacesOutputSchema,
  resolveBundleOutputSchema,
  type SeenEntity,
  type ToolContext,
  tools,
} from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Set QLOO_API_KEY and QLOO_BASE_URL in .env to run this.');
  process.exit(0);
}

const ctx: ToolContext = {
  qloo: new QlooClient({ apiKey, baseUrl, callBudget: 40, timeoutMs: 120_000 }),
  source: 'qloo',
  entities: new Map<string, SeenEntity>(),
};
const movie = ['urn:entity:movie' as const];

// The launch's comps, the kind of film being launched, and films of other kinds as the baseline.
const comps = ['Gangs of Lagos', 'King of Boys', 'Citation', 'Lionheart'];
const kind = ['Anikulapo', 'Elesin Oba: The King’s Horseman', 'The Black Book'];
const baseline = ['Oppenheimer', 'Frozen', 'The Notebook', 'Top Gun: Maverick'];
const cities = ['Lagos', 'Abuja', 'Accra', 'London', 'Houston', 'Atlanta', 'Toronto'];

async function resolve(label: string, names: string[]): Promise<string[]> {
  const { data } = await tools.resolveBundle.run(ctx, { names, types: movie });
  const out = resolveBundleOutputSchema.parse(data);
  console.log(`\n## ${label}`);
  for (const a of out.anchors) {
    const pop = a.popularity === null ? 'none' : a.popularity.toFixed(3);
    const others = a.status === 'found' ? '' : ` → ${a.candidates.map((c) => c.name).join(' | ')}`;
    console.log(`${a.name}: ${a.status}, popularity ${pop}${others}`);
  }
  return out.entityIds;
}

async function step(label: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (err) {
    const detail = err instanceof QlooError ? `${err.kind}: ${err.message}` : String(err);
    console.log(`\n${label} failed: ${detail}`);
  }
}

let compIds: string[] = [];
let kindIds: string[] = [];
let baselineIds: string[] = [];

await step('Resolve', async () => {
  compIds = await resolve('Comps', comps);
  kindIds = await resolve('Kind (candidates)', kind);
  baselineIds = await resolve('Baseline (other kinds)', baseline);
});

await step('rankPlaces', async () => {
  if (compIds.length === 0) return console.log('\nrankPlaces skipped: no comps found');
  const { data, receipts } = await tools.rankPlaces.run(ctx, {
    entityIds: compIds,
    places: cities,
  });
  const out = rankPlacesOutputSchema.parse(data);
  console.log(`\n## rankPlaces (${receipts.length} calls)`);
  for (const p of [...out.places].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))) {
    const aff = p.affinity === null ? 'n/a' : p.affinity.toFixed(3);
    console.log(`${p.rank ?? '-'}. ${p.place}: ${p.status}, ${p.cells} cells, affinity ${aff}`);
    console.log(`   ${p.why}`);
  }
});

await step('lift', async () => {
  if (compIds.length === 0 || kindIds.length === 0 || baselineIds.length === 0) {
    return console.log('\nlift skipped: a group resolved to nothing');
  }
  const { data, receipts } = await tools.lift.run(ctx, {
    entityIds: compIds,
    type: 'urn:entity:movie',
    candidates: kindIds,
    baseline: baselineIds,
  });
  const out = liftOutputSchema.parse(data);
  console.log(`\n## lift (${receipts.length} calls)`);
  const row = (r: { name: string; affinity: number | null }) =>
    `${r.name} ${r.affinity === null ? 'not scored' : r.affinity.toFixed(3)}`;
  console.log(`kind: ${out.candidates.map(row).join(', ')}`);
  console.log(`baseline: ${out.baseline.map(row).join(', ')}`);
  console.log(`lift ${out.lift?.toFixed(3) ?? 'n/a'} (${out.band ?? 'no band'}), ${out.why}`);
});

console.log(`\nDone. ${ctx.qloo.callsUsed} network call(s).`);
