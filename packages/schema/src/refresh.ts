import { z } from 'zod';

// A check on what has changed since a plan was made. It asks Qloo and the web again with the plan's
// own brief and sets the answers beside what the plan saved. Code does every comparison; the plan
// itself is never changed, and a revision is saved only when the person asks for one.

/** One number a finding states, before and after. */
export const numberMoveSchema = z.object({
  key: z.string(),
  before: z.number(),
  after: z.number(),
});
export type NumberMove = z.infer<typeof numberMoveSchema>;

/** One name a finding lists, with its place in the list before and after. */
export const rankMoveSchema = z.object({
  name: z.string(),
  /** Place in the plan's saved list, from 1. Null when the name was not in it. */
  before: z.number().int().nullable(),
  /** Place in the fresh list, from 1. Null when the name is no longer in it. */
  after: z.number().int().nullable(),
});
export type RankMove = z.infer<typeof rankMoveSchema>;

/**
 * `moved` and `unchanged` are said only for a finding the plan already had. A finding the plan did
 * not have is `new`; one the fresh check did not return is `not-returned`, which is not a change:
 * the check may simply have asked a little differently.
 */
export const findingStatuses = ['moved', 'unchanged', 'new', 'not-returned'] as const;
export const findingStatusSchema = z.enum(findingStatuses);
export type FindingStatus = z.infer<typeof findingStatusSchema>;

export const findingMoveSchema = z.object({
  findingId: z.string(),
  status: findingStatusSchema,
  /** The finding's sentence: the fresh one, or the saved one when it was not returned. */
  text: z.string(),
  numbers: z.array(numberMoveSchema),
  ranks: z.array(rankMoveSchema),
});
export type FindingMove = z.infer<typeof findingMoveSchema>;

export const sourceStatuses = ['same', 'changed', 'new', 'not-found-again'] as const;
export const sourceStatusSchema = z.enum(sourceStatuses);
export type SourceStatus = z.infer<typeof sourceStatusSchema>;

/** A web page, matched to the plan's saved sources by its address. */
export const sourceMoveSchema = z.object({
  status: sourceStatusSchema,
  title: z.string(),
  url: z.string(),
  /** The fact the plan saved from this page. Null for a page the plan did not have. */
  before: z.string().nullable(),
  /** The fact the fresh check read from it. Null when the check did not find the page. */
  after: z.string().nullable(),
  /** The day the fresh fact was read. Null when the page was not found again. */
  retrievedAt: z.string().nullable(),
});
export type SourceMove = z.infer<typeof sourceMoveSchema>;

/** A line of the plan that rests on something that moved, so a reader knows what to look at. */
export const affectedLineSchema = z.object({
  lineId: z.string(),
  group: z.string().nullable(),
  text: z.string(),
});
export type AffectedLine = z.infer<typeof affectedLineSchema>;

export const refreshReportSchema = z.object({
  /** The plan that was checked. It is unchanged. */
  planOutputId: z.string(),
  /** The day of this check. */
  checkedOn: z.string(),
  /** The day the plan's data is from. */
  planAsOf: z.string().nullable(),
  /** What the person asked about, in their words. Null for the general check. */
  question: z.string().nullable(),
  findings: z.array(findingMoveSchema),
  sources: z.array(sourceMoveSchema),
  /** What the check could not do, in plain words. */
  gaps: z.array(z.string()),
  affected: z.array(affectedLineSchema),
});
export type RefreshReport = z.infer<typeof refreshReportSchema>;
