import { z } from 'zod';
import { answerSchema } from './agent';
import { roleSchema } from './categories';
import { outputSchema } from './output';
import { directionCallSchema, partnerOptionSchema, territorySchema } from './plan';
import { attachmentSchema, projectSchema, workspaceProjectSchema } from './project';
import { threadItemSchema, threadSchema } from './thread';

// Responses of the project and thread routes (spec §7) that the workspace reads.

export const threadSummarySchema = z.object({
  thread: threadSchema,
  outputCount: z.number().int().min(0),
  unread: z.boolean(),
});
export type ThreadSummary = z.infer<typeof threadSummarySchema>;

/** One thing a project remembers (spec §3.7). */
export const memoryItemSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['point', 'decision', 'plan']),
  text: z.string(),
  updatedAt: z.iso.datetime(),
});
export type MemoryItem = z.infer<typeof memoryItemSchema>;

/** `GET /projects/:projectId` */
export const projectDetailSchema = z.object({
  project: workspaceProjectSchema,
  /** Newest first. */
  threads: z.array(threadSummarySchema),
  /** In creation order. */
  outputs: z.array(outputSchema),
  currentPlanId: z.uuid().nullable(),
  /** What the project remembers, plans first (spec §3.7). */
  memory: z.array(memoryItemSchema),
  myRole: roleSchema,
});
export type ProjectDetail = z.infer<typeof projectDetailSchema>;

/** `GET /threads/:threadId` */
export const threadDetailSchema = z.object({
  thread: threadSchema,
  project: workspaceProjectSchema,
  items: z.array(threadItemSchema),
  /** Outputs made in this thread, in creation order. */
  outputs: z.array(outputSchema),
  /** Every output of the project, so chat cards can name them. */
  projectOutputs: z.array(outputSchema),
  /** True while a run is going. The message box waits for it. */
  busy: z.boolean(),
  /** The last stored event; the event stream resumes after it. */
  lastSeq: z.number().int().min(0),
});
export type ThreadDetail = z.infer<typeof threadDetailSchema>;

/** An output's read only link (spec §7). Absent until someone turns it on. */
export const shareStateSchema = z.object({ token: z.string().min(1), enabled: z.boolean() });
export type ShareState = z.infer<typeof shareStateSchema>;

/** Body of `PUT /outputs/:outputId/share`. */
export const setShareSchema = z.object({ enabled: z.boolean() });

/** `GET /outputs/:outputId` */
/**
 * How a person rates a plan: useful, or wrong. `edited` is kept for the day a line can be edited, so
 * a reaction recorded then needs no new migration. A person has at most one reaction per plan.
 */
export const reactionKinds = ['useful', 'wrong', 'edited'] as const;
export const reactionKindSchema = z.enum(reactionKinds);
export type ReactionKind = z.infer<typeof reactionKindSchema>;

/** Body of `PUT /outputs/:outputId/reaction`. `null` takes the reaction back. */
export const setReactionSchema = z.object({ kind: reactionKindSchema.nullable() });
export type SetReaction = z.infer<typeof setReactionSchema>;

/** The caller's own reaction to an output, or null for none. */
export const reactionStateSchema = z.object({ kind: reactionKindSchema.nullable() });
export type ReactionState = z.infer<typeof reactionStateSchema>;

export const outputDetailSchema = z.object({
  output: outputSchema,
  project: projectSchema,
  thread: threadSchema,
  /** The output it was built on: the parent plan, or the plan a date check or brief came from. */
  builtOn: outputSchema.nullable(),
  /** The read only link, once it has been turned on at least once. Always null on a shared view. */
  share: shareStateSchema.nullable(),
  /** The caller's own reaction to the output. Always null on a shared view. */
  reaction: reactionKindSchema.nullable(),
});
export type OutputDetail = z.infer<typeof outputDetailSchema>;

/** Body of `POST /threads/:threadId/messages`. Typed text also answers an open question. */
export const postMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    text: z.string().max(20_000),
    attachments: z.array(attachmentSchema).max(5).default([]),
  }),
  z.object({ kind: z.literal('answer'), answer: answerSchema }),
]);
export type PostMessage = z.input<typeof postMessageSchema>;

/**
 * `POST /projects/:projectId/threads` body. A chat with `fresh` leaves out the project's memory and
 * its plans and knows only the category and the project's name.
 */
export const createThreadInputSchema = z.object({ fresh: z.boolean().default(false) });
export type CreateThreadInput = z.input<typeof createThreadInputSchema>;

/** `GET /projects/:projectId/memory` */
export const memoryListSchema = z.array(memoryItemSchema);

/** `PATCH /memory/:itemId` */
export const updateMemoryInputSchema = z.object({ text: z.string().trim().min(1).max(280) });
export type UpdateMemoryInput = z.infer<typeof updateMemoryInputSchema>;

/** `POST /projects/:projectId/threads`: a new chat, idle until the first message. */
export const createThreadResultSchema = z.object({ threadId: z.uuid() });
export type CreateThreadResult = z.infer<typeof createThreadResultSchema>;

/** `GET /teams/:teamId/projects` */
export const projectListSchema = z.array(projectSchema);

export const recentThreadSchema = z.object({
  thread: threadSchema,
  project: projectSchema,
  outputCount: z.number().int().min(0),
  unread: z.boolean(),
  busy: z.boolean(),
});
export type RecentThread = z.infer<typeof recentThreadSchema>;

/** Why something is on the "Needs you" list, ordered by how soon it needs a person. */
export const needReasons = ['answer', 'results', 'ready', 'working'] as const;
export type NeedReason = (typeof needReasons)[number];

export const needsYouItemSchema = z.discriminatedUnion('reason', [
  z.object({
    reason: z.literal('answer'),
    thread: threadSchema,
    project: projectSchema,
    prompt: z.string(),
  }),
  z.object({ reason: z.literal('ready'), thread: threadSchema, project: projectSchema }),
  z.object({ reason: z.literal('working'), thread: threadSchema, project: projectSchema }),
  z.object({ reason: z.literal('results'), project: projectSchema }),
]);
export type NeedsYouItem = z.infer<typeof needsYouItemSchema>;

/** `GET /teams/:teamId/overview` */
export const overviewSchema = z.object({
  needsYou: z.array(needsYouItemSchema),
  /** Newest first, leaving out threads already under "Needs you". */
  threads: z.array(recentThreadSchema),
});
export type Overview = z.infer<typeof overviewSchema>;

/** Body of `PUT /outputs/:outputId/partners`: the team's own partners, replacing the earlier list. */
export const setPartnersSchema = z.object({
  names: z.array(z.string().trim().min(1).max(80)).max(12),
});
export type SetPartners = z.infer<typeof setPartnersSchema>;

/** What the partners, their calls and the territories look like after the team's list changes. */
export const partnersStateSchema = z.object({
  partners: z.array(partnerOptionSchema),
  calls: z.array(directionCallSchema),
  territories: z.array(territorySchema),
});
export type PartnersState = z.infer<typeof partnersStateSchema>;
