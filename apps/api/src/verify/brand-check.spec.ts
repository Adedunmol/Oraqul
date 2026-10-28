import { describe, expect, it } from 'vitest';
import { NoBrandChecker, WikidataBrandChecker } from './brand-check.js';

interface Fake {
  search?: Record<string, { id: string; description: string }[]>;
  claims?: Record<string, Record<string, unknown[]>>;
  labels?: Record<string, string>;
  fail?: boolean;
}

function fakeFetch(fake: Fake) {
  const calls: string[] = [];
  const impl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    calls.push(url.searchParams.get('action') ?? '');
    if (fake.fail) return new Response('down', { status: 503 });
    const action = url.searchParams.get('action');
    let body: unknown = {};
    if (action === 'wbsearchentities') {
      body = { search: fake.search?.[url.searchParams.get('search') ?? ''] ?? [] };
    } else if (url.searchParams.get('props') === 'claims') {
      const id = url.searchParams.get('ids') ?? '';
      body = { entities: { [id]: { claims: fake.claims?.[id] ?? {} } } };
    } else {
      const id = url.searchParams.get('ids') ?? '';
      body = { entities: { [id]: { labels: { en: { value: fake.labels?.[id] ?? '' } } } } };
    }
    return new Response(JSON.stringify(body), { status: 200 });
  };
  return { impl, calls };
}

const time = (t: string) => ({ mainsnak: { datavalue: { value: { time: t } } } });
const item = (id: string) => ({ mainsnak: { datavalue: { value: { id } } } });

describe('WikidataBrandChecker', () => {
  it('marks a brand that no longer exists as a problem, with the year', async () => {
    const f = fakeFetch({
      search: { 'SunTrust Banks': [{ id: 'Q1', description: 'American bank holding company' }] },
      claims: { Q1: { P576: [time('+2019-00-00T00:00:00Z')] } },
    });
    const checker = new WikidataBrandChecker({ fetch: f.impl, year: () => 2026 });
    const out = await checker.check(['SunTrust Banks']);
    expect(out.get('SunTrust Banks')).toEqual({
      state: 'problem',
      note: 'No longer exists: it closed in 2019.',
      country: null,
    });
  });

  it('verifies a live brand and says where it is based', async () => {
    const f = fakeFetch({
      search: { 'Ahmad Tea': [{ id: 'Q2', description: 'British family-owned tea company' }] },
      claims: { Q2: { P495: [item('Q145')] } },
      labels: { Q145: 'United Kingdom' },
    });
    const out = await new WikidataBrandChecker({ fetch: f.impl }).check(['Ahmad Tea']);
    expect(out.get('Ahmad Tea')).toEqual({
      state: 'verified',
      note: null,
      country: 'United Kingdom',
    });
  });

  it('skips a hit that reads as a person, place or work, and leaves the brand unverified', async () => {
    const f = fakeFetch({
      search: {
        VOXI: [{ id: 'Q3', description: 'German cinematographer' }],
        EE: [{ id: 'Q191', description: 'country in Northern Europe' }],
      },
    });
    const out = await new WikidataBrandChecker({ fetch: f.impl }).check(['VOXI', 'EE']);
    expect(out.get('VOXI')?.state).toBe('unverified');
    expect(out.get('EE')?.state).toBe('unverified');
  });

  it('leaves a brand it cannot find unverified', async () => {
    const f = fakeFetch({});
    const out = await new WikidataBrandChecker({ fetch: f.impl }).check(['Aqua Hydrate']);
    expect(out.get('Aqua Hydrate')).toEqual({ state: 'unverified', note: null, country: null });
  });

  it('never throws when the source is down: every name is unverified, and nothing is cached', async () => {
    const down = fakeFetch({ fail: true });
    const checker = new WikidataBrandChecker({ fetch: down.impl });
    expect((await checker.check(['Lyft'])).get('Lyft')?.state).toBe('unverified');
    expect(down.calls).toHaveLength(1);
    await checker.check(['Lyft']);
    expect(down.calls).toHaveLength(2);
  });

  it('keeps an answer, so the same brand is not asked twice', async () => {
    const f = fakeFetch({
      search: { Lyft: [{ id: 'Q4', description: 'American transportation network company' }] },
    });
    const checker = new WikidataBrandChecker({ fetch: f.impl });
    await checker.check(['Lyft']);
    const calls = f.calls.length;
    await checker.check(['Lyft', 'Lyft']);
    expect(f.calls).toHaveLength(calls);
  });

  it('does nothing with no checker configured', async () => {
    const out = await new NoBrandChecker().check(['Lyft']);
    expect(out.get('Lyft')?.state).toBe('unverified');
  });
});
