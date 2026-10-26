import { z } from 'zod';

// The Guide's help bot (spec §7 `POST /guide/ask`): a visitor asks how to use Oraqul and gets an
// answer drawn from the Guide's own pages. Public, so every length is capped here at the edge.

export const GUIDE_QUESTION_MAX = 400;
export const GUIDE_HISTORY_MAX = 6;

export const guideTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().max(1200),
});

export const guideAskSchema = z.object({
  question: z.string().trim().min(2).max(GUIDE_QUESTION_MAX),
  /** The turns before this question, oldest first, so a follow up makes sense. */
  history: z.array(guideTurnSchema).max(GUIDE_HISTORY_MAX).default([]),
});
export type GuideAsk = z.infer<typeof guideAskSchema>;

export const guideAnswerSchema = z.object({
  answer: z.string(),
  /** Guide pages the answer drew on. Empty when the question was off topic or unanswered. */
  sources: z.array(z.object({ slug: z.string(), title: z.string() })),
});
export type GuideAnswer = z.infer<typeof guideAnswerSchema>;
