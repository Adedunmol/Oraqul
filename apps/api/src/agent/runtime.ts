import { QlooBudgetError, QlooError, type ToolContext, tools, toReceipt } from '@oraqul/engine';
import { packs } from '@oraqul/packs';
import type {
  Answer,
  Category,
  Job,
  ProjectInput,
  Question,
  Receipt,
  ThreadEvent,
} from '@oraqul/schema';
import { z } from 'zod';
import { ungroundedClaims } from './grounding.js';
import type { AgentContext, HistoryItem, Planner, Step } from './types.js';

type CategoryPack = (typeof packs)[Category];

/** One agent's turn-by-turn state. */
interface Loop {
  /** `film`, or `books→film` for a consult. */
  agent: string;
  pack: CategoryPack;
  job: Job;
  consultQuestion: string | undefined;
  canAsk: boolean;
  history: HistoryItem[];
  maxSteps: number;
  stepsUsed: number;
  groundingRetries: number;
}

/** A category agent's run, after the router has handed the project over. */
export interface RunState {
  project: ProjectInput;
  status: 'active' | 'waiting' | 'done';
  pending: Question | null;
  receipts: Receipt[];
  /** Receipts from the plan this run answers about: citable by id, never rerun (agent.md, Memory). */
  prior: Receipt[];
  /** The plan and the chat as text, labelled context and never evidence. */
  context: string | null;
  main: Loop;
}

export interface RuntimeDeps {
  planner: Planner;
  tools: ToolContext;
  /** Cap for another agent's bounded question (spec §3.4). */
  consultMaxSteps: number;
  emit(event: ThreadEvent): void;
}

/** The answer does not fit the run: nothing is waiting, or it names a question or option that is not. */
export class AnswerError extends Error {}

export function newRunState(
  project: ProjectInput,
  job: Job,
  maxSteps: number,
  answer?: { prior: Receipt[]; context: string; question: string },
): RunState {
  return {
    project,
    status: 'active',
    pending: null,
    receipts: [],
    prior: answer?.prior ?? [],
    context: answer?.context ?? null,
    main: {
      agent: project.category,
      pack: packs[project.category],
      job,
      consultQuestion: answer?.question,
      // An answer about a plan never stops on a card: it says what it would need instead.
      canAsk: !answer,
      history: [],
      maxSteps,
      stepsUsed: 0,
      groundingRetries: 0,
    },
  };
}

type LoopResult =
  | { outcome: 'finished'; reply: Extract<Step, { kind: 'finish' }>['reply'] }
  | { outcome: 'asked'; question: Question }
  | { outcome: 'budget' | 'steps' | 'ungrounded' };

/**
 * Runs until the agent finishes, asks the user something, or hits a limit. Call it once to
 * start and again with the user's answer to resume. Every outcome ends in a `run.stopped` event.
 */
export async function advance(state: RunState, deps: RuntimeDeps, answer?: Answer): Promise<void> {
  if (answer) acceptAnswer(state, answer);
  state.status = 'active';

  const loop = state.main;
  const result = await runLoop(state, deps, loop);

  switch (result.outcome) {
    case 'finished':
      deps.emit({ type: 'message', body: result.reply.message, claims: result.reply.claims });
      return stop(state, deps, 'finished');
    case 'asked':
      return stopAsking(state, deps, loop.agent, result.question);
    case 'budget':
      deps.emit({
        type: 'message',
        body: 'I stopped because the Qloo call budget is spent. These are the calls that were made; anything else was not tested.',
        claims: state.receipts.map((r) => ({
          text: `Called ${r.endpoint}.`,
          receiptIds: [r.callId],
        })),
      });
      return stop(state, deps, 'budget');
    case 'steps':
      deps.emit({
        type: 'error',
        message: `The agent used all ${loop.maxSteps} steps without finishing.`,
      });
      return stop(state, deps, 'steps');
    case 'ungrounded':
      deps.emit({ type: 'error', message: 'The agent kept citing receipts that do not exist.' });
      return stop(state, deps, 'error');
  }
}

function acceptAnswer(state: RunState, answer: Answer): void {
  const { pending } = state;
  if (state.status !== 'waiting' || !pending) throw new AnswerError('No question is waiting');
  if (pending.id !== answer.questionId) throw new AnswerError('That is not the question asked');
  if (answer.kind === 'options') {
    const known = new Set(pending.options.map((o) => o.id));
    if (!answer.optionIds.every((id) => known.has(id))) {
      throw new AnswerError('That option is not on the card');
    }
  }
  state.pending = null;
  state.main.history.push({ kind: 'answer', question: pending, answer });
}

function stopAsking(state: RunState, deps: RuntimeDeps, agent: string, question: Question): void {
  state.pending = question;
  deps.emit({ type: 'question', agent, ...question });
  stop(state, deps, 'waiting');
}

function stop(
  state: RunState,
  deps: RuntimeDeps,
  reason: Extract<ThreadEvent, { type: 'run.stopped' }>['reason'],
): void {
  state.status = reason === 'waiting' ? 'waiting' : 'done';
  deps.emit({ type: 'run.stopped', reason });
}

async function runLoop(state: RunState, deps: RuntimeDeps, loop: Loop): Promise<LoopResult> {
  while (loop.stepsUsed < loop.maxSteps) {
    const context: AgentContext = {
      agent: loop.agent,
      pack: loop.pack,
      project: state.project,
      job: loop.job,
      consultQuestion: loop.consultQuestion,
      canAsk: loop.canAsk,
      history: loop.history,
      receipts: state.receipts,
      prior: state.prior,
      context: state.context,
    };
    const step = await deps.planner.next(context);
    loop.stepsUsed += 1;
    const trace = (text: string) =>
      deps.emit({
        type: 'trace.step',
        agent: loop.agent,
        step: loop.stepsUsed,
        of: loop.maxSteps,
        text,
      });

    switch (step.kind) {
      case 'tool': {
        const demo = deps.tools.source === 'demo' ? ' on demo data' : '';
        trace(`Running ${step.name}${demo}`);
        if ((await runTool(state, deps, loop, step)) === 'budget') return { outcome: 'budget' };
        break;
      }
      case 'ask':
        if (!loop.canAsk) {
          loop.history.push({ kind: 'rejected', reason: 'Questions are not allowed in this run' });
          break;
        }
        trace('Asking you a question');
        return { outcome: 'asked', question: step.question };
      case 'consult': {
        trace(`Asking the ${step.category} agent: ${step.question}`);
        if ((await consult(state, deps, loop, step)) === 'budget') return { outcome: 'budget' };
        break;
      }
      case 'finish': {
        trace('Writing up what the receipts show');
        const bad = ungroundedClaims(step.reply, [...state.receipts, ...state.prior]);
        if (bad.length === 0) return { outcome: 'finished', reply: step.reply };
        loop.groundingRetries += 1;
        if (loop.groundingRetries > 1) return { outcome: 'ungrounded' };
        loop.history.push({
          kind: 'rejected',
          reason: `These claims cite receipts this run did not make: ${bad.join('; ')}`,
        });
        break;
      }
    }
  }
  return { outcome: 'steps' };
}

async function runTool(
  state: RunState,
  deps: RuntimeDeps,
  loop: Loop,
  step: Extract<Step, { kind: 'tool' }>,
): Promise<'ok' | 'budget'> {
  const { name, input } = step;
  if (!loop.pack.toolAllowlist.includes(name)) {
    loop.history.push({
      kind: 'failed',
      name,
      input,
      reason: `${name} is not allowed for this agent`,
    });
    return 'ok';
  }
  try {
    const { data, receipts } = await tools[name].run(deps.tools, input);
    for (const receipt of receipts) {
      state.receipts.push(receipt);
      deps.emit({ type: 'receipt', receipt });
    }
    loop.history.push({
      kind: 'tool',
      name,
      input,
      data,
      receiptIds: receipts.map((r) => r.callId),
    });
  } catch (err) {
    if (err instanceof QlooBudgetError) return 'budget';
    if (err instanceof QlooError) {
      // Spec §10: the line is "could not test". The receipt still cites what was asked and what came back.
      const receipt = toReceipt(err.call, {
        returned: err.call.returned,
        rule: `Could not test: ${err.message}`,
        confidence: 'lower',
        source: deps.tools.source,
      });
      state.receipts.push(receipt);
      deps.emit({ type: 'receipt', receipt });
      loop.history.push({
        kind: 'failed',
        name,
        input,
        reason: err.message,
        receiptId: receipt.callId,
      });
      return 'ok';
    }
    if (err instanceof z.ZodError) {
      loop.history.push({
        kind: 'failed',
        name,
        input,
        reason: `Input did not match ${name}'s schema`,
      });
      return 'ok';
    }
    throw err;
  }
  return 'ok';
}

/** Spec §3.4: one question, a small step cap, no questions back to the user, receipts shared. */
async function consult(
  state: RunState,
  deps: RuntimeDeps,
  loop: Loop,
  step: Extract<Step, { kind: 'consult' }>,
): Promise<'ok' | 'budget'> {
  if (!loop.canAsk || !loop.pack.consults.includes(step.category)) {
    loop.history.push({
      kind: 'rejected',
      reason: `The ${loop.agent} agent may not consult ${step.category}`,
    });
    return 'ok';
  }
  const child: Loop = {
    agent: `${loop.agent}→${step.category}`,
    pack: packs[step.category],
    job: loop.job,
    consultQuestion: step.question,
    canAsk: false,
    history: [],
    maxSteps: deps.consultMaxSteps,
    stepsUsed: 0,
    groundingRetries: 0,
  };
  const result = await runLoop(state, deps, child);
  if (result.outcome === 'budget') return 'budget';
  loop.history.push({
    kind: 'consult',
    category: step.category,
    question: step.question,
    message:
      result.outcome === 'finished'
        ? result.reply.message
        : `The ${step.category} agent could not answer.`,
    claims: result.outcome === 'finished' ? result.reply.claims : [],
  });
  return 'ok';
}
