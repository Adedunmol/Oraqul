/**
 * Live check of cross-domain taste tests: does the audience of an artist, used as the signal,
 * say anything useful about books, and what does Qloo return when there is no overlap?
 * Settles the cross-domain items in docs/backend/qloo.md ("Still open").
 *
 *   pnpm --filter @oraqul/engine qloo:cross-domain
 *
 * Only public names go to Qloo. The output is for the person running it: it names titles so the
 * results can be judged by eye. It saves nothing, because Qloo's terms on republishing responses
 * are not confirmed, so copy conclusions into the docs, not names or scores. About 25 calls.
 */
import type { QlooEntityType } from '@oraqul/schema';
import { insights, lookup, QlooClient, QlooError } from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Skipping cross-domain test: QLOO_API_KEY and QLOO_BASE_URL are not set');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 40, timeoutMs: 60_000 });

const ARTIST = 'urn:entity:artist' satisfies QlooEntityType;
const BOOK = 'urn:entity:book' satisfies QlooEntityType;

// Signals: one artist whose fans plausibly read African literary fiction, and two that should not.
const signalNames = ['Burna Boy', 'Taylor Swift', 'Metallica'];
// The kind of book we pretend to launch, against books of other kinds as the baseline.
const kindBooks = ['Americanah', 'Half of a Yellow Sun', 'Purple Hibiscus', 'Things Fall Apart'];
const baselineBooks = ['Gone Girl', 'The Da Vinci Code', 'A Game of Thrones', 'It Ends with Us'];

async function resolve(name: string, type: QlooEntityType) {
  const { data } = await lookup.search(qloo, { query: name, types: [type], take: 3 });
  const hit = data.results[0];
  return hit ? { id: hit.entity_id, name: hit.name, popularity: hit.popularity ?? null } : null;
}

async function step(label: string, run: () => Promise<void>): Promise<void> {
  console.log(`\n## ${label}`);
  try {
    await run();
  } catch (err) {
    if (err instanceof QlooError) {
      console.log(`error [${err.kind}, status ${err.call.status ?? 'none'}]: ${err.message}`);
    } else {
      console.log(`error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : 'n/a');

console.log(`Qloo cross-domain test against ${baseUrl}`);

const signals: { id: string; name: string }[] = [];
const kind: { id: string; name: string }[] = [];
const baseline: { id: string; name: string }[] = [];

await step('Resolve the anchors (artists) and the candidate books', async () => {
  for (const name of signalNames) {
    const r = await resolve(name, ARTIST);
    console.log(`artist ${name}: ${r ? `${r.name}, popularity ${r.popularity}` : 'NOT FOUND'}`);
    if (r) signals.push(r);
  }
  for (const [group, names, into] of [
    ['kind', kindBooks, kind],
    ['baseline', baselineBooks, baseline],
  ] as const) {
    for (const name of names) {
      const r = await resolve(name, BOOK);
      console.log(
        `book (${group}) ${name}: ${r ? `${r.name}, popularity ${r.popularity}` : 'NOT FOUND'}`,
      );
      if (r) into.push(r);
    }
  }
});

const topLists = new Map<string, string[]>();

await step('1. Does an artist signal return books, and with an affinity?', async () => {
  for (const s of signals) {
    const { data } = await insights.entities(qloo, {
      'filter.type': BOOK,
      'signal.interests.entities': [s.id],
      take: 20,
    });
    const rows = data.results.entities;
    topLists.set(
      s.name,
      rows.map((e) => e.name),
    );
    const withAffinity = rows.filter((e) => e.query?.affinity !== undefined).length;
    console.log(`${s.name}: ${rows.length} books, affinity on ${withAffinity}`);
    console.log(
      `  top 8: ${rows
        .slice(0, 8)
        .map((e) => e.name)
        .join(' | ')}`,
    );
  }
});

await step('2. Do different artists give different books? (overlap of the top 20)', async () => {
  const names = [...topLists.keys()];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = new Set(topLists.get(names[i] as string));
      const b = new Set(topLists.get(names[j] as string));
      const shared = [...a].filter((x) => b.has(x)).length;
      console.log(`${names[i]} vs ${names[j]}: ${shared} shared of ${a.size} and ${b.size}`);
    }
  }
});

await step('3. Candidate check: affinity of the kind of book against the baseline', async () => {
  const candidates = [...kind, ...baseline];
  const group = new Map(candidates.map((c) => [c.id, kind.includes(c) ? 'kind' : 'baseline']));
  for (const s of signals) {
    const { data } = await insights.entities(qloo, {
      'filter.type': BOOK,
      'signal.interests.entities': [s.id],
      'filter.results.entities': candidates.map((c) => c.id),
      take: candidates.length,
    });
    const rows = data.results.entities;
    const scored = (g: string) =>
      rows
        .filter((e) => group.get(e.entity_id) === g)
        .map((e) => e.query?.affinity)
        .filter((a): a is number => a !== undefined);
    console.log(
      `${s.name}: ${rows.length}/${candidates.length} candidates returned; kind ${scored('kind').length} scored, mean ${fmt(mean(scored('kind')))}; baseline ${scored('baseline').length} scored, mean ${fmt(mean(scored('baseline')))}`,
    );
    const missing = candidates.filter((c) => !rows.some((e) => e.entity_id === c.id));
    if (missing.length)
      console.log(`  not returned (no overlap?): ${missing.map((m) => m.name).join(' | ')}`);
    console.log(
      `  ranked: ${rows.map((e) => `${e.name} [${group.get(e.entity_id) ?? '?'}] ${fmt(e.query?.affinity ?? NaN)}`).join(' | ')}`,
    );
  }
});

await step('4. Several anchors at once (a comp set as one signal)', async () => {
  const { data } = await insights.entities(qloo, {
    'filter.type': BOOK,
    'signal.interests.entities': signals.map((s) => s.id),
    take: 20,
  });
  const rows = data.results.entities;
  console.log(`${rows.length} books from ${signals.length} artists together`);
  console.log(
    `  top 8: ${rows
      .slice(0, 8)
      .map((e) => e.name)
      .join(' | ')}`,
  );
});

await step('5. Other target types from the first artist', async () => {
  const first = signals[0];
  if (!first) return console.log('skipped (no artist)');
  for (const [label, type] of [
    ['podcast', 'urn:entity:podcast'],
    ['videogame', 'urn:entity:videogame'],
    ['movie', 'urn:entity:movie'],
  ] as const) {
    const { data } = await insights.entities(qloo, {
      'filter.type': type,
      'signal.interests.entities': [first.id],
      take: 10,
    });
    const rows = data.results.entities;
    console.log(
      `${label}: ${rows.length} results, top 5: ${rows
        .slice(0, 5)
        .map((e) => e.name)
        .join(' | ')}`,
    );
  }
});

console.log('\nDone.');
