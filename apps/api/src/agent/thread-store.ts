import { Inject, Injectable } from '@nestjs/common';
import {
  type Attachment,
  claimSchema,
  type QuestionCard,
  questionSchema,
  type ThreadEvent,
  type ThreadItem,
} from '@oraqul/schema';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { type Database, DB } from '../db/db.module.js';
import { messages, threads } from '../db/schema.js';
import type { TranscriptLine } from './router/reader.js';

// A thread's transcript is the `messages` table (spec §6). Each stored row is one chat item and
// one replayable event; `seq` orders them and is where an event stream resumes.

export const userBody = z.object({
  text: z.string(),
  attachments: z.array(z.object({ name: z.string() })).default([]),
});
const agentBody = z.object({
  text: z.string(),
  claims: z.array(claimSchema).default([]),
  /** The run stopped on an error; shown as agent text and streamed as an `error` event. */
  error: z.boolean().default(false),
});
const questionBody = z.object({
  agent: z.string(),
  question: questionSchema,
  /** What the person answered, shown on the folded card. Null while the card is open. */
  answer: z.string().nullable(),
});
const traceBody = z.object({
  agent: z.string(),
  step: z.number().int(),
  of: z.number().int(),
  text: z.string(),
});
const outputBody = z.object({ outputId: z.uuid() });

type Row = typeof messages.$inferSelect;

/** An event that was stored, with its place in the thread. */
export interface StoredEvent {
  seq: number;
  event: ThreadEvent;
}

@Injectable()
export class ThreadStore {
  constructor(@Inject(DB) private readonly db: Database) {}

  async appendUser(threadId: string, text: string, attachments: Attachment[]): Promise<number> {
    const body = { text, attachments: attachments.map(({ name }) => ({ name })) };
    return this.insert(threadId, 'user', body);
  }

  /** Stores an event that belongs in the transcript. Returns its seq, or null for live-only ones. */
  async appendEvent(threadId: string, event: ThreadEvent): Promise<number | null> {
    switch (event.type) {
      case 'message':
        return this.insert(threadId, 'agent', { text: event.body, claims: event.claims });
      case 'error':
        return this.insert(threadId, 'agent', { text: event.message, claims: [], error: true });
      case 'question': {
        const { type: _type, agent, ...question } = event;
        return this.insert(threadId, 'question', { agent, question, answer: null });
      }
      case 'trace.step': {
        const { type: _type, ...step } = event;
        return this.insert(threadId, 'trace', step);
      }
      case 'output.created':
        return this.insert(threadId, 'output', { outputId: event.outputId });
      case 'receipt':
      case 'project.updated':
      case 'run.stopped':
        return null;
    }
  }

  /** Folds the open question card with what the person answered. */
  async answerOpenQuestion(threadId: string, answer: string): Promise<void> {
    const [open] = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.threadId, threadId),
          eq(messages.role, 'question'),
          isNull(sql`${messages.body}->>'answer'`),
        ),
      )
      .orderBy(desc(messages.seq))
      .limit(1);
    if (!open) return;
    const body = questionBody.parse(open.body);
    await this.db
      .update(messages)
      .set({ body: { ...body, answer } })
      .where(eq(messages.id, open.id));
  }

  /** The last `count` things said in the chat, oldest first, for a model that judges a new message. */
  async recentLines(threadId: string, count: number): Promise<TranscriptLine[]> {
    const rows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(desc(messages.seq))
      .limit(count);
    return rows.reverse().flatMap((row): TranscriptLine[] => {
      switch (row.role) {
        case 'user':
          return [{ from: 'person', text: userBody.parse(row.body).text }];
        case 'agent':
          return [{ from: 'oraqul', text: agentBody.parse(row.body).text }];
        case 'question':
          return [{ from: 'oraqul', text: questionBody.parse(row.body).question.prompt }];
        default:
          return [];
      }
    });
  }

  async rows(threadId: string, afterSeq = 0): Promise<Row[]> {
    return this.db
      .select()
      .from(messages)
      .where(and(eq(messages.threadId, threadId), gt(messages.seq, afterSeq)))
      .orderBy(messages.seq);
  }

  /** The stored events after `afterSeq`, for an event stream that joins late. */
  async eventsAfter(threadId: string, afterSeq: number): Promise<StoredEvent[]> {
    return (await this.rows(threadId, afterSeq)).flatMap((row) => {
      const event = toEvent(row);
      return event ? [{ seq: row.seq, event }] : [];
    });
  }

  private async insert(threadId: string, role: Row['role'], body: unknown): Promise<number> {
    // One run per thread writes at a time (RunService), so max + 1 does not race; the unique
    // (thread_id, seq) constraint would refuse it if it ever did.
    const [row] = await this.db
      .insert(messages)
      .values({
        threadId,
        role,
        body,
        seq: sql`(select coalesce(max(${messages.seq}), 0) + 1 from ${messages} where ${messages.threadId} = ${threadId})`,
      })
      .returning({ seq: messages.seq });
    await this.db.update(threads).set({ updatedAt: new Date() }).where(eq(threads.id, threadId));
    if (!row) throw new Error('Insert returned no row');
    return row.seq;
  }
}

function toEvent(row: Row): ThreadEvent | null {
  switch (row.role) {
    case 'user':
      return null;
    case 'agent': {
      const body = agentBody.parse(row.body);
      return body.error
        ? { type: 'error', message: body.text }
        : { type: 'message', body: body.text, claims: body.claims };
    }
    case 'question': {
      const { agent, question } = questionBody.parse(row.body);
      return { type: 'question', agent, ...question };
    }
    case 'trace':
      return { type: 'trace.step', ...traceBody.parse(row.body) };
    case 'output':
      return { type: 'output.created', outputId: outputBody.parse(row.body).outputId };
  }
}

/**
 * The stored transcript as chat items. Trace steps in a row become one trace item, and a trace
 * is finished once anything follows it or the run is no longer going.
 */
export function toItems(rows: Row[], busy: boolean): ThreadItem[] {
  const items: ThreadItem[] = [];
  for (const row of rows) {
    const id = row.id;
    switch (row.role) {
      case 'user': {
        const { text, attachments } = userBody.parse(row.body);
        const attached = attachments.length
          ? `Attached: ${attachments.map((a) => a.name).join(', ')}`
          : '';
        items.push({ id, role: 'user', text: [text, attached].filter(Boolean).join('\n\n') });
        break;
      }
      case 'agent':
        items.push({ id, role: 'agent', text: agentBody.parse(row.body).text });
        break;
      case 'question': {
        const { question, answer } = questionBody.parse(row.body);
        items.push({ id, role: 'question', question: toCard(question), answer });
        break;
      }
      case 'trace': {
        const { text } = traceBody.parse(row.body);
        const last = items.at(-1);
        if (last?.role === 'trace') {
          last.steps.push(text);
          last.done = last.steps.length - 1;
        } else {
          items.push({ id, role: 'trace', steps: [text], done: 0 });
        }
        break;
      }
      case 'output':
        items.push({ id, role: 'output', outputId: outputBody.parse(row.body).outputId });
        break;
    }
  }
  items.forEach((item, i) => {
    if (item.role === 'trace' && (!busy || i < items.length - 1)) item.done = item.steps.length;
  });
  return items;
}

/** A stored question as the card the web renders. */
export function toCard(question: z.infer<typeof questionSchema>): QuestionCard {
  const { id, prompt, options, hint } = question;
  switch (question.card) {
    case 'text':
      return { id, prompt, card: 'text', hint: hint ?? '' };
    case 'match':
      return { id, prompt, card: 'match', options };
    case 'multi':
      return { id, prompt, card: 'multi', options };
    default:
      return { id, prompt, card: 'single', options, hint };
  }
}
