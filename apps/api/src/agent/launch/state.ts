import { questionSchema } from '@oraqul/schema';
import { z } from 'zod';

/**
 * What a paused run needs to resume. A build pauses before it plans only when the brief has no
 * description or no market (PRD C1): one question, then it plans with whatever it has. After a
 * plan is saved flagged, it may ask once more (`settle`) for the one thing only the person can say.
 */
export const buildStateSchema = z.object({
  job: z.literal('build'),
  kind: z.enum(['build', 'scenario']).default('build'),
  title: z.string().optional(),
  /** What the person typed to the question, added to the brief before it is read again. */
  extra: z.string().default(''),
  asked: z.boolean().default(true),
  /** Set when the plan is already saved and the question is the one that would settle it. */
  settle: z.boolean().default(false),
  pending: questionSchema.nullable(),
});

const reviewFields = {
  /** What the person typed to the questions so far, added to their plan before it is read again. */
  extra: z.string().default(''),
  /** Set once a question about results was asked, so it is asked only once. */
  askedResults: z.boolean().default(false),
  pending: questionSchema.nullable(),
};

/** An audit pauses to ask for the plan, or for results when the launch is out. */
export const auditStateSchema = z.object({ job: z.literal('audit'), ...reviewFields });

/** A fix pauses for the same two things, and to ask whether the launch is out. */
export const fixStateSchema = z.object({
  job: z.literal('fix'),
  ...reviewFields,
  askedPhase: z.boolean().default(false),
});

export const launchStateSchema = z.discriminatedUnion('job', [
  buildStateSchema,
  auditStateSchema,
  fixStateSchema,
]);
export type BuildState = z.infer<typeof buildStateSchema>;
export type AuditState = z.infer<typeof auditStateSchema>;
export type FixState = z.infer<typeof fixStateSchema>;
export type LaunchState = z.infer<typeof launchStateSchema>;
