import { type Analysis, type Analyst } from './analyse.js';
import { type BriefMemos, MemoizedAnalyst, MemoizedQueryPlanner, memoKey } from './memo.js';
import type { QueryPlanCore, QueryPlanner } from './planner.js';
import type { LaunchRead } from './read-core.js';

const read: LaunchRead = {
  genre: null,
  country: null,
  places: [],
  comps: [],
  suggestedComps: [],
  ages: [],
  gender: null,
  window: null,
  budget: null,
  partners: [],
  scope: 'full',
  ask: null,
};

class MapMemos implements BriefMemos {
  readonly map = new Map<string, unknown>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async set(key: string, _kind: string, value: unknown) {
    this.map.set(key, value);
  }
}

const analysis: Analysis = {
  asked: 'A plan.',
  goals: [],
  constraints: [],
  inferred: [],
  criteria: [
    { text: 'a', evidence: true },
    { text: 'b', evidence: true },
  ],
  readers: null,
  comps: [{ name: 'Atomic Habits', why: 'fits' }],
};

describe('memoKey', () => {
  it('is the same for the same input and differs when the input or the prompt version does', () => {
    expect(memoKey('analysis', 'v1', { a: 1 })).toBe(memoKey('analysis', 'v1', { a: 1 }));
    expect(memoKey('analysis', 'v1', { a: 1 })).not.toBe(memoKey('analysis', 'v1', { a: 2 }));
    expect(memoKey('analysis', 'v1', { a: 1 })).not.toBe(memoKey('analysis', 'v2', { a: 1 }));
    expect(memoKey('analysis', 'v1', { a: 1 })).not.toBe(memoKey('query-plan', 'v1', { a: 1 }));
  });
});

describe('MemoizedAnalyst', () => {
  it('asks the model once and then answers the same request from memory', async () => {
    let calls = 0;
    const inner: Analyst = {
      async analyse() {
        calls += 1;
        return { analysis, tokens: 10 };
      },
    };
    const memo = new MemoizedAnalyst(inner, new MapMemos(), 'v1');
    const input = { category: 'books', title: 'T', text: 'a book', read };
    expect((await memo.analyse(input)).tokens).toBe(10);
    const again = await memo.analyse(input);
    expect(again).toEqual({ analysis, tokens: 0 });
    expect(calls).toBe(1);
    await memo.analyse({ ...input, text: 'another book' });
    expect(calls).toBe(2);
  });

  it('pins the analysis to the words, not to what the reader made of them', async () => {
    let calls = 0;
    const inner: Analyst = {
      async analyse() {
        calls += 1;
        return { analysis, tokens: 10 };
      },
    };
    const memo = new MemoizedAnalyst(inner, new MapMemos(), 'v1');
    const input = { category: 'books', title: 'T', text: 'A  Book\n', read };
    await memo.analyse(input);
    const again = await memo.analyse({
      ...input,
      text: 'a book',
      read: { ...read, places: ['Elsewhere'] },
    });
    expect(again.tokens).toBe(0);
    expect(calls).toBe(1);
  });

  it('ignores a stored value that no longer fits the schema, and a store that fails', async () => {
    let calls = 0;
    const inner: Analyst = {
      async analyse() {
        calls += 1;
        return { analysis, tokens: 1 };
      },
    };
    const store = new MapMemos();
    const input = { category: 'books', title: 'T', text: 'a book', read };
    store.map.set(memoKey('analysis', 'v1', { category: 'books', title: 'T', text: 'a book' }), {
      nonsense: true,
    });
    await new MemoizedAnalyst(inner, store, 'v1').analyse(input);
    expect(calls).toBe(1);
    const broken: BriefMemos = {
      async get() {
        throw new Error('db down');
      },
      async set() {
        throw new Error('db down');
      },
    };
    const errors: unknown[] = [];
    await new MemoizedAnalyst(inner, broken, 'v1', (e) => errors.push(e)).analyse(input);
    expect(calls).toBe(2);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('does not remember a missing analysis', async () => {
    const store = new MapMemos();
    const inner: Analyst = {
      async analyse() {
        return { analysis: null, tokens: 0 };
      },
    };
    await new MemoizedAnalyst(inner, store, 'v1').analyse({
      category: 'books',
      title: 'T',
      text: 'x',
      read,
    });
    expect(store.map.size).toBe(0);
  });
});

describe('MemoizedQueryPlanner', () => {
  const plan: QueryPlanCore = {
    queries: ['audience'],
    cities: ['Lagos'],
    worthALook: [],
    country: null,
    areas: [],
    brandCandidates: [],
  };
  it('gives the same plan for the same brief, and plans afresh for a different one', async () => {
    let calls = 0;
    const inner: QueryPlanner = {
      async plan() {
        calls += 1;
        return { plan, tokens: 5 };
      },
    };
    const memo = new MemoizedQueryPlanner(inner, new MapMemos(), 'v1');
    const input = { title: 'T', read, modules: [], compsCountry: null };
    expect(await memo.plan(input)).toEqual({ plan, tokens: 5 });
    expect(await memo.plan(input)).toEqual({ plan, tokens: 0 });
    await memo.plan({ ...input, title: 'Other' });
    expect(calls).toBe(2);
  });

  it('pins the plan to the words when the run has them, whatever the reader returned', async () => {
    let calls = 0;
    const inner: QueryPlanner = {
      async plan() {
        calls += 1;
        return { plan, tokens: 5 };
      },
    };
    const memo = new MemoizedQueryPlanner(inner, new MapMemos(), 'v1');
    const input = { title: 'T', text: 'a book', read, modules: [], compsCountry: null };
    await memo.plan(input);
    await memo.plan({ ...input, read: { ...read, places: ['Elsewhere'] }, compsCountry: 'NG' });
    expect(calls).toBe(1);
    await memo.plan({ ...input, text: 'a different book' });
    expect(calls).toBe(2);
  });

  it('plans afresh when the stored value does not look like a plan', async () => {
    const store = new MapMemos();
    const input = { title: 'T', read, modules: [], compsCountry: null };
    store.map.set(memoKey('query-plan', 'v1', input), { queries: 'no' });
    let calls = 0;
    const inner: QueryPlanner = {
      async plan() {
        calls += 1;
        return { plan, tokens: 1 };
      },
    };
    await new MemoizedQueryPlanner(inner, store, 'v1').plan(input);
    expect(calls).toBe(1);
  });
});
