/**
 * Live check of three place-side levers (decisions D9, D27, D28): named localities from the
 * heatmap against geohash cells, the topic map on categories other than Podcasts, and place
 * quality filters against the venue name filter in code.
 *
 *   pnpm --filter @oraqul/engine qloo:place-probes
 *
 * Only public names and place names go to Qloo. The output names entities so it can be judged by
 * eye. It saves nothing. Copy conclusions into docs/backend/qloo.md, not names or scores. About
 * 55 calls.
 */
import type { QlooEntityType } from '@oraqul/schema';
import { insights, lookup, QlooClient, QlooError, tools } from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Set QLOO_API_KEY and QLOO_BASE_URL in .env to run this.');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 90, timeoutMs: 120_000 });
const ctx = {
  qloo,
  source: 'qloo' as const,
  entities: new Map<string, { name: string; popularity: number | null }>(),
};

async function step(label: string, run: () => Promise<void>): Promise<void> {
  // `ONLY=D27` reruns one step without paying for the others again.
  if (process.env.ONLY && !label.startsWith(process.env.ONLY)) return;
  console.log(`\n## ${label}`);
  try {
    await run();
  } catch (err) {
    console.log(
      `failed: ${err instanceof QlooError ? `${err.kind}: ${err.message}` : String(err)}`,
    );
  }
}

async function ids(names: string[], type: QlooEntityType): Promise<string[]> {
  const out: string[] = [];
  for (const n of names) {
    const { data } = await lookup.search(qloo, { query: n, types: [type], take: 1 });
    const top = data.results[0];
    if (top) {
      out.push(top.entity_id);
      ctx.entities.set(top.entity_id, { name: top.name, popularity: top.popularity ?? null });
    }
  }
  return out;
}

const films = await ids(['City of God', 'Sicario', 'Heat'], 'urn:entity:movie');

const sets: { label: string; type: QlooEntityType; mine: string[]; rivals: string[] }[] = [
  {
    label: 'Film',
    type: 'urn:entity:movie',
    mine: ['City of God', 'Sicario', 'Heat'],
    rivals: ['Joker', 'Parasite', 'The Batman'],
  },
  {
    label: 'Music',
    type: 'urn:entity:artist',
    mine: ['Burna Boy', 'Wizkid'],
    rivals: ['Drake', 'Taylor Swift', 'Bad Bunny'],
  },
  {
    label: 'Games',
    type: 'urn:entity:videogame',
    mine: ['Hades', 'Dead Cells'],
    rivals: ['Fortnite', 'Minecraft', 'Elden Ring'],
  },
  {
    label: 'Books',
    type: 'urn:entity:book',
    mine: ['Americanah', 'Purple Hibiscus'],
    rivals: ['Where the Crawdads Sing', 'It Ends with Us', 'The Midnight Library'],
  },
];

await step('D27: the topic map on other categories', async () => {
  for (const s of sets) {
    const mine = await ids(s.mine, s.type);
    const rivals = await ids(s.rivals, s.type);
    if (mine.length === 0 || rivals.length === 0) {
      console.log(`${s.label}: names did not resolve`);
      continue;
    }
    try {
      const { data } = await tools.topicMap.run(ctx, {
        entityIds: mine,
        rivalIds: rivals,
        take: 6,
      });
      const out = data as {
        yours: { name: string }[];
        shared: { name: string }[];
        rivals: { name: string }[];
        confidence: string;
      };
      const list = (a: { name: string }[]) =>
        a
          .slice(0, 6)
          .map((t) => t.name)
          .join(', ') || '(none)';
      console.log(
        `${s.label}: yours ${out.yours.length}, shared ${out.shared.length}, rivals ${out.rivals.length}, confidence ${out.confidence}`,
      );
      console.log(`  yours: ${list(out.yours)}`);
      console.log(`  rivals: ${list(out.rivals)}`);
    } catch (err) {
      console.log(
        `${s.label}: ${err instanceof QlooError ? `${err.kind} ${err.message}` : String(err)}`,
      );
    }
  }
});

// The name filter the launch findings apply today to places Qloo lists.
const NOT_A_VENUE = /\b(hotel|mall|shopping|flea|market|resort|spa|square|police|union)\b/i;

await step('D28: place quality filters against the name filter', async () => {
  const cases: [string, string][] = [
    ['movie theater', 'Lagos'],
    ['bar', 'London'],
    ['bar', 'Atlanta'],
  ];
  for (const [word, city] of cases) {
    const tags = await lookup.tags(qloo, {
      'filter.query': word,
      'filter.parents.types': ['urn:entity:place'],
      take: 3,
    });
    const tag = tags.data.results.tags[0]?.id;
    if (!tag) {
      console.log(`${word}: no place tag`);
      continue;
    }
    const base = {
      'filter.type': 'urn:entity:place' as const,
      'signal.interests.entities': films,
      'filter.tags': [tag],
      'filter.location.query': city,
      take: 10,
    };
    const variants: [string, object][] = [
      ['as is', {}],
      ['bias.quality=high', { 'bias.quality': 'high' }],
      ['business_rating.min=3.5', { 'filter.properties.business_rating.min': 3.5 }],
    ];
    console.log(`${word} in ${city} (${tag})`);
    for (const [label, extra] of variants) {
      try {
        const { data } = await insights.entities(qloo, { ...base, ...extra });
        const rows = data.results.entities;
        const flagged = rows.filter((e) => NOT_A_VENUE.test(e.name)).length;
        console.log(
          `  ${label}: ${rows.length} places, ${flagged} the name filter would drop: ${rows.map((e) => e.name).join(' | ')}`,
        );
      } catch (err) {
        console.log(
          `  ${label}: ${err instanceof QlooError ? `${err.kind} ${err.message}` : String(err)}`,
        );
      }
    }
  }
});

console.log(`\nCalls made: ${qloo.callsUsed}`);
