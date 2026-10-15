/**
 * Live check of how often Qloo has an age and gender profile for an entity, by category. The
 * proxy bundle run found it for 3 of 9 books, including one with popularity 1.000. This asks
 * whether that is a book problem or general, whether popularity predicts it, and whether a
 * title's own genre tag fills the gap when the title has no row.
 *
 *   pnpm --filter @oraqul/engine qloo:demographics-coverage
 *
 * Only public names go to Qloo. The output is for the person running it and names titles so it
 * can be judged by eye. It saves nothing, because Qloo's terms on republishing responses are not
 * confirmed. Copy conclusions into the docs, not names or scores. About 120 calls, one per title
 * plus the search, so run it sparingly.
 */
import type { QlooEntityType } from '@oraqul/schema';
import { insights, lookup, QlooClient, QlooError } from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Skipping demographics coverage test: QLOO_API_KEY and QLOO_BASE_URL are not set');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 150, timeoutMs: 120_000 });

const groups: { label: string; type: QlooEntityType; names: string[] }[] = [
  {
    label: 'book',
    type: 'urn:entity:book',
    names: [
      'Things Fall Apart',
      'Americanah',
      'Gone Girl',
      'Dune',
      'The Silent Patient',
      'Lightseekers',
      'Born on a Tuesday',
      'Stay With Me',
      'Children of Blood and Bone',
      'Atomic Habits',
    ],
  },
  {
    label: 'movie',
    type: 'urn:entity:movie',
    names: [
      'Black Panther',
      'Lionheart',
      'Gangs of Lagos',
      'King of Boys',
      'Inception',
      'Oppenheimer',
      'The Wedding Party',
      'Citation',
    ],
  },
  {
    label: 'tv_show',
    type: 'urn:entity:tv_show',
    names: ['Money Heist', 'Blood Sisters', 'Squid Game', 'Shadow and Bone'],
  },
  {
    label: 'artist',
    type: 'urn:entity:artist',
    names: [
      'Burna Boy',
      'Wizkid',
      'Davido',
      'Asake',
      'Taylor Swift',
      'Rema',
      'Tems',
      'Ayra Starr',
      'Fireboy DML',
      'Joeboy',
    ],
  },
  {
    label: 'podcast',
    type: 'urn:entity:podcast',
    names: [
      'The Daily',
      'The Joe Rogan Experience',
      'Serial',
      'Crime Junkie',
      'My Dad Wrote a Porno',
      'Call Her Daddy',
      'How I Built This',
      'The Tim Ferriss Show',
    ],
  },
  {
    label: 'videogame',
    type: 'urn:entity:videogame',
    names: [
      'Elden Ring',
      'Minecraft',
      'Hades',
      'Hollow Knight',
      'Stardew Valley',
      'Fortnite',
      'Genshin Impact',
      'Among Us',
      'Celeste',
      'Hogwarts Legacy',
    ],
  },
];

interface Row {
  group: string;
  name: string;
  popularity: number | null;
  hasRow: boolean | 'error';
  tagId: string | null;
  tagWorked?: boolean | 'error';
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN);
const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : 'n/a');

console.log(`Qloo demographics coverage test against ${baseUrl}`);

const rows: Row[] = [];

for (const g of groups) {
  console.log(`\n## ${g.label}`);
  for (const query of g.names) {
    let hit: Awaited<ReturnType<typeof lookup.search>>['data']['results'][number] | undefined;
    try {
      hit = (await lookup.search(qloo, { query, types: [g.type], take: 1 })).data.results[0];
    } catch (err) {
      console.log(`${query}: search failed (${err instanceof QlooError ? err.kind : 'error'})`);
      continue;
    }
    if (!hit) {
      console.log(`${query}: NOT FOUND`);
      continue;
    }
    const genreTag = hit.tags?.find((t) => (t.tag_id ?? t.id ?? '').includes(':genre'));
    const anyTag = hit.tags?.find((t) => t.tag_id ?? t.id);
    const tagId = (genreTag ?? anyTag)?.tag_id ?? (genreTag ?? anyTag)?.id ?? null;
    const row: Row = {
      group: g.label,
      name: hit.name,
      popularity: hit.popularity ?? null,
      hasRow: 'error',
      tagId,
    };
    try {
      const { data } = await insights.demographics(qloo, {
        'signal.interests.entities': [hit.entity_id],
      });
      row.hasRow = data.results.demographics.length > 0;
    } catch (err) {
      console.log(
        `  ${hit.name}: demographics failed (${err instanceof QlooError ? err.kind : 'error'})`,
      );
    }
    rows.push(row);
    console.log(
      `${hit.name}: popularity ${row.popularity == null ? 'none' : row.popularity.toFixed(3)}, demographics ${row.hasRow === 'error' ? 'ERROR' : row.hasRow ? 'yes' : 'no'}, tags on the entity ${hit.tags?.length ?? 0}`,
    );
  }
}

console.log('\n## Summary by category');
for (const g of groups) {
  const mine = rows.filter((r) => r.group === g.label && r.hasRow !== 'error');
  const yes = mine.filter((r) => r.hasRow === true);
  const no = mine.filter((r) => r.hasRow === false);
  const pops = (rs: Row[]) => rs.map((r) => r.popularity).filter((p): p is number => p !== null);
  console.log(
    `${g.label}: ${yes.length}/${mine.length} have a row; mean popularity with ${fmt(mean(pops(yes)))}, without ${fmt(mean(pops(no)))}; without a popularity value: ${mine.filter((r) => r.popularity === null).length}`,
  );
}
const all = rows.filter((r) => r.hasRow !== 'error');
console.log(`all: ${all.filter((r) => r.hasRow === true).length}/${all.length} have a row`);

console.log(
  "\n## Does the title's own tag give a profile when the title has none? (first 2 misses per category)",
);
for (const g of groups) {
  const misses = rows
    .filter((r) => r.group === g.label && r.hasRow === false && r.tagId)
    .slice(0, 2);
  for (const r of misses) {
    try {
      const { data } = await insights.demographics(qloo, {
        'signal.interests.tags': [r.tagId as string],
      });
      r.tagWorked = data.results.demographics.length > 0;
    } catch (err) {
      r.tagWorked = 'error';
      console.log(
        `  ${r.name}: ${err instanceof QlooError ? `${err.kind} ${err.call.status ?? ''}` : 'error'}`,
      );
    }
    console.log(
      `${g.label} ${r.name} (${r.tagId}): ${r.tagWorked === 'error' ? 'ERROR' : r.tagWorked ? 'profile found' : 'no profile'}`,
    );
  }
}

console.log('\nDone.');
