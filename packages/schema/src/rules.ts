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
  /** How far to lean on the rule. Older rules are the team's own craft. */
  grade: z.enum(['team', 'directional', 'not-researched']).default('team'),
  /** What a reader should know before relying on it. */
  caveat: z.string().optional(),
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

const calendarRowSchema = z.object({
  key: z.string(),
  at: z.number().int(),
  until: z.number().int().optional(),
  asset: z.string().nullable(),
  post: z.string(),
  count: z.number().int().nullable(),
  per: z.enum(['week', 'day', 'span']).nullable(),
});
export type CalendarRowView = z.infer<typeof calendarRowSchema>;

const partnerKindsSchema = z.object({
  brandCategories: z.array(z.object({ phrase: z.string(), verified: z.boolean() })),
  bKinds: z.array(z.string()),
  cKinds: z.array(z.string()),
  gets: z.array(z.string()),
  ideas: z.array(z.string()),
});

export const rulesResponseSchema = z.object({
  libraries: z.array(ruleLibrarySchema),
  bands: z.array(z.object({ id: z.string(), label: z.string(), description: z.string() })),
  tiers: z.array(z.object({ tier: z.enum(['A', 'B', 'C']), name: z.string(), what: z.string() })),
  /** Channels that lead in a market whatever the category, by country. */
  countryChannels: z.record(z.string(), z.array(z.string())),
  /** The conventions every category shares, versioned. */
  shared: z.object({
    version: z.string(),
    bandEdges: ruleOf(z.record(z.string(), z.array(z.number()))),
    diaspora: ruleOf(z.record(z.string(), z.array(z.string()))),
    countryChannels: ruleOf(z.record(z.string(), z.array(z.string()))),
    platformsByCategory: ruleOf(z.record(z.string(), z.array(z.string()))),
    platformsByMarket: ruleOf(z.record(z.string(), z.array(z.string()))),
  }),
  partners: z.object({
    version: z.string(),
    categories: z.record(z.string(), ruleOf(partnerKindsSchema)),
    seeds: ruleOf(
      z.record(
        z.string(),
        z.record(z.string(), z.object({ names: z.array(z.string()), kinds: z.array(z.string()) })),
      ),
    ),
    tier: ruleOf(z.object({ flagshipPopularity: z.number() })),
    slots: ruleOf(z.record(z.string(), z.number().int())),
    leadTime: ruleOf(
      z.object({
        months: z.number().int(),
        why: z.string(),
        independent: z.string(),
        barter: z.string(),
      }),
    ),
    pitch: ruleOf(z.object({ parts: z.array(z.string()), room: z.string() })),
  }),
  /** The live show rules E1 to E8, each with its source. Their values vary, so they are free-form. */
  shows: z.object({
    version: z.string(),
    rules: z.record(z.string(), ruleOf(z.unknown())),
  }),
  calendar: z.object({
    version: z.string(),
    categories: z.record(
      z.string(),
      ruleOf(z.object({ fromBeats: z.boolean(), rows: z.array(calendarRowSchema) })),
    ),
    ads: ruleOf(z.object({ lines: z.array(z.string()) })),
  }),
  /** What a team does with an opportunity beyond its brief: the limit, first test and measure. */
  opportunities: z.object({
    version: z.string(),
    kinds: z.record(
      z.string(),
      ruleOf(z.object({ limit: z.string(), test: z.string(), measure: z.string() })),
    ),
  }),
});
export type RulesResponse = z.infer<typeof rulesResponseSchema>;
