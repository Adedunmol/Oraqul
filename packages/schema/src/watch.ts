import { z } from 'zod';

// Launch Watch and actuals (spec §5.17 to §5.19). A watch re-checks a saved plan on a schedule and
// raises events; it never changes the plan. Actuals are the team's own figures against the plan's
// primary signal. Verdicts, severities and dates are all computed by code.

export const watchCadences = ['daily', 'weekly'] as const;
export const watchCadenceSchema = z.enum(watchCadences);
export type WatchCadence = z.infer<typeof watchCadenceSchema>;

export const watchStatuses = ['active', 'paused'] as const;
export const watchStatusSchema = z.enum(watchStatuses);

export const watchSeverities = ['info', 'watch', 'act'] as const;
export const watchSeveritySchema = z.enum(watchSeverities);
export type WatchSeverity = z.infer<typeof watchSeveritySchema>;

export const watchEventTypes = [
  'rival_date',
  'milestone_overdue',
  'plan_stale',
  'pace_behind',
] as const;
export const watchEventTypeSchema = z.enum(watchEventTypes);
export type WatchEventType = z.infer<typeof watchEventTypeSchema>;

export const watchEventStatuses = ['open', 'approved', 'dismissed'] as const;
export const watchEventStatusSchema = z.enum(watchEventStatuses);

/** A page an event rests on, with the day it was read. A date from the web is never from Qloo. */
export const watchEvidenceSchema = z.object({
  url: z.string(),
  title: z.string(),
  retrievedAt: z.string(),
  /** The words on the page the event rests on. */
  quote: z.string().nullable().default(null),
});
export type WatchEvidence = z.infer<typeof watchEvidenceSchema>;

export const watchEventSchema = z.object({
  id: z.uuid(),
  type: watchEventTypeSchema,
  severity: watchSeveritySchema,
  title: z.string(),
  /** Why it was raised, in plain words, written by code from the checked fields. */
  reason: z.string(),
  evidence: z.array(watchEvidenceSchema),
  status: watchEventStatusSchema,
  /** The output an approved action made, such as a refresh or a rescue. */
  actionOutputId: z.uuid().nullable(),
  createdAt: z.string(),
  seen: z.boolean(),
});
export type WatchEvent = z.infer<typeof watchEventSchema>;

// Pace -----------------------------------------------------------------------------------------

export const paceVerdicts = ['ahead', 'on-pace', 'behind', 'too-early'] as const;
export const paceVerdictSchema = z.enum(paceVerdicts);
export type PaceVerdict = z.infer<typeof paceVerdictSchema>;

export const tooEarlyReasons = [
  'no-target',
  'no-entries',
  'no-release-date',
  'few-entries',
  'before-first-checkpoint',
  'low-expected',
] as const;

export const paceKinds = ['cumulative', 'level'] as const;
export const paceKindSchema = z.enum(paceKinds);
export const entryModes = ['daily', 'running-total'] as const;
export const entryModeSchema = z.enum(entryModes);

/** Expected share of the target by a day, counted in days from release (negative is before). */
export const curvePointSchema = z.object({
  day: z.number().int(),
  share: z.number().min(0).max(1.5),
});
export type CurvePoint = z.infer<typeof curvePointSchema>;

export const paceSettingsSchema = z.object({
  target: z.number().positive().nullable(),
  unit: z.string(),
  kind: paceKindSchema,
  entry: entryModeSchema,
  curve: z.array(curvePointSchema),
  curveFrom: z.enum(['rule', 'team']),
  /** The rule's version, so a reader knows which convention the default curve came from. */
  rulesVersion: z.string(),
});
export type PaceSettings = z.infer<typeof paceSettingsSchema>;

export const updatePaceSchema = z.object({
  target: z.number().positive().nullable().optional(),
  entry: entryModeSchema.optional(),
  curve: z.array(curvePointSchema).min(2).max(12).optional(),
  /** True puts the rule's default curve back. */
  resetCurve: z.boolean().optional(),
});

export type UpdatePaceBody = z.infer<typeof updatePaceSchema>;

export const actualEntrySchema = z.object({
  id: z.uuid(),
  onDate: z.string(),
  value: z.number(),
  city: z.string(),
  channel: z.string(),
});
export type ActualEntry = z.infer<typeof actualEntrySchema>;

export const paceResultSchema = z.object({
  verdict: paceVerdictSchema,
  reason: z.enum(tooEarlyReasons).nullable(),
  target: z.number().nullable(),
  unit: z.string(),
  actual: z.number().nullable(),
  expected: z.number().nullable(),
  /** Actual minus expected, in the signal's unit. Null when nothing could be compared. */
  gap: z.number().nullable(),
  /** The gap as points of the target (a gap of 150 on a target of 1,000 is 15). */
  gapPoints: z.number().nullable(),
  entries: z.number().int(),
  /** Days from the first entry to the last. */
  days: z.number().int(),
  asOf: z.string().nullable(),
  daysToRelease: z.number().int().nullable(),
  /** Always says it is direction against a convention and not a forecast (rule D5). */
  note: z.string(),
});
export type PaceResult = z.infer<typeof paceResultSchema>;

export const paceStateSchema = z.object({
  /** False when the plan has no release date or no signal, so there is nothing to pace against. */
  available: z.boolean(),
  unavailableReason: z.string().nullable(),
  signal: z.string(),
  settings: paceSettingsSchema.nullable(),
  entries: z.array(actualEntrySchema),
  result: paceResultSchema.nullable(),
  releaseDate: z.string().nullable(),
  /** Offered when the result is behind and no rescue is running. */
  canRescue: z.boolean(),
});
export type PaceState = z.infer<typeof paceStateSchema>;

/** A pasted line or CSV row, read into a date and a value before it is saved. */
export const actualRowSchema = z.object({
  onDate: z.string(),
  value: z.number(),
  city: z.string().default(''),
  channel: z.string().default(''),
});
export type ActualRow = z.infer<typeof actualRowSchema>;

export const actualsPreviewSchema = z.object({
  text: z.string().min(1).max(200_000),
  /** CSV column names, when the text has a header row and the person has mapped it. */
  mapping: z
    .object({
      date: z.string(),
      value: z.string(),
      city: z.string().nullable().default(null),
      channel: z.string().nullable().default(null),
    })
    .nullable()
    .default(null),
});

export const actualsPreviewResultSchema = z.object({
  /** Header names when the first line is one, else null. */
  columns: z.array(z.string()).nullable(),
  /** The mapping used or guessed. Null when the text has no header to map. */
  mapping: actualsPreviewSchema.shape.mapping,
  rows: z.array(actualRowSchema),
  errors: z.array(z.object({ line: z.number().int(), message: z.string() })),
});
export type ActualsPreview = z.infer<typeof actualsPreviewResultSchema>;

export const saveActualsSchema = z.object({ rows: z.array(actualRowSchema).min(1).max(2000) });

// Watch state -----------------------------------------------------------------------------------

export const watchStateSchema = z.object({
  outputId: z.uuid(),
  /** `off` when no watch row exists yet. */
  status: z.enum(['off', 'active', 'paused']),
  cadence: watchCadenceSchema,
  minSeverity: watchSeveritySchema,
  lastCheckedAt: z.string().nullable(),
  nextCheckAt: z.string().nullable(),
  /** What the last check could not do, such as "could not check rival dates". */
  notes: z.array(z.string()),
  /** This person's digest is off. */
  muted: z.boolean(),
  unread: z.number().int(),
  events: z.array(watchEventSchema),
  pace: paceStateSchema,
  /** The plan is not a launch plan, so it cannot be watched. */
  watchable: z.boolean(),
});
export type WatchState = z.infer<typeof watchStateSchema>;

export const updateWatchSchema = z.object({
  status: z.enum(['active', 'paused']).optional(),
  cadence: watchCadenceSchema.optional(),
  minSeverity: watchSeveritySchema.optional(),
});
export type UpdateWatch = z.infer<typeof updateWatchSchema>;

/** The token of a calendar feed, shown once when it is made. */
export const calendarFeedTokenSchema = z.object({ token: z.string() });

/** How many runs a person has used this month, out of how many (spec §7 `GET /me/runs`). */
export const runAllowanceSchema = z.object({
  used: z.number().int(),
  cap: z.number().int(),
  /** The first day of next month, when the count starts again. */
  resetsOn: z.string(),
});
export type RunAllowance = z.infer<typeof runAllowanceSchema>;
