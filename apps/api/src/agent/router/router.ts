import {
  type Answer,
  type Category,
  categorySchema,
  questionSchema,
  type StartMode,
  startModeSchema,
} from '@oraqul/schema';
import { z } from 'zod';
import {
  applyReading,
  decide,
  type Known,
  type PendingQuestion,
  type RouterDecision,
} from './decide.js';
import { personText, type Reader, type TranscriptLine } from './reader.js';

/** What the router keeps between turns. Stored in `runs.state`, so it is plain JSON. */
export interface RouterState {
  known: Known;
  transcript: TranscriptLine[];
  pending: PendingQuestion | null;
  /** Counts questions, so each one has its own id. */
  asked: number;
}

/** Parses `runs.state` back, since what comes out of the database is untrusted. */
export const routerStateSchema: z.ZodType<RouterState> = z.object({
  known: z.object({
    title: z.string().nullable(),
    category: categorySchema.nullable(),
    mode: startModeSchema.nullable(),
  }),
  transcript: z.array(z.object({ from: z.enum(['person', 'oraqul', 'pick']), text: z.string() })),
  pending: z
    .object({
      question: questionSchema,
      settles: z.record(
        z.string(),
        z.object({
          label: z.string(),
          category: categorySchema.nullable(),
          mode: startModeSchema.nullable(),
        }),
      ),
    })
    .nullable(),
  asked: z.number().int().min(0),
});

/** A typed message (which also answers an open question) or a pick on the open card. */
export type RouterTurn = { kind: 'message'; text: string } | { kind: 'answer'; answer: Answer };

/** The answer does not fit: nothing is open, or it names a question or option that is not. */
export class RouterAnswerError extends Error {}

export function newRouterState(hints: { category?: Category; mode?: StartMode }): RouterState {
  return {
    known: { title: null, category: hints.category ?? null, mode: hints.mode ?? null },
    transcript: [],
    pending: null,
    asked: 0,
  };
}

/**
 * One router turn (spec §3.1). A pick on the card settles what that option names with no model
 * call; anything typed is added to the conversation and the whole conversation is read again.
 * Mutates `state`. Returns the decision and the tokens the model used.
 */
export async function routeTurn(
  state: RouterState,
  turn: RouterTurn,
  reader: Reader,
): Promise<{ decision: RouterDecision; tokens: number }> {
  const titling = state.pending?.question.card === 'text';
  if (turn.kind === 'answer') {
    const picked = pick(state, turn.answer);
    if (titling && turn.answer.kind === 'text') state.known.title = titleFrom(turn.answer.text);
    if (picked) {
      if (picked.category) state.known.category = picked.category;
      if (picked.mode) state.known.mode = picked.mode;
      state.transcript.push({ from: 'pick', text: picked.label });
    }
    state.pending = null;
    if (state.known.category !== null && state.known.mode !== null) {
      return { decision: settle(state, decide(state.known, null, nextId(state))), tokens: 0 };
    }
  } else {
    state.transcript.push({ from: 'person', text: turn.text });
    state.pending = null;
    if (titling) {
      state.known.title = titleFrom(turn.text) ?? state.known.title;
      if (state.known.title !== null && state.known.category && state.known.mode) {
        return { decision: settle(state, decide(state.known, null, nextId(state))), tokens: 0 };
      }
    }
  }

  const { reading, tokens } = await reader.read({
    transcript: state.transcript,
    known: state.known,
  });
  if (reading.onTopic) {
    state.known = applyReading(state.known, reading, personText(state.transcript));
  }
  return { decision: settle(state, decide(state.known, reading, nextId(state))), tokens };
}

/**
 * Checks an answer against the open card and returns the words to show on the folded card.
 * Throws `RouterAnswerError` when it does not fit, before any run starts.
 */
export function answerLabel(state: RouterState, answer: Answer): string {
  const settles = settlesOf(state, answer);
  return answer.kind === 'text' ? answer.text : (settles?.label ?? '');
}

function settlesOf(state: RouterState, answer: Answer) {
  const { pending } = state;
  if (!pending) throw new RouterAnswerError('No question is waiting');
  if (pending.question.id !== answer.questionId) {
    throw new RouterAnswerError('That is not the question asked');
  }
  if (answer.kind === 'text') return null;
  const [optionId] = answer.optionIds;
  const settles = optionId ? pending.settles[optionId] : undefined;
  if (!settles || answer.optionIds.length !== 1) {
    throw new RouterAnswerError('That option is not on the card');
  }
  return settles;
}

/** Returns what the picked option settles, or null for a typed answer to the open card. */
function pick(state: RouterState, answer: Answer) {
  const settles = settlesOf(state, answer);
  if (answer.kind === 'text') state.transcript.push({ from: 'person', text: answer.text });
  return settles;
}

const MAX_TITLE_CHARS = 80;

/**
 * The reply to "What is it called?" is the title itself, so it is taken as typed rather than
 * searched for a quote: a bare name has no "called" or quotation marks to find. Only the first
 * line counts, so an attached file's text (added after it) never becomes the title.
 */
function titleFrom(text: string): string | null {
  const line = text.trim().split('\n')[0]?.trim() ?? '';
  if (line === '' || line.startsWith('[File:') || line.startsWith('[Attached file:')) return null;
  return line.slice(0, MAX_TITLE_CHARS);
}

function nextId(state: RouterState): string {
  return `router.q${state.asked + 1}`;
}

function settle(state: RouterState, decision: RouterDecision): RouterDecision {
  if (decision.kind === 'ask') {
    state.pending = decision.pending;
    state.asked += 1;
    state.transcript.push({ from: 'oraqul', text: decision.pending.question.prompt });
  }
  return decision;
}

/** Tries the model first; on any failure reads with the scripted reader, which never guesses. */
export class FallbackReader implements Reader {
  constructor(
    private readonly primary: Reader,
    private readonly fallback: Reader,
    private readonly onFailure: (err: unknown) => void,
  ) {}

  async read(input: Parameters<Reader['read']>[0]) {
    try {
      return await this.primary.read(input);
    } catch (err) {
      this.onFailure(err);
      return this.fallback.read(input);
    }
  }
}
