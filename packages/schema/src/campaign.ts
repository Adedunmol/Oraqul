import { z } from 'zod';
import { lineKindSchema } from './plan';

// The campaign workspace: a saved plan's content calendar as actions a team can run and tick off.
// An action set belongs to one plan version (an output), so a revised plan starts its own set and
// the earlier set, with the team's edits, is never touched. Everything here is a guide the team
// adapts: Oraqul makes no final asset (launch rules D8).

export const actionStatuses = ['todo', 'doing', 'done'] as const;
export const actionStatusSchema = z.enum(actionStatuses);
export type ActionStatus = z.infer<typeof actionStatusSchema>;

/** The part of the creative kit an action carries as its guide. */
export const guideKinds = ['hooks', 'captions', 'keyart'] as const;
export const guideKindSchema = z.enum(guideKinds);
export type GuideKind = z.infer<typeof guideKindSchema>;

export const guideLineSchema = z.object({
  id: z.string(),
  text: z.string(),
  /** Grounded lines cite findings; playbook lines are launch craft and cite nothing. */
  kind: lineKindSchema,
  findingIds: z.array(z.string()),
});
export type GuideLine = z.infer<typeof guideLineSchema>;

export const campaignGuideSchema = z.object({
  kind: guideKindSchema,
  lines: z.array(guideLineSchema),
});
export type CampaignGuide = z.infer<typeof campaignGuideSchema>;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const campaignActionSchema = z.object({
  id: z.uuid(),
  outputId: z.uuid(),
  /** The calendar row the action came from. Null for an action the team added. */
  rowId: z.string().nullable(),
  territory: z.string().nullable(),
  channel: z.string(),
  /** What to post, in playbook wording. The team can rewrite it. */
  title: z.string(),
  asset: z.string().nullable(),
  startsOn: dateSchema.nullable(),
  endsOn: dateSchema.nullable(),
  /** Weeks from the release, negative before it. Kept so an undated action still has a place. */
  week: z.number().int().nullable(),
  guide: campaignGuideSchema.nullable(),
  /** The findings behind the guide's grounded lines. The action itself is always playbook. */
  findingIds: z.array(z.string()),
  status: actionStatusSchema,
  note: z.string(),
  /** True once the team has changed the action from what the plan wrote. */
  edited: z.boolean(),
  updatedAt: z.string(),
});
export type CampaignAction = z.infer<typeof campaignActionSchema>;

export const testAngleSchema = z.object({
  id: z.enum(['a', 'b']),
  label: z.string(),
  text: z.string(),
  /** `grounded` cites a finding. `playbook` is craft and cites nothing. */
  basis: lineKindSchema,
  findingIds: z.array(z.string()),
});
export type TestAngle = z.infer<typeof testAngleSchema>;

/**
 * Two creative angles for one action, each with its reasoning, and the one thing to measure. There
 * is no winner field: Oraqul never predicts one, and a result is compared in code once it exists.
 */
export const campaignTestSchema = z.object({
  id: z.uuid(),
  actionId: z.uuid(),
  angles: z.tuple([testAngleSchema, testAngleSchema]),
  measure: z.string(),
  /** The ad-test conventions the test follows, as the calendar rules state them. */
  conventions: z.array(z.string()),
  createdAt: z.string(),
});
export type CampaignTest = z.infer<typeof campaignTestSchema>;

/** Another version of the same plan that has its own action set. */
export const campaignSiblingSchema = z.object({
  outputId: z.uuid(),
  title: z.string(),
  createdAt: z.string(),
  actions: z.number().int(),
  done: z.number().int(),
});
export type CampaignSibling = z.infer<typeof campaignSiblingSchema>;

/** `GET /outputs/:outputId/campaign`. */
export const campaignStateSchema = z.object({
  outputId: z.uuid(),
  /** What the plan has: `ready` to set up, `set` once made, `none` with the reason it cannot be. */
  status: z.enum(['none', 'ready', 'set']),
  /** Why there is nothing to set up, in plain words. Null otherwise. */
  reason: z.string().nullable(),
  actions: z.array(campaignActionSchema),
  tests: z.array(campaignTestSchema),
  others: z.array(campaignSiblingSchema),
});
export type CampaignState = z.infer<typeof campaignStateSchema>;

/** Body of `PATCH /outputs/:outputId/campaign/actions/:actionId`. Only what is sent changes. */
export const updateCampaignActionSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    channel: z.string().trim().min(1).max(80),
    startsOn: dateSchema.nullable(),
    endsOn: dateSchema.nullable(),
    status: actionStatusSchema,
    note: z.string().max(2000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' });
export type UpdateCampaignAction = z.infer<typeof updateCampaignActionSchema>;
