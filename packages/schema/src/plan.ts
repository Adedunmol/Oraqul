import { z } from 'zod';
import { findingSchema } from './finding';

// The launch plan: a minimum core plus modules (spec §6.1). The model writes the lines from the
// findings (stage 2) and code checks every line before the plan is saved.

export const launchCoreKeys = [
  'bottom-line',
  'positioning',
  'audience',
  'markets',
  'gaps',
] as const;
export const launchModuleKeys = [
  'partnerships',
  'placement',
  'publicity',
  'community',
  'route',
  'timeline',
  'cadence',
  'budget',
  'measure',
  'risks',
] as const;
export const launchSectionKeys = [...launchCoreKeys, ...launchModuleKeys] as const;
export const launchSectionKeySchema = z.enum(launchSectionKeys);
export type LaunchSectionKey = z.infer<typeof launchSectionKeySchema>;
export type LaunchModuleKey = (typeof launchModuleKeys)[number];

/**
 * `grounded` lines claim something about taste, audience or place and cite findings.
 * `playbook` lines are launch practice: labelled, citing nothing.
 */
export const lineKindSchema = z.enum(['grounded', 'playbook']);
export type LineKind = z.infer<typeof lineKindSchema>;

/** A fact found on the web (release timing, rival releases, partners), with where it came from. */
export const planSourceSchema = z.object({
  id: z.string().min(1),
  /** The fact, in a sentence. A line may state a date or figure only if a source states it. */
  fact: z.string().min(1),
  title: z.string(),
  url: z.url(),
});
export type PlanSource = z.infer<typeof planSourceSchema>;

export const launchLineSchema = z.object({
  /** Stable for the same section and subject, so a scenario can mark what changed. */
  id: z.string().min(1),
  kind: lineKindSchema,
  text: z.string().min(1),
  /** Empty for playbook lines. */
  findingIds: z.array(z.string()),
  /** The web sources a line's facts come from. Older plans have none. */
  sourceIds: z.array(z.string()).default([]),
  /** Every entity, title or place the line names, so code can check each one. */
  names: z.array(z.string()),
  /** A heading within the section, such as a city or "Key messages". */
  group: z.string().nullable(),
});
export type LaunchLine = z.infer<typeof launchLineSchema>;

export const launchSectionSchema = z.object({
  key: launchSectionKeySchema,
  title: z.string(),
  lines: z.array(launchLineSchema),
});
export type LaunchSection = z.infer<typeof launchSectionSchema>;

/** A comp the plan stands on. The team's lead; `added` ones are the agent's, kept apart. */
export const compUsedSchema = z.object({
  name: z.string(),
  source: z.enum(['you', 'added']),
  /** The Qloo match, such as "2018 · Nigeria", when code chose between same-name titles. */
  match: z.string().nullable(),
  /** Why code picked this match from several, said plainly. Null for a single match. */
  choice: z.string().nullable(),
});
export type CompUsed = z.infer<typeof compUsedSchema>;

/** A line code removed in the check, kept so the drop is never silent. */
export const droppedLineSchema = z.object({
  section: launchSectionKeySchema,
  text: z.string(),
  why: z.string(),
});
export type DroppedLine = z.infer<typeof droppedLineSchema>;

export const launchPlanSchema = z.object({
  /** `full` for a launch plan or an unclear ask, `narrow` for one question. */
  scope: z.enum(['full', 'narrow']),
  sections: z.array(launchSectionSchema),
  comps: z.array(compUsedSchema),
  findings: z.array(findingSchema),
  /** What was found on the web for this plan. Older plans have none. */
  sources: z.array(planSourceSchema).default([]),
  dropped: z.array(droppedLineSchema),
  /** `model` when a model wrote the lines, `template` when code did (no key, or a failed call). */
  writer: z.enum(['model', 'template']),
});
export type LaunchPlan = z.infer<typeof launchPlanSchema>;
