import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import { normalise } from '../router/decide.js';

export const MEMORY_WRITER = Symbol('MEMORY_WRITER');

/** Most notes a project keeps beside its plans, so the block a chat reads stays short. */
export const MAX_NOTES = 30;
const MAX_OPS = 6;
export const MAX_TEXT = 280;

export interface Note {
  id: string;
  kind: 'point' | 'decision';
  text: string;
}

/** One exchange the project may learn from: what the person said and what Oraqul answered. */
export interface MemoryTurn {
  category: string;
  title: string;
  notes: Note[];
  message: string;
  reply: string;
  /** Set when the exchange made a plan or a report. */
  output: { label: string; headline: string } | null;
}

export const memoryOpsSchema = z.object({
  ops: z
    .array(
      z.object({
        op: z.enum(['add', 'update', 'remove']),
        /** For an add. */
        kind: z.enum(['point', 'decision']).nullable(),
        /** For an update or a remove. */
        id: z.string().nullable(),
        /** For an add or an update. */
        text: z.string().nullable(),
      }),
    )
    .max(MAX_OPS),
});
export type MemoryOps = z.infer<typeof memoryOpsSchema>;

export type MemoryOp =
  | { op: 'add'; kind: 'point' | 'decision'; text: string }
  | { op: 'update'; id: string; text: string }
  | { op: 'remove'; id: string };

export interface MemoryWriter {
  write(turn: MemoryTurn): Promise<{ ops: MemoryOps | null; tokens: number }>;
}

export const MEMORY_SYSTEM = `You keep the memory of one project in Oraqul, a launch planner for media and entertainment, the way a careful assistant keeps notes for later conversations.

You get the notes already kept, then one exchange: what the person said and what Oraqul answered. Decide what a later chat in this project needs to know.

Keep, as short plain sentences:
- decisions and changes to the plan: a city added or dropped, a window moved, a budget, a comp swapped, a partner signed ("Dropped Lagos; opening in London first").
- facts about the launch the person stated that later work should honour.
- what the person prefers or rules out.

Do not keep: questions, small talk, general knowledge, anything Qloo measured (it lives in the plan), scores, or anything the person did not say. Use "update" when a note changed ("release moved from May to June" replaces the old window note) and "remove" when it no longer holds. Add nothing when nothing durable was said. Never store a name, email, or other personal detail about a private person.`;

export class ModelMemoryWriter implements MemoryWriter {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async write(turn: MemoryTurn) {
    const { output, usage } = await generateText({
      model: this.model,
      system: MEMORY_SYSTEM,
      prompt: [
        `Category: ${turn.category}`,
        `Project: ${turn.title}`,
        '',
        'Notes kept so far:',
        ...(turn.notes.length
          ? turn.notes.map((n) => `- ${n.id} [${n.kind}] ${n.text}`)
          : ['- none']),
        '',
        'The person said:',
        turn.message,
        '',
        'Oraqul answered:',
        turn.reply || '(no written answer)',
        ...(turn.output ? ['', `It also made ${turn.output.label}: ${turn.output.headline}`] : []),
      ].join('\n'),
      output: Output.object({ schema: memoryOpsSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { ops: output, tokens: usage.totalTokens ?? 0 };
  }
}

/** With no key: keeps no notes. Plans are still remembered, because code writes those. */
export class ScriptedMemoryWriter implements MemoryWriter {
  async write() {
    return { ops: null, tokens: 0 };
  }
}

export class FallbackMemoryWriter implements MemoryWriter {
  constructor(
    private readonly primary: MemoryWriter,
    private readonly fallback: MemoryWriter,
    private readonly onError: (err: unknown) => void,
  ) {}

  async write(turn: MemoryTurn) {
    try {
      return await this.primary.write(turn);
    } catch (err) {
      this.onError(err);
      return this.fallback.write(turn);
    }
  }
}

/**
 * What the model asked for, kept only when it is safe to apply: updates and removes name a note
 * that exists, adds are not repeats, text is short, and the project stays under its cap.
 */
export function checkOps(ops: MemoryOps | null, notes: Note[]): MemoryOp[] {
  if (!ops) return [];
  const known = new Set(notes.map((n) => n.id));
  const seen = new Set(notes.map((n) => normalise(n.text)));
  const out: MemoryOp[] = [];
  let count = notes.length;
  for (const op of ops.ops) {
    const text = op.text?.trim().slice(0, MAX_TEXT) ?? '';
    if (op.op === 'add') {
      if (!op.kind || !text || seen.has(normalise(text)) || count >= MAX_NOTES) continue;
      seen.add(normalise(text));
      count += 1;
      out.push({ op: 'add', kind: op.kind, text });
    } else if (op.op === 'update') {
      if (!op.id || !known.has(op.id) || !text) continue;
      out.push({ op: 'update', id: op.id, text });
    } else if (op.id && known.has(op.id)) {
      known.delete(op.id);
      count -= 1;
      out.push({ op: 'remove', id: op.id });
    }
  }
  return out;
}
