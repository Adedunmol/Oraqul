import { randomUUID } from 'node:crypto';
import { demoFetch, QlooClient } from '@oraqul/engine';
import { demoProjects } from '@oraqul/packs';
import type { Answer, Category, ThreadEvent } from '@oraqul/schema';
import { AnswerError, advance, newRunState, type RuntimeDeps } from './runtime.js';
import { ScriptedPlanner } from './scripted-planner.js';
import type { Planner } from './types.js';

function setup(
  category: Category,
  options: { planner?: Planner; callBudget?: number; fetch?: typeof fetch } = {},
) {
  const events: ThreadEvent[] = [];
  const qloo = new QlooClient({
    baseUrl: 'https://demo.invalid',
    apiKey: 'demo',
    fetch: options.fetch ?? demoFetch,
    callBudget: options.callBudget,
    retryDelayMs: 0,
  });
  const deps: RuntimeDeps = {
    planner: options.planner ?? new ScriptedPlanner(),
    tools: { qloo, source: 'demo' },
    maxSteps: 12,
    consultMaxSteps: 4,
    emit: (event) => events.push(event),
  };
  const state = newRunState(demoProjects[category], 'start');
  const lastOf = <T extends ThreadEvent['type']>(type: T) =>
    events.findLast((e): e is Extract<ThreadEvent, { type: T }> => e.type === type);
  return { events, deps, state, lastOf };
}

const confirm: Answer = { kind: 'options', questionId: 'router.confirm', optionIds: ['start'] };

describe('film agent with demo data', () => {
  it('asks to confirm the reading, then asks which title, then answers with receipts', async () => {
    const { events, deps, state, lastOf } = setup('film');

    await advance(state, deps);
    expect(lastOf('question')).toMatchObject({ agent: 'router', card: 'confirm' });
    expect(lastOf('run.stopped')?.reason).toBe('waiting');

    await advance(state, deps, confirm);
    expect(lastOf('question')).toMatchObject({
      id: 'entity.match',
      agent: 'film',
      card: 'match',
    });

    await advance(state, deps, {
      kind: 'options',
      questionId: 'entity.match',
      optionIds: ['DEMO-FILM-0001'],
    });
    expect(lastOf('run.stopped')?.reason).toBe('finished');

    const message = lastOf('message');
    const receiptIds = new Set(
      events.flatMap((e) => (e.type === 'receipt' ? [e.receipt.callId] : [])),
    );
    expect(message?.claims.length).toBeGreaterThan(0);
    for (const claim of message?.claims ?? []) {
      for (const id of claim.receiptIds) expect(receiptIds.has(id)).toBe(true);
    }
    expect(message?.body).toContain('demo data');
    expect(events.every((e) => e.type !== 'receipt' || e.receipt.source === 'demo')).toBe(true);
  });

  it('rejects an answer to a question that was not asked', async () => {
    const { deps, state } = setup('film');
    await advance(state, deps);
    await expect(
      advance(state, deps, { kind: 'options', questionId: 'other', optionIds: ['start'] }),
    ).rejects.toBeInstanceOf(AnswerError);
  });

  it('rejects an option that is not on the card', async () => {
    const { deps, state } = setup('film');
    await advance(state, deps);
    await expect(
      advance(state, deps, { kind: 'options', questionId: 'router.confirm', optionIds: ['nope'] }),
    ).rejects.toBeInstanceOf(AnswerError);
  });

  it('rejects an answer when nothing is waiting', async () => {
    const { deps, state } = setup('music');
    await advance(state, deps);
    await advance(state, deps, confirm);
    await expect(advance(state, deps, confirm)).rejects.toBeInstanceOf(AnswerError);
  });
});

describe('books agent consulting film', () => {
  it('shows the consult in the trace and carries the film agent’s receipts', async () => {
    const { events, deps, state, lastOf } = setup('books');
    await advance(state, deps);
    await advance(state, deps, confirm);

    expect(lastOf('run.stopped')?.reason).toBe('finished');
    const agents = new Set(events.flatMap((e) => (e.type === 'trace.step' ? [e.agent] : [])));
    expect(agents).toEqual(new Set(['router', 'books', 'books→film']));
    const claims = lastOf('message')?.claims ?? [];
    expect(claims.some((c) => c.text.startsWith('film agent:'))).toBe(true);
  });
});

describe('limits and failures', () => {
  it('stops on the Qloo call budget and lists the calls it did make', async () => {
    const { deps, state, lastOf } = setup('music', { callBudget: 1 });
    await advance(state, deps);
    await advance(state, deps, confirm);

    expect(lastOf('run.stopped')?.reason).toBe('budget');
    expect(lastOf('message')?.claims).toHaveLength(1);
  });

  it('turns a Qloo failure into a could-not-test line with its own receipt', async () => {
    const down: typeof fetch = async () => new Response('bad gateway', { status: 502 });
    const { events, deps, state, lastOf } = setup('music', { fetch: down });
    await advance(state, deps);
    await advance(state, deps, confirm);

    const receipt = events.find((e) => e.type === 'receipt');
    expect(receipt).toMatchObject({ receipt: { confidence: 'lower' } });
    expect(lastOf('message')?.body).toContain('Could not test');
    expect(lastOf('message')?.claims[0]?.receiptIds).toEqual([
      receipt?.type === 'receipt' ? receipt.receipt.callId : '',
    ]);
    expect(lastOf('run.stopped')?.reason).toBe('finished');
  });

  it('refuses a finish that cites a receipt the run never made, then gives up', async () => {
    const invented: Planner = {
      next: async () => ({
        kind: 'finish',
        reply: { message: 'Trust me.', claims: [{ text: 'Made up.', receiptIds: [randomUUID()] }] },
      }),
    };
    const { events, deps, state, lastOf } = setup('music', { planner: invented });
    await advance(state, deps);
    await advance(state, deps, confirm);

    expect(events.some((e) => e.type === 'message')).toBe(false);
    expect(lastOf('error')).toBeDefined();
    expect(lastOf('run.stopped')?.reason).toBe('error');
  });

  it('stops at the step limit when the planner never finishes', async () => {
    const stuck: Planner = {
      next: async () => ({
        kind: 'tool',
        name: 'searchEntity',
        input: { name: 'Neon Tide', types: ['urn:entity:artist'] },
      }),
    };
    const { deps, state, lastOf } = setup('music', { planner: stuck });
    await advance(state, deps);
    await advance(state, deps, confirm);

    expect(lastOf('run.stopped')?.reason).toBe('steps');
  });
});
