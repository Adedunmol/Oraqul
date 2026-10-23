/**
 * Live check of what Live shows can lean on (docs/backend/qloo.md): which Qloo type a comedian, a
 * stage play and a concert act resolve as, and which venue categories list real venues per city.
 *
 *   pnpm --filter @oraqul/engine qloo:shows-probes
 *
 * Only public names go to Qloo. The output names entities so it can be judged by eye and saves
 * nothing. About 70 calls.
 */

import type { SeenEntity, ToolContext } from '../src';
import { insights, lookup, QlooClient, QlooError, resolveBundleOutputSchema, tools } from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;
if (!apiKey || !baseUrl) {
  console.log('Set QLOO_API_KEY and QLOO_BASE_URL in .env to run this.');
  process.exit(0);
}

const qloo = new QlooClient({ apiKey, baseUrl, callBudget: 150, timeoutMs: 120_000 });
const ctx: ToolContext = { qloo, source: 'qloo', entities: new Map<string, SeenEntity>() };

const acts = {
  concert: (process.env.PROBE_CONCERT ?? 'Burna Boy,Wizkid,Davido').split(','),
  comedy: (process.env.PROBE_COMEDY ?? 'Basketmouth,Kevin Hart,Trevor Noah').split(','),
  play: (process.env.PROBE_PLAYS ?? 'Hamilton,The Lion King,Wicked').split(','),
};
const types = ['urn:entity:artist', 'urn:entity:person', 'urn:entity:tv_show', 'urn:entity:movie'];
const venueTags = (
  process.env.PROBE_VENUES ?? 'comedy club,theater,night club,concert hall,movie theater'
).split(',');
const cities = (process.env.PROBE_CITIES ?? 'Lagos,London,New York,Accra').split(',');

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

await step('Which type does each act resolve as', async () => {
  for (const [kind, names] of Object.entries(acts)) {
    for (const name of names) {
      const row: string[] = [];
      for (const type of types) {
        const { data } = await lookup.search(qloo, {
          query: name,
          types: [type as never],
          take: 1,
        });
        const top = data.results[0];
        const exact = top && top.name.toLowerCase() === name.toLowerCase();
        row.push(
          `${type.replace('urn:entity:', '')}: ${top ? `${exact ? 'EXACT ' : ''}${top.name}` : '-'}`,
        );
      }
      console.log(`${kind} | ${name} | ${row.join(' | ')}`);
    }
  }
});

let signal: string[] = [];
await step('Concert acts as the audience signal', async () => {
  const { data } = await tools.resolveBundle.run(ctx, {
    names: acts.concert,
    types: ['urn:entity:artist'] as never,
  });
  signal = resolveBundleOutputSchema.parse(data).entityIds;
  console.log(`${signal.length} artists resolved`);
});
if (signal.length === 0) process.exit(0);

await step('Venue categories, per city', async () => {
  for (const phrase of venueTags) {
    const { data } = await lookup.tags(qloo, {
      'filter.query': phrase,
      'filter.tag.types': ['urn:tag:category:place'],
      take: 3,
    });
    const tag = data.results.tags[0];
    console.log(
      `tag "${phrase}": ${data.results.tags.map((t) => `${t.id} (${t.name})`).join(' | ') || '(none)'}`,
    );
    if (!tag) continue;
    for (const city of cities) {
      try {
        const { data: list } = await insights.entities(qloo, {
          take: 6,
          'filter.type': 'urn:entity:place',
          'signal.interests.entities': signal,
          'filter.tags': [tag.id],
          'filter.location.query': city,
        });
        const names = list.results.entities.map((e) => e.name);
        console.log(`  ${phrase} in ${city}: ${names.length ? names.join(' | ') : '(nothing)'}`);
      } catch (err) {
        console.log(`  ${phrase} in ${city}: failed ${err instanceof QlooError ? err.kind : err}`);
      }
    }
  }
});

await step('Audience of a comedian and of a play, as a signal for cities', async () => {
  for (const [kind, type, names] of [
    ['comedy as person', 'urn:entity:person', acts.comedy],
    ['comedy as tv_show', 'urn:entity:tv_show', acts.comedy],
    ['play as movie', 'urn:entity:movie', acts.play],
  ] as const) {
    const { data } = await tools.resolveBundle.run(ctx, {
      names: [...names],
      types: [type] as never,
    });
    const ids = resolveBundleOutputSchema.parse(data).entityIds;
    if (ids.length === 0) {
      console.log(`${kind}: none resolved`);
      continue;
    }
    try {
      const { data: list } = await insights.entities(qloo, {
        take: 5,
        'filter.type': 'urn:entity:artist',
        'signal.interests.entities': ids,
        'signal.location.query': 'London',
      });
      console.log(
        `${kind}: ${ids.length} resolved, artists in London: ${list.results.entities.map((e) => e.name).join(' | ') || '(nothing)'}`,
      );
    } catch (err) {
      console.log(
        `${kind}: ${ids.length} resolved, insights failed ${err instanceof QlooError ? err.kind : err}`,
      );
    }
  }
});
