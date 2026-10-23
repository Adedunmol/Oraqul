import { z } from 'zod';
import { findingSchema } from './finding';
import { compUsedSchema, droppedLineSchema, launchLineSchema, planSourceSchema } from './plan';
import { confidenceSchema, verdictSchema } from './verdict';

// The audit report (spec §6.3): a plan someone else wrote, tested one belief at a time. Verdicts,
// confidence and every number in `results` are computed by code from Qloo values and the figures
// the person supplied (hard rule 1). The model writes only the risks and alternatives lines, and
// code checks them like plan lines (§6.2).

/** What a belief in a plan is about. Decides which test runs (spec §5.3). */
export const reportSubjects = [
  'age',
  'gender',
  'place',
  'comps',
  'partner',
  'artist',
  'media',
  'other',
] as const;
export const reportSubjectSchema = z.enum(reportSubjects);
export type ReportSubject = z.infer<typeof reportSubjectSchema>;

export const reportItemSchema = z.object({
  /** Stable for the same subject and claim, so a fix can point at the item it answers. */
  id: z.string().min(1),
  subject: reportSubjectSchema,
  /** The belief, in the plan's own words. */
  claim: z.string().min(1),
  /** Where the plan says it, such as a file name. Null when the plan relies on it without saying. */
  source: z.string().nullable(),
  unstated: z.boolean(),
  verdict: verdictSchema,
  confidence: confidenceSchema,
  findingIds: z.array(z.string()),
  /** Built by code from the finding, or the reason it could not be tested. */
  why: z.string().min(1),
  /**
   * What to do about a weak or broken item. Never "drop it": a team's choices are constraints, so a
   * fix reorders them or adds a stronger option beside them (spec §5.2).
   */
  fix: launchLineSchema.nullable(),
});
export type ReportItem = z.infer<typeof reportItemSchema>;

/** Figures a launch produced, as aggregates only. No personal data (hard rule 7). */
export const launchResultsSchema = z.object({
  asOf: z.string().nullable(),
  /** What the numbers count, in the person's words: "tickets sold", "streams", "wishlists". */
  measure: z.string().min(1),
  byPlace: z.array(z.object({ place: z.string().min(1), value: z.number().min(0) })),
  byAge: z.array(z.object({ band: z.string().min(1), value: z.number().min(0) })).nullable(),
});
export type LaunchResults = z.infer<typeof launchResultsSchema>;

export const resultGaps = ['under', 'over', 'as-planned'] as const;
export const resultGapSchema = z.enum(resultGaps);
export type ResultGap = z.infer<typeof resultGapSchema>;

export const resultRowSchema = z.object({
  place: z.string(),
  /** This place's share of the results, in percent, computed by code. */
  actualShare: z.number().min(0).max(100),
  /** Place in the plan's order, from 1. Null for a place the plan did not name. */
  plannedRank: z.number().int().min(1).nullable(),
  /** Place in the results, from 1, by share. */
  actualRank: z.number().int().min(1),
  /** Qloo's lift for this place, when the audit ranked it. */
  lift: z.number().nullable(),
  gap: resultGapSchema,
});
export type ResultRow = z.infer<typeof resultRowSchema>;

export const resultsComparisonSchema = z.object({
  asOf: z.string().nullable(),
  measure: z.string(),
  rows: z.array(resultRowSchema),
  ages: z
    .array(
      z.object({
        band: z.string(),
        actualShare: z.number().min(0).max(100),
        /** Qloo's taste index for the band, 0 to 100, when the audit measured it. */
        index: z.number().nullable(),
      }),
    )
    .nullable(),
  /** The item whose belief the results contradict most. */
  brokeItemId: z.string().nullable(),
});
export type ResultsComparison = z.infer<typeof resultsComparisonSchema>;

/**
 * A plan's own dates and shares set beside a launch rule (Live shows E1, E3, E4, E6). Code reads
 * the figures the plan states and compares them with the rule. It is not a Qloo verdict and has no
 * confidence: it says whether the plan follows the rule, never whether the plan will work.
 */
export const ruleCheckStatuses = ['follows', 'outside', 'not-stated', 'no-rule'] as const;
export const ruleCheckSchema = z.object({
  id: z.string().min(1),
  /** The rule it is checked against, such as `shows.on-sale`. */
  ruleId: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(ruleCheckStatuses),
  /** What the plan says and what the rule says, in words. */
  why: z.string().min(1),
});
export type RuleCheck = z.infer<typeof ruleCheckSchema>;

export const auditReportSchema = z.object({
  /** `post` when the launch is out and results were given. */
  phase: z.enum(['pre', 'post']),
  items: z.array(reportItemSchema),
  risks: z.array(launchLineSchema),
  /** Stronger options Qloo's data points to ("Worth a look"). Every line cites a finding. */
  alternatives: z.array(launchLineSchema),
  results: resultsComparisonSchema.nullable(),
  comps: z.array(compUsedSchema),
  findings: z.array(findingSchema),
  sources: z.array(planSourceSchema).default([]),
  dropped: z.array(droppedLineSchema),
  writer: z.enum(['model', 'template']),
  /** The plan set beside the launch rules, for categories that have dated rules. */
  ruleChecks: z.array(ruleCheckSchema).default([]),
});
export type AuditReport = z.infer<typeof auditReportSchema>;
