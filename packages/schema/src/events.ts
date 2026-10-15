import { z } from 'zod';
import { categorySchema, startModeSchema } from './categories';
import { claimSchema } from './claim';
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
  z.object({ type: z.literal('output.created'), outputId: z.string().uuid() }),
  z.object({
    type: z.literal('run.stopped'),
    reason: z.enum(['finished', 'waiting', 'budget', 'steps', 'error']),
  }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type ThreadEvent = z.infer<typeof threadEventSchema>;
