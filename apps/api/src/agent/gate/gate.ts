import { type GateReading, gateReadingSchema, type Question, questionSchema } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import type { Handoff } from '../category-agents.js';
import { OPTIONS_HINT } from '../router/copy.js';
import type { TranscriptLine } from '../router/reader.js';

export const GATE = Symbol('GATE');

const MIN_OPTIONS = 2;

export interface GateInput {
  project: Pick<Handoff, 'category' | 'mode' | 'title'>;
  /** The last lines of the chat. The last `person` line is the message to judge. */
  recent: TranscriptLine[];
}

/** Judges a message sent to an active project before any category agent sees it. */
export interface Gate {
  check(input: GateInput): Promise<{ reading: GateReading; tokens: number }>;
}

export const GATE_SYSTEM = `You are the front door of Oraqul, a launch strategy tool for media and entertainment. A person is chatting inside a project that already has a category, a mode and a title. Decide whether their latest message is something that project's agent can work on.

Rules:
- on_topic: about launching or marketing this project or its category: follow up questions, recommendations, what-ifs, other places or dates, partners, an audience, the plan. Short or vague messages that read as a follow up to the conversation are on topic.
- off_topic: nothing to do with launching or marketing a film, series, music, book, podcast or game (for example health, relationships, cooking, homework).
- unclear: it might be about this project, or about a new project, and you cannot tell. Then write one short question that says back what you understood, with 2 or 3 options that are close readings, each a short action in their words, such as "Check how this plays in Lagos" or "Start a different project". Never offer an option for something that has nothing to do with launches.
- Never guess. When the message is plainly a follow up, use on_topic with no question.
- Plain words, no jargon, no exclamation marks.`;

export class ModelGate implements Gate {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async check({ project, recent }: GateInput) {
    const speaker = { person: 'Person', oraqul: 'Oraqul', pick: 'Person picked the option' };
    const conversation = recent.map((line) => `${speaker[line.from]}: ${line.text}`).join('\n');
    const { output, usage } = await generateText({
      model: this.model,
      system: GATE_SYSTEM,
      prompt: `Project: ${JSON.stringify(project)}\n\nConversation:\n${conversation}`,
      output: Output.object({ schema: gateReadingSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { reading: output, tokens: usage.totalTokens ?? 0 };
  }
}

/** Passes everything. Without a model there is no telling an off topic message from an unclear one. */
export class ScriptedGate implements Gate {
  async check() {
    return { reading: { fit: 'on_topic' as const, question: null }, tokens: 0 };
  }
}

/** Tries the model first; on any failure lets the message through, so a gate failure never blocks a chat. */
export class FallbackGate implements Gate {
  constructor(
    private readonly primary: Gate,
    private readonly fallback: Gate,
    private readonly onFailure: (err: unknown) => void,
  ) {}

  async check(input: GateInput) {
    try {
      return await this.primary.check(input);
    } catch (err) {
      this.onFailure(err);
      return this.fallback.check(input);
    }
  }
}

/** What an open gate card keeps between messages. Stored in `runs.state`, so it is plain JSON. */
export interface GatePending {
  question: Question;
  /** The words each option stands for, by option id. */
  picks: Record<string, string>;
}

export const gateStateSchema = z.object({
  pending: z
    .object({ question: questionSchema, picks: z.record(z.string(), z.string()) })
    .nullable(),
});

export type GateDecision =
  | { kind: 'pass' }
  | { kind: 'refuse' }
  | { kind: 'ask'; pending: GatePending };

/**
 * The move from a reading. A model that says `unclear` without two usable options passes the
 * message on instead: asking a question with nothing to pick would only stall the person.
 */
export function gateDecide(reading: GateReading, questionId: string): GateDecision {
  if (reading.fit === 'off_topic') return { kind: 'refuse' };
  if (reading.fit === 'on_topic' || !reading.question) return { kind: 'pass' };
  const { prompt, options } = reading.question;
  if (options.length < MIN_OPTIONS) return { kind: 'pass' };
  const picks: Record<string, string> = {};
  const cardOptions = options.map((o, i) => {
    const id = `o${i + 1}`;
    picks[id] = o.label;
    return { id, label: o.label, description: o.description };
  });
  return {
    kind: 'ask',
    pending: {
      question: {
        id: questionId,
        card: 'single',
        prompt,
        options: cardOptions,
        hint: OPTIONS_HINT,
      },
      picks,
    },
  };
}
