import { z } from 'zod';
import { confidenceSchema, verdictSchema } from './verdict';

// Draft: the shape the web demo renders until the API serves outputs (spec §6 `brief`).
// Every line has an `id` that stays stable across versions, which is how diffs and "changed"
// marks work. Receipts point back at a line through `receipt.lineId`.

const lineIdSchema = z.string().min(1);
const indexSchema = z.number().int().min(0).max(100);

export const audienceSegmentSchema = z.object({
  id: lineIdSchema,
  name: z.string(),
  /** Taste affinity index, 0 to 100. Not a share of buyers. */
  affinity: indexSchema,
  evidence: z.string(),
});

export const assumptionSchema = z.object({
  id: lineIdSchema,
  text: z.string(),
  verdict: verdictSchema,
  why: z.string(),
  /** Empty when the verdict needs no action. */
  fix: z.string(),
  /** True when the plan relies on it without saying so. */
  unstated: z.boolean(),
  /** Where an audited plan states it, such as "Plan, p. 2". Only on audits. */
  source: z.string().optional(),
});

export const adaptationMedia = ['Series', 'Film', 'Podcast'] as const;

/** A ranked pick in a plan section. Fit bands are in spec §5. */
export const fitLineSchema = z.object({
  id: lineIdSchema,
  name: z.string(),
  fit: indexSchema,
  evidence: z.string(),
  /** A caveat the agent added, such as "Cut first: weakest evidence". */
  note: z.string().optional(),
  medium: z.enum(adaptationMedia).optional(),
});

/** Lift over a neutral audience, banded by code: spec §5. */
export const liftBandSchema = z.enum(['strong', 'usable', 'weak']);

export const placeSchema = z.object({
  id: lineIdSchema,
  name: z.string(),
  /** Ratio, 1.0 is a neutral audience. */
  lift: z.number().min(0),
  band: liftBandSchema,
  /** Opening date in this place, when the plan sets one. */
  date: z.string().optional(),
  audience: z.string(),
  confidence: confidenceSchema,
  note: z.string(),
});

/** Shared audience with a rival on a date, banded by code: spec §5. */
export const overlapBandSchema = z.enum(['low', 'moderate', 'high']);

export const rivalDateSchema = z.object({
  id: lineIdSchema,
  date: z.string(),
  /** Index into `brief.weeks`. */
  week: z.number().int().min(0),
  rival: z.string(),
  overlap: indexSchema,
  band: overlapBandSchema,
  advice: z.string(),
});

export const partnerSchema = z.object({
  id: lineIdSchema,
  name: z.string(),
  type: z.string(),
  fits: z.string(),
  evidence: z.string(),
  /** Outreach text for a person to send. Oraqul never sends it. */
  draft: z.string(),
});

export const riskSchema = z.object({
  id: lineIdSchema,
  text: z.string(),
  signal: z.string(),
  action: z.string(),
});

export const untestedSchema = z.object({ id: lineIdSchema, item: z.string(), reason: z.string() });

export const compTitleSchema = z.object({
  id: lineIdSchema,
  name: z.string(),
  /** Share of the comp's readers who also read this book, 0 to 100. */
  overlap: indexSchema,
  evidence: z.string(),
});

export const topicSchema = z.object({
  id: lineIdSchema,
  name: z.string(),
  /** `distinct` tags weigh more in this audience than in rival audiences. */
  ownership: z.enum(['distinct', 'shared']),
  /** Tag weight against rival shows, as a ratio. */
  weight: z.number().min(0),
  evidence: z.string(),
});

export const supportGridSchema = z.object({
  cities: z.array(z.string()),
  rows: z.array(
    z.object({
      id: lineIdSchema,
      name: z.string(),
      /** Planned, Suggested by Oraqul, Chosen or Dropped. */
      tag: z.string(),
      /** One lift per city, in the order of `cities`. */
      lifts: z.array(z.number().min(0)),
      average: z.number().min(0),
      /** Shade step per city, 0 (weakest) to 3 (strongest). */
      levels: z.array(z.number().int().min(0).max(3)),
    }),
  ),
  bestRowId: lineIdSchema,
});

export const routeSummarySchema = z.object({
  /** Lift weighted by stop position, earlier stops count more. */
  score: z.number(),
  bestScore: z.number(),
  bestOrder: z.array(z.string()),
  isBestOrder: z.boolean(),
});

export const fanBaseSchema = z.object({
  id: lineIdSchema,
  name: z.string(),
  before: indexSchema,
  after: indexSchema,
  evidence: z.string(),
  note: z.string().optional(),
});

/** Numbers the person supplied for a fix. Percent values add up to 100 per group. */
export const resultsSchema = z.object({
  date: z.string(),
  /** Actual share per label in `brief.groupLabels`, in percent. */
  actual: z.array(z.number()),
  secondary: z.array(z.object({ label: z.string(), share: z.number() })).nullable(),
  /** The category's hold measure, in percent (weekend two, sell through and so on). */
  hold: z.number().nullable(),
});

export const courseSchema = z.object({
  summary: z.string(),
  actions: z.array(z.string()),
  places: z.array(z.string()),
  stop: z.array(z.string()),
});

export const briefSchema = z.object({
  audience: z.array(audienceSegmentSchema),
  assumptions: z.array(assumptionSchema),
  s1: z.array(fitLineSchema),
  s2: z.array(fitLineSchema),
  s3: z.array(fitLineSchema),
  s4: z.array(fitLineSchema),
  places: z.array(placeSchema),
  weeks: z.array(z.string()),
  dates: z.array(rivalDateSchema),
  chosenDate: z.string(),
  partners: z.array(partnerSchema),
  risks: z.array(riskSchema),
  cannot: z.array(untestedSchema),
  /** Labels for the planned and actual splits on a fix. */
  groupLabels: z.array(z.string()),
  /** Planned share per label in `groupLabels`, in percent. */
  planned: z.array(z.number()),
  results: resultsSchema.nullable(),
  course: courseSchema.nullable(),
  grid: supportGridSchema.optional(),
  route: routeSummarySchema.optional(),
  shelf: z.array(compTitleSchema).optional(),
  bridge: z.array(fitLineSchema).optional(),
  topics: z.array(topicSchema).optional(),
  fan: z.array(fanBaseSchema).optional(),
});

export const planSectionKeys = ['s1', 's2', 's3', 's4'] as const;
export type PlanSectionKey = (typeof planSectionKeys)[number];

export type AudienceSegment = z.infer<typeof audienceSegmentSchema>;
export type Assumption = z.infer<typeof assumptionSchema>;
export type FitLine = z.infer<typeof fitLineSchema>;
export type LiftBand = z.infer<typeof liftBandSchema>;
export type Place = z.infer<typeof placeSchema>;
export type OverlapBand = z.infer<typeof overlapBandSchema>;
export type RivalDate = z.infer<typeof rivalDateSchema>;
export type Partner = z.infer<typeof partnerSchema>;
export type Risk = z.infer<typeof riskSchema>;
export type Untested = z.infer<typeof untestedSchema>;
export type CompTitle = z.infer<typeof compTitleSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type SupportGrid = z.infer<typeof supportGridSchema>;
export type RouteSummary = z.infer<typeof routeSummarySchema>;
export type FanBase = z.infer<typeof fanBaseSchema>;
export type Results = z.infer<typeof resultsSchema>;
export type Course = z.infer<typeof courseSchema>;
export type Brief = z.infer<typeof briefSchema>;
