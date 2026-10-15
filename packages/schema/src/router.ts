import { z } from 'zod';
import { categorySchema, startModeSchema } from './categories';

// What the router model returns for the start of a project (spec §3.1, §9.2). Flat rather than a
// union because not every provider's structured output takes `anyOf` at the top level.

/** The exact words in the person's messages that the value was read from. */
const quote = z.string().min(1);

export const routerOptionSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
  /** What picking this option settles. An option that settles nothing is dropped. */
  category: categorySchema.nullable(),
  mode: startModeSchema.nullable(),
});

export const routerReadingSchema = z.object({
  /** False when the message is not about launching a film, series, song, book, podcast or game. */
  onTopic: z.boolean(),
  title: z.object({ value: z.string().min(1), quote }).nullable(),
  category: z.object({ value: categorySchema, quote }).nullable(),
  mode: z.object({ value: startModeSchema, quote }).nullable(),
  /** The one question to ask when the category or the mode is still unknown. */
  question: z
    .object({ prompt: z.string().min(1), options: z.array(routerOptionSchema).max(4) })
    .nullable(),
});

export type RouterOption = z.infer<typeof routerOptionSchema>;
export type RouterReading = z.infer<typeof routerReadingSchema>;
