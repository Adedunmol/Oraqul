import { z } from 'zod';
import { briefSchema, planSectionKeys } from './brief';
import { type Job, jobSchema } from './categories';
import { launchPlanSchema } from './plan';
import { receiptSchema } from './receipt';
import { refreshReportSchema } from './refresh';
import { auditReportSchema } from './report';
import { verdictSchema } from './verdict';

// Draft: the responses of `GET /outputs/:id` and `GET /projects/:id/compare` (spec §7) as the web
// demo uses them. Headline, moves, stats, counts and confidence are computed by code, never by
// the model (hard rule 1), so the web app only renders them.

export const outputTabKeys = [
  'summary',
  'audience',
  'assumptions',
  'plan',
  'risks',
  'cannot',
  'evidence',
  'changes',
  'results',
  'date',
  'partners',
  'territories',
  'route',
  'supportacts',
  'contrast',
  'shelf',
  'bridge',
  'topics',
  'fanbase',
  'regions',
  'alternatives',
  'calls',
  'kit',
  'fixes',
  'campaign',
  'watch',
  'refresh',
] as const;
export const outputTabKeySchema = z.enum(outputTabKeys);

/** Tabs come from the output kind and the category pack. The note is product copy: spec §9.3. */
export const outputTabSchema = z.object({
  key: outputTabKeySchema,
  label: z.string(),
  note: z.string(),
});

export const overallConfidenceSchema = z.object({
  level: z.enum(['high', 'medium', 'low']),
  why: z.string(),
});

export const verdictCountsSchema = z.object({
  holds: z.number().int().min(0),
  weak: z.number().int().min(0),
  breaks: z.number().int().min(0),
  cant: z.number().int().min(0),
});

export const outputStatSchema = z.object({
  label: z.string(),
  /** Display value. Numbers are already formatted by the API. */
  value: z.string(),
  verdict: verdictSchema.optional(),
});

export const moveSchema = z.object({
  text: z.string(),
  /** The line whose receipt backs this move. Null for advice with no Qloo call behind it. */
  lineId: z.string().nullable(),
});

/** One line that differs from the parent output. `before` is null for a new line. */
export const lineChangeSchema = z.object({
  lineId: z.string(),
  label: z.string(),
  before: z.string().nullable(),
  after: z.string().nullable(),
});

export const glanceRowSchema = z.object({
  label: z.string(),
  name: z.string(),
  value: z.string(),
  lineId: z.string(),
  note: z.string().optional(),
});

export const evidenceRowSchema = z.object({
  lineId: z.string(),
  label: z.string(),
  /** Display name of the brief group, such as "Assumptions" or "Trailer pairings". */
  group: z.string(),
  verdict: verdictSchema.optional(),
  returned: z.string(),
  /** True when the line drove a recommendation or an assumption that is weak or breaks. */
  driver: z.boolean(),
});

export const planSectionSchema = z.object({
  key: z.enum(planSectionKeys),
  title: z.string(),
  /** Singular, for "At a glance" rows. */
  one: z.string(),
});

export const outputSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  threadId: z.uuid(),
  kind: jobSchema,
  /** The output this one was built on. */
  parentId: z.uuid().nullable(),
  title: z.string(),
  /** Title with its version, such as "v2 · New plan". */
  label: z.string(),
  /** Short version mark for chart axes, such as "v2" or "S1". */
  shortLabel: z.string(),
  kindLabel: z.string(),
  createdBy: z.string(),
  createdAt: z.iso.datetime(),
  headline: z.string(),
  moves: z.array(moveSchema),
  confidence: overallConfidenceSchema,
  stats: z.array(outputStatSchema),
  counts: verdictCountsSchema,
  /** Plain text of the bottom line, moves and confidence, for "Copy summary". */
  summary: z.string(),
  changes: z.array(lineChangeSchema),
  /** Lines this output is about, such as the briefed partner or the checked dates. */
  focusIds: z.array(z.string()),
  dateSource: z.enum(['you', 'calendar']).optional(),
  /** True while a launch watch is on for this plan, so the chat does not offer to start one. */
  watching: z.boolean().optional(),
  tabs: z.array(outputTabSchema),
  sections: z.array(planSectionSchema),
  glance: z.array(glanceRowSchema),
  brief: briefSchema,
  /** The launch plan for outputs built on findings (Film). Null for the older brief shape. */
  plan: launchPlanSchema.nullable(),
  /**
   * The audit report, for an audit. A fixed plan carries the report it was written from, for its
   * "What was fixed" tab. Null for every other kind.
   */
  report: auditReportSchema.nullable(),
  /** What a check on a saved plan found changed, for a `refresh` output. Null for every other kind. */
  refresh: refreshReportSchema.nullable().optional(),
  evidence: z.array(evidenceRowSchema),
  receipts: z.array(receiptSchema),
  /** What the evidence cannot show for this category, for the note under the Evidence tab. */
  limits: z.string(),
  /** Category wording for the Results tab. Present on fixes. */
  resultsCopy: z
    .object({
      dateLabel: z.string(),
      chartTitle: z.string(),
      chartNote: z.string(),
      groupNoun: z.string(),
      secondaryTitle: z.string(),
      holdShort: z.string(),
      holdNote: z.string(),
      placesTitle: z.string(),
    })
    .optional(),
});

export const compareResponseSchema = z.object({
  a: z.uuid(),
  b: z.uuid(),
  changes: z.array(lineChangeSchema),
});

/** Kinds whose output is a launch plan. A fix is a plan written from an audit. */
export const planKinds = ['build', 'scenario', 'fix', 'creative', 'rescue'] as const;
/** Kinds whose output is a findings report on a plan someone brought. */
export const reportKinds = ['audit'] as const;

/** The three shapes of reply (spec §3.6). Date and partner are small briefs on a plan. */
export function outputNature(kind: Job): 'plan' | 'report' | 'brief' {
  if ((planKinds as readonly Job[]).includes(kind)) return 'plan';
  if ((reportKinds as readonly Job[]).includes(kind)) return 'report';
  return 'brief';
}

export type OutputTabKey = z.infer<typeof outputTabKeySchema>;
export type OutputTab = z.infer<typeof outputTabSchema>;
export type OverallConfidence = z.infer<typeof overallConfidenceSchema>;
export type VerdictCounts = z.infer<typeof verdictCountsSchema>;
export type OutputStat = z.infer<typeof outputStatSchema>;
export type Move = z.infer<typeof moveSchema>;
export type LineChange = z.infer<typeof lineChangeSchema>;
export type GlanceRow = z.infer<typeof glanceRowSchema>;
export type EvidenceRow = z.infer<typeof evidenceRowSchema>;
export type PlanSection = z.infer<typeof planSectionSchema>;
export type Output = z.infer<typeof outputSchema>;
export type CompareResponse = z.infer<typeof compareResponseSchema>;
