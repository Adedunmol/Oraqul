import { z } from 'zod';
import { claimSchema } from './claim';
import { questionCardTypeSchema, questionOptionSchema } from './events';

export const questionSchema = z.object({
  id: z.string(),
  card: questionCardTypeSchema,
  prompt: z.string(),
  options: z.array(questionOptionSchema),
  /** Shown under the card, such as how to answer by typing instead. */
  hint: z.string().optional(),
});
export type Question = z.infer<typeof questionSchema>;

/** Body of `POST /threads/:id/messages`: a card answer or free text. */
export const answerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('options'),
    questionId: z.string(),
    optionIds: z.array(z.string()).min(1),
  }),
  z.object({ kind: z.literal('text'), questionId: z.string(), text: z.string().min(1) }),
]);
export type Answer = z.infer<typeof answerSchema>;

/** What a category agent finishes with. */
export const agentReplySchema = z.object({
  message: z.string(),
  claims: z.array(claimSchema),
});
export type AgentReply = z.infer<typeof agentReplySchema>;

export const stopReasons = ['finished', 'waiting', 'budget', 'steps', 'error'] as const;
export const stopReasonSchema = z.enum(stopReasons);
export type StopReason = z.infer<typeof stopReasonSchema>;
