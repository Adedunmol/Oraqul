import { z } from 'zod';
import { confidenceSchema, verdictSchema } from './verdict';

/** Something a Qloo call returned that a finding names, in the order Qloo ranked it. */
export const findingEntitySchema = z.object({
  entityId: z.string().nullable(),
  name: z.string().min(1),
  /** Qloo's affinity for this entity in the call behind the finding. Null when it gave none. */
  affinity: z.number().nullable(),
  /** A tell-apart such as a year and country, or a city for a place. */
  detail: z.string().nullable(),
});
export type FindingEntity = z.infer<typeof findingEntitySchema>;

/** What shaped the query, so a finding can say "among Afrobeats fans in Lagos aged 18 to 24". */
export const findingContextSchema = z.object({
  city: z.string().nullable(),
  ages: z.array(z.string()),
  /** Tag names, not urns. */
  tags: z.array(z.string()),
  country: z.string().nullable(),
  yearFrom: z.number().int().nullable(),
  audience: z.string().nullable(),
});
export type FindingContext = z.infer<typeof findingContextSchema>;

/**
 * One result from Qloo as a sentence built by code. Ids are stable for the same query and context,
 * so a scenario can mark what changed.
 */
export const findingSchema = z.object({
  id: z.string().min(1),
  /** The category's query catalog key, such as `music` for Film or `support` for Music. */
  query: z.string().min(1),
  text: z.string().min(1),
  entities: z.array(findingEntitySchema),
  /**
   * The numbers the text states, by name, so a line that quotes a number can be checked against
   * them. Lifts are ratios, indexes are 0 to 100.
   */
  numbers: z.record(z.string(), z.number()),
  /** Set when the finding tests one of the team's decisions (spec §5.2). */
  verdict: verdictSchema.nullable(),
  confidence: confidenceSchema,
  /** Which confidence check set the level (spec §5.1). */
  why: z.string(),
  context: findingContextSchema,
  callIds: z.array(z.uuid()),
});
export type Finding = z.infer<typeof findingSchema>;
