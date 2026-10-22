/**
 * Live check of a region as the signal (decisions D19, D20): what Qloo lists for a region and an
 * age band with no entity, and the chain from a region's top artist to the series its fans like
 * and the archetype and audience tags of those series.
 *
 *   pnpm --filter @oraqul/engine qloo:region-probes
 *
 * Only public names, place names and age bands go to Qloo. The output names entities so it can be
 * judged by eye. It saves nothing. Copy conclusions into docs/backend/qloo.md, not names or
 * scores. About 25 calls.
 */
import { insights, QlooClient, QlooError } from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Set QLOO_API_KEY and QLOO_BASE_URL in .env to run this.');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 40, timeoutMs: 120_000 });
const regions = ['New York', 'London', 'Lagos'];
const types = ['artist', 'tv_show', 'movie', 'brand'] as const;

async function step(label: string, run: () => Promise<void>): Promise<void> {
  console.log(`\n## ${label}`);
  try {
    await run();
  } catch (err) {
    console.log(
      `failed: ${err instanceof QlooError ? `${err.kind}: ${err.message}` : String(err)}`,
    );
  }
}

const topArtists = new Map<string, { id: string; name: string }>();

await step('D19: a region and an age band, no entity', async () => {
  for (const region of regions) {
    for (const type of types) {
      try {
        const { data } = await insights.entities(qloo, {
          'filter.type': `urn:entity:${type}` as 'urn:entity:movie',
          'signal.location.query': region,
          'signal.demographics.age': ['25_to_29'],
          take: 6,
        });
        const rows = data.results.entities;
        const first = rows[0];
        if (type === 'artist' && first)
          topArtists.set(region, { id: first.entity_id, name: first.name });
        console.log(`${region} ${type}: ${rows.map((e) => e.name).join(' | ') || '(nothing)'}`);
      } catch (err) {
        console.log(
          `${region} ${type}: ${err instanceof QlooError ? `${err.kind} ${err.message}` : String(err)}`,
        );
      }
    }
  }
});

await step('D20: region top artist, then the series its fans like, then their tags', async () => {
  for (const [region, artist] of topArtists) {
    const { data } = await insights.entities(qloo, {
      'filter.type': 'urn:entity:tv_show',
      'signal.interests.entities': [artist.id],
      take: 6,
    });
    const shows = data.results.entities;
    console.log(
      `${region}: top artist ${artist.name}; series: ${shows.map((e) => e.name).join(' | ') || '(nothing)'}`,
    );
    if (shows.length === 0) continue;
    for (const kind of ['archetype', 'audience']) {
      try {
        const tags = await insights.tags(qloo, {
          'signal.interests.entities': shows.map((e) => e.entity_id),
          'filter.tag.types': [`urn:tag:${kind}:qloo`],
          'filter.parents.types': ['urn:entity:tv_show'],
          take: 6,
        });
        console.log(
          `  ${kind} tags: ${tags.data.results.tags.map((t) => t.name).join(', ') || '(nothing)'}`,
        );
      } catch (err) {
        console.log(
          `  ${kind} tags: ${err instanceof QlooError ? `${err.kind} ${err.message}` : String(err)}`,
        );
      }
    }
  }
});

console.log(`\nCalls made: ${qloo.callsUsed}`);
