/**
 * Live check of the proxy idea in docs/backend/qloo.md ("Recommended approach"): a launch that
 * is not in Qloo is described by a bundle of comparable titles, a person and tags, and Qloo is
 * asked about the bundle. The pretend launch is an unreleased Nigerian crime thriller by a debut
 * author. A romance bundle is the control: the answers should differ.
 *
 *   pnpm --filter @oraqul/engine qloo:proxy-bundle
 *
 * Only public names go to Qloo. The output is for the person running it and names titles so it
 * can be judged by eye. It saves nothing, because Qloo's terms on republishing responses are not
 * confirmed. Copy conclusions into the docs, not names or scores. About 40 calls, three of them
 * large and slow (Nigeria localities).
 */
import type { QlooEntityType } from '@oraqul/schema';
import { insights, lookup, QlooClient, QlooError } from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Skipping proxy bundle test: QLOO_API_KEY and QLOO_BASE_URL are not set');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 60, timeoutMs: 120_000 });

const BOOK = 'urn:entity:book' satisfies QlooEntityType;
const PERSON = 'urn:entity:person' satisfies QlooEntityType;

const thrillerNames = [
  'My Sister, the Serial Killer',
  'Lightseekers',
  'The Girl with the Dragon Tattoo',
  'Gone Girl',
];
const romanceNames = ['It Ends with Us', 'The Notebook', 'Pride and Prejudice', 'Me Before You'];
const authorName = 'Oyinkan Braithwaite';
// Candidates to score with each bundle: more thrillers, then books of other kinds.
const kindNames = [
  'The Silent Patient',
  'The Girl on the Train',
  'Sharp Objects',
  'Big Little Lies',
];
const otherNames = ['Dune', 'The Alchemist', 'Becoming', 'A Game of Thrones'];

interface Found {
  id: string;
  name: string;
  popularity: number | null;
}

async function resolve(name: string, type: QlooEntityType): Promise<Found | null> {
  const { data } = await lookup.search(qloo, { query: name, types: [type], take: 3 });
  const hit = data.results[0];
  return hit ? { id: hit.entity_id, name: hit.name, popularity: hit.popularity ?? null } : null;
}

async function resolveAll(names: string[], type: QlooEntityType, label: string): Promise<Found[]> {
  const found: Found[] = [];
  for (const name of names) {
    const r = await resolve(name, type);
    const pop = r?.popularity == null ? 'none' : r.popularity.toFixed(3);
    console.log(`${label} ${name}: ${r ? `${r.name}, popularity ${pop}` : 'NOT FOUND'}`);
    if (r) found.push(r);
  }
  return found;
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

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN);
const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : 'n/a');
const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).length;

type Profile = Record<string, number>;

function meanProfile(rows: Profile[]): Profile {
  const keys = new Set(rows.flatMap((r) => Object.keys(r)));
  return Object.fromEntries([...keys].map((k) => [k, mean(rows.map((r) => r[k] ?? 0))]));
}

function maxGap(a: Profile, b: Profile): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return Math.max(...[...keys].map((k) => Math.abs((a[k] ?? 0) - (b[k] ?? 0))));
}

console.log(`Qloo proxy bundle test against ${baseUrl}`);

let thriller: Found[] = [];
let romance: Found[] = [];
let kind: Found[] = [];
let other: Found[] = [];
let author: Found | null = null;

await step('Resolve the bundles, the author and the candidates', async () => {
  thriller = await resolveAll(thrillerNames, BOOK, 'thriller comp');
  romance = await resolveAll(romanceNames, BOOK, 'romance comp');
  kind = await resolveAll(kindNames, BOOK, 'candidate (kind)');
  other = await resolveAll(otherNames, BOOK, 'candidate (other)');
  author = await resolve(authorName, PERSON);
  console.log(
    `author ${authorName}: ${author ? `${author.name}, popularity ${author.popularity}` : 'NOT FOUND'}`,
  );
});

const thrillerIds = () => thriller.map((t) => t.id);
const romanceIds = () => romance.map((t) => t.id);

await step('1. Does a bundle of comps give books that look like the comps?', async () => {
  const lists = new Map<string, string[]>();
  for (const [label, ids] of [
    ['thriller bundle', thrillerIds()],
    ['romance bundle', romanceIds()],
  ] as const) {
    const { data } = await insights.entities(qloo, {
      'filter.type': BOOK,
      'signal.interests.entities': ids,
      take: 20,
    });
    const rows = data.results.entities;
    lists.set(
      label,
      rows.map((e) => e.name),
    );
    console.log(`${label}: ${rows.length} books`);
    console.log(
      `  top 8: ${rows
        .slice(0, 8)
        .map((e) => e.name)
        .join(' | ')}`,
    );
  }
  const a = lists.get('thriller bundle') ?? [];
  const b = lists.get('romance bundle') ?? [];
  console.log(`overlap of the two top 20 lists: ${overlap(a, b)}`);
});

await step(
  '2. Does the bundle score our kind above other kinds? (one call per bundle)',
  async () => {
    const candidates = [...kind, ...other];
    const group = new Map(candidates.map((c) => [c.id, kind.includes(c) ? 'kind' : 'other']));
    for (const [label, ids] of [
      ['thriller bundle', thrillerIds()],
      ['romance bundle', romanceIds()],
    ] as const) {
      const { data } = await insights.entities(qloo, {
        'filter.type': BOOK,
        'signal.interests.entities': ids,
        'filter.results.entities': candidates.map((c) => c.id),
        take: candidates.length,
      });
      const rows = data.results.entities;
      const scored = (g: string) =>
        rows
          .filter((e) => group.get(e.entity_id) === g)
          .map((e) => e.query?.affinity)
          .filter((a): a is number => a !== undefined);
      const k = scored('kind');
      const o = scored('other');
      console.log(
        `${label}: ${rows.length}/${candidates.length} returned; kind mean ${fmt(mean(k))} (min ${fmt(Math.min(...k))}), other mean ${fmt(mean(o))} (max ${fmt(Math.max(...o))})`,
      );
      console.log(
        `  ranked: ${rows.map((e) => `${e.name} [${group.get(e.entity_id) ?? '?'}] ${fmt(e.query?.affinity ?? Number.NaN)}`).join(' | ')}`,
      );
    }
  },
);

await step('3. Do tags work as a signal for books?', async () => {
  for (const phrase of ['crime', 'thriller']) {
    const { data } = await lookup.tags(qloo, { 'filter.query': phrase, take: 5 });
    console.log(
      `tag lookup "${phrase}": ${data.results.tags.map((t) => `${t.name} (${t.type ?? '?'})`).join(' | ')}`,
    );
  }
  const { data } = await lookup.tags(qloo, { 'filter.query': 'thriller', take: 5 });
  const tag = data.results.tags[0];
  if (!tag) return console.log('no tag to use');
  const alone = await insights.entities(qloo, {
    'filter.type': BOOK,
    'signal.interests.tags': [tag.id],
    take: 10,
  });
  console.log(`tag "${tag.name}" alone: ${alone.data.results.entities.length} books`);
  console.log(
    `  top 6: ${alone.data.results.entities
      .slice(0, 6)
      .map((e) => e.name)
      .join(' | ')}`,
  );
  const withComps = await insights.entities(qloo, {
    'filter.type': BOOK,
    'signal.interests.entities': thrillerIds(),
    'signal.interests.tags': [tag.id],
    take: 10,
  });
  console.log(`comps and tag together: ${withComps.data.results.entities.length} books`);
  console.log(
    `  top 6: ${withComps.data.results.entities
      .slice(0, 6)
      .map((e) => e.name)
      .join(' | ')}`,
  );
});

await step('4. Does a person (the author) work as a signal for books?', async () => {
  if (!author) return console.log('skipped (author not found)');
  const { data } = await insights.entities(qloo, {
    'filter.type': BOOK,
    'signal.interests.entities': [author.id],
    take: 10,
  });
  console.log(
    `${data.results.entities.length} books, top 6: ${data.results.entities
      .slice(0, 6)
      .map((e) => e.name)
      .join(' | ')}`,
  );
});

const profiles = new Map<string, { age: Profile[]; gender: Profile[]; names: string[] }>();

await step('5. Audience from the bundle: one row per comp, and leave one out', async () => {
  for (const [label, found] of [
    ['thriller bundle', thriller],
    ['romance bundle', romance],
  ] as const) {
    const { data } = await insights.demographics(qloo, {
      'signal.interests.entities': found.map((f) => f.id),
    });
    const rows = data.results.demographics;
    console.log(`${label}: ${rows.length} rows for ${found.length} comps`);
    const names = rows.map((r) => found.find((f) => f.id === r.entity_id)?.name ?? r.entity_id);
    profiles.set(label, {
      age: rows.map((r) => r.query.age ?? {}),
      gender: rows.map((r) => r.query.gender ?? {}),
      names,
    });
    const age = meanProfile(rows.map((r) => r.query.age ?? {}));
    console.log(
      `  mean age affinity: ${Object.entries(age)
        .map(([k, v]) => `${k} ${fmt(v)}`)
        .join(', ')}`,
    );
    const gender = meanProfile(rows.map((r) => r.query.gender ?? {}));
    console.log(
      `  mean gender affinity: ${Object.entries(gender)
        .map(([k, v]) => `${k} ${fmt(v)}`)
        .join(', ')}`,
    );
    rows.forEach((_, i) => {
      const without = meanProfile(rows.filter((_, j) => j !== i).map((x) => x.query.age ?? {}));
      console.log(`  leave out ${names[i]}: largest age shift ${fmt(maxGap(age, without))}`);
    });
  }
  const t = profiles.get('thriller bundle');
  const r = profiles.get('romance bundle');
  // A bundle with no demographic rows has no profile to compare, and an empty one reads as a gap.
  if (t?.age.length && r?.age.length) {
    console.log(
      `between the two bundles: largest age gap ${fmt(maxGap(meanProfile(t.age), meanProfile(r.age)))}, largest gender gap ${fmt(maxGap(meanProfile(t.gender), meanProfile(r.gender)))}`,
    );
  }
});

await step(
  '6. Places: Nigerian localities for each bundle, and with one comp left out',
  async () => {
    const tops = new Map<string, string[]>();
    const runs: [string, string[]][] = [
      ['thriller bundle', thrillerIds()],
      ['romance bundle', romanceIds()],
      [`thriller bundle without ${thriller[0]?.name ?? 'first comp'}`, thrillerIds().slice(1)],
    ];
    for (const [label, ids] of runs) {
      const { data } = await insights.heatmapByLocality(qloo, {
        'filter.location.query': 'Nigeria',
        'signal.interests.entities': ids,
        take: 10,
      });
      const rows = data.results.entities;
      const names = rows.map((e) => e.name);
      tops.set(label, names);
      const lagos = names.findIndex((n) => n.toLowerCase().includes('lagos'));
      console.log(
        `${label}: ${rows.length} localities, Lagos at position ${lagos < 0 ? 'not in the list' : lagos + 1}`,
      );
      console.log(`  first 6: ${names.slice(0, 6).join(' | ')}`);
    }
    const [a, b, c] = [...tops.values()];
    if (a && b)
      console.log(
        `thriller vs romance: ${overlap(a.slice(0, 10), b.slice(0, 10))} shared in the first 10`,
      );
    if (a && c)
      console.log(
        `thriller vs thriller without one comp: ${overlap(a.slice(0, 10), c.slice(0, 10))} shared in the first 10`,
      );
  },
);

console.log('\nDone.');
