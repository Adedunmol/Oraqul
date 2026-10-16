import type { RouterReading } from '@oraqul/schema';
import { MockLanguageModelV4 } from 'ai/test';
import { CATEGORY_PROMPT, MODE_PROMPT, TITLE_PROMPT } from './copy.js';
import { applyReading, decide, type Known } from './decide.js';
import { ModelReader } from './model-reader.js';
import type { Reader } from './reader.js';
import { FallbackReader, newRouterState, RouterAnswerError, routeTurn } from './router.js';
import { ScriptedReader } from './scripted-reader.js';

const unknown: Known = { title: null, category: null, mode: null };

const reading = (over: Partial<RouterReading>): RouterReading => ({
  onTopic: true,
  title: null,
  category: null,
  mode: null,
  question: null,
  ...over,
});

/** A reader that returns fixed readings in turn, standing in for the model. */
function fixed(...readings: RouterReading[]): Reader & { calls: number } {
  const reader = {
    calls: 0,
    async read() {
      const next = readings[Math.min(reader.calls, readings.length - 1)];
      reader.calls += 1;
      if (!next) throw new Error('No reading');
      return { reading: next, tokens: 10 };
    },
  };
  return reader;
}

describe('applyReading', () => {
  it('drops a value the person never said', () => {
    const said = 'i want to launch my song';
    const next = applyReading(
      unknown,
      reading({
        title: { value: 'Midnight Sun', quote: 'Midnight Sun' },
        category: { value: 'music', quote: 'song' },
        mode: { value: 'build', quote: 'launch' },
      }),
      said,
    );
    expect(next).toEqual({ title: null, category: 'music', mode: 'build' });
  });

  it('drops a title whose quote is real but whose value is invented', () => {
    const said = 'i have a song titled tomorrow';
    const next = applyReading(
      unknown,
      reading({ title: { value: 'Yesterday', quote: 'titled tomorrow' } }),
      said,
    );
    expect(next.title).toBeNull();
  });

  it('matches quotes however the model spaced or cased them', () => {
    const said = 'Plan the  release of “Salt Road”';
    const next = applyReading(
      unknown,
      reading({ title: { value: 'salt road', quote: 'release of "Salt Road"' } }),
      said,
    );
    expect(next.title).toBe('salt road');
  });
});

describe('decide', () => {
  it('refuses an off-topic message', () => {
    expect(decide(unknown, reading({ onTopic: false }), 'q1')).toEqual({ kind: 'off_topic' });
  });

  it('asks about the category and mode before the title', () => {
    const decision = decide({ ...unknown, title: 'Tomorrow' }, null, 'q1');
    expect(decision).toMatchObject({
      kind: 'ask',
      pending: { question: { prompt: CATEGORY_PROMPT } },
    });
  });

  it('keeps only the model options that settle what is missing', () => {
    const known: Known = { title: 'Tomorrow', category: 'music', mode: null };
    const decision = decide(
      known,
      reading({
        question: {
          prompt: 'Is it a new release or one that is out?',
          options: [
            { label: 'Release this song', category: null, mode: 'build' },
            { label: 'It is a song', category: 'music', mode: null },
            { label: 'Fix issues in its current release', category: null, mode: 'rescue' },
          ],
        },
      }),
      'q1',
    );
    if (decision.kind !== 'ask') throw new Error('Expected a question');
    expect(decision.pending.question.prompt).toBe('Is it a new release or one that is out?');
    expect(decision.pending.question.options.map((o) => o.label)).toEqual([
      'Release this song',
      'Fix issues in its current release',
    ]);
    expect(decision.pending.question.card).toBe('single');
  });

  it('falls back to the fixed mode options when the model offers fewer than two useful ones', () => {
    const decision = decide(
      { title: 'Tomorrow', category: 'music', mode: null },
      reading({
        question: {
          prompt: 'Which?',
          options: [{ label: 'Release', category: null, mode: 'build' }],
        },
      }),
      'q1',
    );
    if (decision.kind !== 'ask') throw new Error('Expected a question');
    expect(decision.pending.question.prompt).toBe(MODE_PROMPT);
    expect(decision.pending.question.options).toHaveLength(3);
  });

  it('asks for the title last, as a text card', () => {
    const decision = decide({ title: null, category: 'film', mode: 'audit' }, null, 'q1');
    expect(decision).toMatchObject({
      kind: 'ask',
      pending: { question: { card: 'text', prompt: TITLE_PROMPT } },
    });
  });

  it('routes once all three are known', () => {
    expect(decide({ title: 'Ember Quay', category: 'games', mode: 'build' }, null, 'q1')).toEqual({
      kind: 'routed',
      title: 'Ember Quay',
      category: 'games',
      mode: 'build',
    });
  });
});

describe('routeTurn', () => {
  it('settles a pick with no model call, then asks for the title', async () => {
    const reader = fixed(
      reading({
        question: {
          prompt: 'Looks like a music release or a game. What would you like to do?',
          options: [
            { label: 'Work on a song release', category: 'music', mode: 'build' },
            { label: 'Work on a game launch', category: 'games', mode: 'build' },
          ],
        },
      }),
    );
    const state = newRouterState({});
    const first = await routeTurn(
      state,
      { kind: 'message', text: 'i know how to sing and produce game' },
      reader,
    );
    expect(first.decision.kind).toBe('ask');
    const questionId = state.pending?.question.id ?? '';

    const second = await routeTurn(
      state,
      { kind: 'answer', answer: { kind: 'options', questionId, optionIds: ['o2'] } },
      reader,
    );
    expect(reader.calls).toBe(1);
    expect(state.known).toMatchObject({ category: 'games', mode: 'build' });
    expect(second.decision).toMatchObject({ kind: 'ask', pending: { question: { card: 'text' } } });
  });

  it('never takes a quote from an option the model wrote and the person picked', async () => {
    const state = newRouterState({});
    await routeTurn(
      state,
      { kind: 'message', text: 'i know how to sing and produce game' },
      fixed(
        reading({
          question: {
            prompt: 'Music or games?',
            options: [
              { label: 'Sing and produce music', category: 'music', mode: null },
              { label: 'Launch a game', category: 'games', mode: null },
            ],
          },
        }),
      ),
    );
    const questionId = state.pending?.question.id ?? '';
    const { decision } = await routeTurn(
      state,
      { kind: 'answer', answer: { kind: 'options', questionId, optionIds: ['o2'] } },
      fixed(reading({ mode: { value: 'build', quote: 'Launch a game' } })),
    );
    expect(state.known).toMatchObject({ category: 'games', mode: null });
    expect(decision).toMatchObject({ kind: 'ask', pending: { question: { prompt: MODE_PROMPT } } });
  });

  it('reads a typed answer with the whole conversation', async () => {
    const reader = fixed(
      reading({
        category: { value: 'music', quote: 'song' },
        title: { value: 'tomorrow', quote: 'titled tomorrow' },
      }),
      reading({
        category: { value: 'music', quote: 'song' },
        title: { value: 'tomorrow', quote: 'titled tomorrow' },
        mode: { value: 'rescue', quote: 'it flopped' },
      }),
    );
    const state = newRouterState({});
    await routeTurn(state, { kind: 'message', text: 'i have a song titled tomorrow' }, reader);
    const { decision } = await routeTurn(state, { kind: 'message', text: 'it flopped' }, reader);
    expect(decision).toEqual({
      kind: 'routed',
      title: 'tomorrow',
      category: 'music',
      mode: 'rescue',
    });
  });

  it('starts from the hints on the start page', async () => {
    const state = newRouterState({ mode: 'audit', category: 'books' });
    const { decision } = await routeTurn(
      state,
      { kind: 'message', text: 'Harbour Season' },
      fixed(reading({ title: { value: 'Harbour Season', quote: 'Harbour Season' } })),
    );
    expect(decision).toEqual({
      kind: 'routed',
      title: 'Harbour Season',
      category: 'books',
      mode: 'audit',
    });
  });

  it('rejects a pick that is not on the open card', async () => {
    const state = newRouterState({});
    await routeTurn(state, { kind: 'message', text: 'hello' }, fixed(reading({})));
    const questionId = state.pending?.question.id ?? '';
    await expect(
      routeTurn(
        state,
        { kind: 'answer', answer: { kind: 'options', questionId, optionIds: ['o99'] } },
        fixed(reading({})),
      ),
    ).rejects.toBeInstanceOf(RouterAnswerError);
  });
});

describe('ScriptedReader', () => {
  const read = async (text: string) =>
    (await new ScriptedReader().read({ transcript: [{ from: 'person', text }], known: unknown }))
      .reading;

  it('reads the title and category but not the mode from "i have a song titled tomorrow"', async () => {
    const r = await read('i have a song titled tomorrow');
    expect(r.title?.value).toBe('tomorrow');
    expect(r.category?.value).toBe('music');
    expect(r.mode).toBeNull();
  });

  it('offers both categories when a message names two', async () => {
    const r = await read('i know how to sing and produce a song and a game');
    expect(r.category).toBeNull();
    expect(r.question?.options.map((o) => o.category)).toEqual(['music', 'games']);
  });

  it('reads a fix as a rescue even when it says release', async () => {
    expect((await read('fix issues in the current release of my album')).mode?.value).toBe(
      'rescue',
    );
  });

  it('reads a quoted title and a plan check', async () => {
    const r = await read('Check my plan for the film "Salt Road"');
    expect(r.title?.value).toBe('Salt Road');
    expect(r.category?.value).toBe('film');
    expect(r.mode?.value).toBe('audit');
  });
});

describe('ModelReader', () => {
  it('parses the model output with the router schema', async () => {
    const output = reading({ category: { value: 'podcasts', quote: 'podcast' } });
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 40, noCache: 40, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 12, text: 12, reasoning: 0 },
        },
        warnings: [],
      },
    });
    const result = await new ModelReader(model, 5_000).read({
      transcript: [{ from: 'person', text: 'my podcast' }],
      known: unknown,
    });
    expect(result.reading).toEqual(output);
    expect(result.tokens).toBe(52);
  });

  it('falls back to the scripted reader when the model fails', async () => {
    const failures: unknown[] = [];
    const broken: Reader = {
      read: async () => {
        throw new Error('quota');
      },
    };
    const reader = new FallbackReader(broken, new ScriptedReader(), (err) => failures.push(err));
    const { reading: r } = await reader.read({
      transcript: [{ from: 'person', text: 'my podcast' }],
      known: unknown,
    });
    expect(r.category?.value).toBe('podcasts');
    expect(failures).toHaveLength(1);
  });
});

describe('routeTurn on the title card', () => {
  const asking = () => {
    const state = newRouterState({ category: 'books', mode: 'build' });
    state.pending = {
      question: { id: 'router.q3', card: 'text', prompt: TITLE_PROMPT, options: [], hint: '' },
      settles: {},
    };
    return state;
  };

  it('takes a bare typed name as the title without calling the model', async () => {
    const reader = fixed(reading({}));
    const { decision } = await routeTurn(asking(), { kind: 'message', text: 'oh papa' }, reader);
    expect(decision).toEqual({
      kind: 'routed',
      title: 'oh papa',
      category: 'books',
      mode: 'build',
    });
    expect(reader.calls).toBe(0);
  });

  it('does not take an attached file as the title', async () => {
    const reader = fixed(reading({}));
    const { decision } = await routeTurn(
      asking(),
      { kind: 'message', text: '[File: plan.txt]\nlots of text' },
      reader,
    );
    expect(decision.kind).toBe('ask');
  });
});
