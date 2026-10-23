import { z } from 'zod';
import { categorySchema } from './categories';

// The rule library as `GET /rules` serves it (spec §7): the launch rules each category plans by,
// each with its source and the date it was set, so a reader can check where a number came from.

export const ruleSourceSchema = z.object({
  kind: z.enum(['team', 'url']),
  label: z.string(),
  url: z.string().optional(),
  /** `YYYY-MM-DD`. */
  date: z.string(),
});

const ruleOf = <T extends z.ZodType>(value: T) =>
  z.object({ id: z.string(), value, source: ruleSourceSchema });

export const ruleLibrarySchema = z.object({
  category: categorySchema,
  version: z.string(),
  timeline: z.array(ruleOf(z.string())),
  /** Weeks from the release. Negative is before it. Empty where the kind profiles hold the calendar. */
  beats: z.array(
    z.object({
      at: z.number().int(),
      until: z.number().int().optional(),
      key: z.string(),
      text: z.string(),
    }),
  ),
  signal: ruleOf(
    z.object({
      key: z.string(),
      primary: z.string(),
      secondary: z.array(z.string()),
      checkpoints: z.array(z.number().int()),
      benchmark: z
        .object({ value: z.number(), floor: z.number().nullable(), unit: z.string() })
        .nullable(),
    }),
  ),
  channels: ruleOf(z.array(z.string())),
});
export type RuleLibraryView = z.infer<typeof ruleLibrarySchema>;

export const rulesResponseSchema = z.object({
  libraries: z.array(ruleLibrarySchema),
  bands: z.array(z.object({ id: z.string(), label: z.string(), description: z.string() })),
  tiers: z.array(z.object({ tier: z.enum(['A', 'B', 'C']), name: z.string(), what: z.string() })),
  /** Channels that lead in a market whatever the category, by country. */
  countryChannels: z.record(z.string(), z.array(z.string())),
});
export type RulesResponse = z.infer<typeof rulesResponseSchema>;
