import { z } from 'zod';
import { categorySchema, startModeSchema } from './categories';
import { claimSchema } from './claim';
import { findingSchema } from './finding';
import { receiptSchema } from './receipt';

export const questionCardTypeSchema = z.enum([
  'single',
  'multi',
  'text',
  'split',
  'date',
  'file',
  'confirm',
  'match',
]);
export type QuestionCardType = z.infer<typeof questionCardTypeSchema>;

export const questionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

/**
 * Something a run started from, or a note it just saved to the project's memory (`saved`). Shown
 * as a quiet line under the reply (spec §3.7). Context, never evidence.
 */
export const contextItemSchema = z.object({
  source: z.enum(['project', 'plan', 'chat', 'saved']),
  label: z.string().min(1),
});
export type ContextItem = z.infer<typeof contextItemSchema>;

export const threadEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('trace.step'),
    /** `router`, a category, or `books→film` for a consult. */
    agent: z.string(),
    step: z.number().int(),
    of: z.number().int(),
    text: z.string(),
  }),
  z.object({
    type: z.literal('question'),
    id: z.string(),
    agent: z.string(),
    card: questionCardTypeSchema,
    prompt: z.string(),
    options: z.array(questionOptionSchema),
    hint: z.string().optional(),
  }),
  /** The router has read the project's name, category and mode, so the workspace can show them. */
  z.object({
    type: z.literal('project.updated'),
    projectId: z.uuid(),
    name: z.string(),
    category: categorySchema,
    mode: startModeSchema,
    threadName: z.string(),
  }),
  z.object({ type: z.literal('message'), body: z.string(), claims: z.array(claimSchema) }),
  z.object({ type: z.literal('receipt'), receipt: receiptSchema }),
  /** A Qloo result turned into a sentence, streamed while the rest of the queries run. */
  z.object({ type: z.literal('finding'), finding: findingSchema }),
  z.object({ type: z.literal('output.created'), outputId: z.string().uuid() }),
  z.object({ type: z.literal('memory.used'), items: z.array(contextItemSchema).min(1) }),
  z.object({
    type: z.literal('run.stopped'),
    reason: z.enum(['finished', 'waiting', 'budget', 'steps', 'error', 'stopped']),
  }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type ThreadEvent = z.infer<typeof threadEventSchema>;
