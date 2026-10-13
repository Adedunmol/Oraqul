import { z } from 'zod';

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
    step: z.number().int(),
    of: z.number().int(),
    text: z.string(),
  }),
  z.object({
    type: z.literal('question'),
    card: questionCardTypeSchema,
    prompt: z.string(),
    options: z.array(questionOptionSchema),
  }),
  z.object({ type: z.literal('message'), body: z.string() }),
  z.object({ type: z.literal('output.created'), outputId: z.string().uuid() }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type ThreadEvent = z.infer<typeof threadEventSchema>;
