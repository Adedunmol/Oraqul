import { z } from 'zod';
import { findingSchema } from './finding';
import { confidenceSchema, directionSchema } from './verdict';

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
  // Every full plan: channels written by code, and short creative briefs (guides, never assets).
  'channels',
  'creative',
  // A creative kit's sections.
  'hooks',
  'scripts',
  'shots',
  'keyart',
  'captions',
  // Music only. Each category picks its own modules from this list (`pickModules` in its pack).
  'tour',
  'support',
  'sync',
  // Games only. Which of these a plan gets depends on the launch kind (`pickModules` in the pack).
  'collabs',
  'creators',
  'store',
  'events',
  'softlaunch',
  'liveops',
  'earlyaccess',
  // Podcasts only. Which of these a plan gets depends on the launch kind and the format.
  'crosspromo',
  'guests',
  'live',
  'video',
  // Books only. Which of these a plan gets depends on the launch kind, the route and the readership.
  'comps',
  'adaptation',
  'retail',
  'audio',
  'schools',
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

/** What the analyst read from a request before any query ran (spec §3.2). */
export const understandingSchema = z.object({
  /** What the person wants back, in a sentence. */
  asked: z.string(),
  goals: z.array(z.string()),
  constraints: z.array(z.string()),
  /**
   * Values the analyst filled in because the person did not say them. They steer the queries and
   * show on the plan as assumptions; they are never evidence.
   */
  assumed: z.array(z.object({ what: z.string(), value: z.string(), why: z.string() })),
  /** What a good answer must do. The research, the writer and the review all work from these. */
  criteria: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      /** True when answering it needs Qloo audience data. Only those are checked for coverage. */
      evidence: z.boolean().default(true),
      /** How well the research covers it, set by code once the findings are in. */
      status: z.enum(['covered', 'thin', 'missing', 'unchecked']).default('unchecked'),
      /** The findings that bear on it, strongest first. */
      findingIds: z.array(z.string()).default([]),
    }),
  ),
  by: z.enum(['model', 'scripted']),
});
export type Understanding = z.infer<typeof understandingSchema>;

export const reviewIssueTypes = [
  'missing',
  'off-brief',
  'contradicts-context',
  'weak-evidence',
  'unhelpful',
  'vague',
] as const;

/** One thing the red team found wrong with a draft, against a check or the request as a whole. */
export const reviewIssueSchema = z.object({
  /** A check id, or `general`. */
  check: z.string(),
  type: z.enum(reviewIssueTypes),
  text: z.string(),
  /** What the next draft should do about it. */
  fix: z.string(),
  /** A blocking issue fails the draft. Code decides, from this list alone. */
  blocking: z.boolean(),
  /** A question only the person can answer, when the issue cannot be settled by research or writing. */
  ask: z.string().optional(),
});
export type ReviewIssue = z.infer<typeof reviewIssueSchema>;

/**
 * What the red team made of a plan before it was saved: each round's issues and what was done
 * about them. `unchecked` when no model was available to review.
 */
export const planReviewSchema = z.object({
  status: z.enum(['passed', 'flagged', 'unchecked']),
  rounds: z.array(
    z.object({
      round: z.number().int(),
      issues: z.array(reviewIssueSchema),
      action: z.enum(['approved', 'rewrote', 'researched', 'stopped']),
    }),
  ),
  /** What the person could give or try to make the plan stronger. */
  next: z.array(z.string()),
});
export type PlanReview = z.infer<typeof planReviewSchema>;

/**
 * How the plan was made: what each research round was missing and ran, and the lines the check
 * removed from every draft. Saved so the work is never silent.
 */
export const planProcessSchema = z.object({
  research: z.array(
    z.object({
      round: z.number().int(),
      /** The checks still open when the round began, in the person's terms. */
      open: z.array(z.string()),
      asked: z.array(z.object({ label: z.string(), why: z.string(), found: z.boolean() })),
      retried: z.array(z.object({ label: z.string(), says: z.string(), found: z.boolean() })),
      consulted: z.array(z.object({ category: z.string(), name: z.string(), found: z.boolean() })),
    }),
  ),
  drafts: z.number().int(),
  dropped: z.array(droppedLineSchema.extend({ draft: z.number().int() })),
});
export type PlanProcess = z.infer<typeof planProcessSchema>;

export const budgetBands = ['micro', 'independent', 'mid', 'major'] as const;
export const budgetBandSchema = z.enum(budgetBands);
export type BudgetBand = z.infer<typeof budgetBandSchema>;

/** The budget band a plan was written for, and how it was learned. */
export const planBandSchema = z.object({
  band: budgetBandSchema,
  source: z.enum(['brief', 'asked', 'assumed']),
});
export type PlanBand = z.infer<typeof planBandSchema>;

/** The one signal the plan is judged on. A target is a goal, never a forecast. */
export const signalSchema = z.object({
  key: z.string(),
  primary: z.string(),
  secondary: z.array(z.string()),
  /** Days from release when the signal is read. Negative is before. */
  checkpoints: z.array(z.number().int()),
  target: z
    .object({
      value: z.number(),
      floor: z.number().nullable(),
      unit: z.string(),
      from: z.enum(['team', 'rule']),
      ruleId: z.string().nullable(),
    })
    .nullable(),
});
export type Signal = z.infer<typeof signalSchema>;

/** A call on a decision, computed by code. A team choice keeps the choice and says how to handle it. */
export const directionCallSchema = z.object({
  id: z.string().min(1),
  subject: z.enum(['date', 'territory', 'partner']),
  name: z.string(),
  direction: directionSchema,
  confidence: confidenceSchema,
  why: z.string(),
  findingIds: z.array(z.string()),
  teamChoice: z.boolean(),
  territory: z.string().nullable(),
});
export type DirectionCall = z.infer<typeof directionCallSchema>;

/** One territory of the plan: home first, then the diaspora cities. */
export const territorySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  role: z.enum(['home', 'diaspora', 'other']),
  order: z.number().int().min(0),
  /** The direction call for opening here. Null when Qloo could not rank the place. */
  callId: z.string().nullable(),
  channels: z.array(z.object({ name: z.string(), lead: z.boolean() })),
  partnerIds: z.array(z.string()),
  /** Plan lines that belong to this territory. */
  lineIds: z.array(z.string()),
});
export type Territory = z.infer<typeof territorySchema>;

export const partnerTiers = ['A', 'B', 'C'] as const;
export const partnerTierSchema = z.enum(partnerTiers);
export type PartnerTier = z.infer<typeof partnerTierSchema>;

/** A partner the plan can approach, with its tier, Qloo fit and budget fit. Price is never known. */
export const partnerOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  tier: partnerTierSchema,
  market: z.string(),
  from: z.enum(['seed', 'qloo', 'team']),
  /** Place in the list Qloo ranked for this audience. Null when Qloo did not rank it. */
  fit: z
    .object({ place: z.number().int(), of: z.number().int(), direction: directionSchema })
    .nullable(),
  budgetFit: z.enum(['fits', 'stretch', 'out']),
  price: z.literal('unknown'),
  findingIds: z.array(z.string()),
});
export type PartnerOption = z.infer<typeof partnerOptionSchema>;

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
  /** How the request was read. Plans saved before the analyst have none. */
  understanding: understandingSchema.nullable().default(null),
  /** The red team's verdict on the saved draft. Plans saved before it have none. */
  review: planReviewSchema.nullable().default(null),
  /** What the research and the line check did on the way. Plans saved before it have none. */
  process: planProcessSchema.nullable().default(null),
  /** The rule library version the plan was written with. Plans saved before it have none. */
  rules: z.object({ category: z.string(), version: z.string() }).nullable().default(null),
  band: planBandSchema.nullable().default(null),
  signal: signalSchema.nullable().default(null),
  territories: z.array(territorySchema).default([]),
  calls: z.array(directionCallSchema).default([]),
  partners: z.array(partnerOptionSchema).default([]),
});
export type LaunchPlan = z.infer<typeof launchPlanSchema>;
