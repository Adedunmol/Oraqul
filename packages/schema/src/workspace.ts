import { z } from 'zod';
import { answerSchema } from './agent';
import { roleSchema } from './categories';
import { outputSchema } from './output';
import { attachmentSchema, projectSchema, workspaceProjectSchema } from './project';
import { threadItemSchema, threadSchema } from './thread';

// Responses of the project and thread routes (spec §7) that the workspace reads.

export const threadSummarySchema = z.object({
  thread: threadSchema,
  outputCount: z.number().int().min(0),
  unread: z.boolean(),
});
export type ThreadSummary = z.infer<typeof threadSummarySchema>;

/** `GET /projects/:projectId` */
export const projectDetailSchema = z.object({
  project: workspaceProjectSchema,
  /** Newest first. */
  threads: z.array(threadSummarySchema),
  /** In creation order. */
  outputs: z.array(outputSchema),
  currentPlanId: z.uuid().nullable(),
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

/** `GET /outputs/:outputId` */
export const outputDetailSchema = z.object({
  output: outputSchema,
  project: projectSchema,
  thread: threadSchema,
  /** The output it was built on: the parent plan, or the plan a date check or brief came from. */
  builtOn: outputSchema.nullable(),
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
