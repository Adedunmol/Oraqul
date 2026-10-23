import { z } from 'zod';
import { contextItemSchema, questionOptionSchema } from './events';
import { findingSchema } from './finding';

// Draft: `GET /threads/:id` (spec §7) as the web demo uses it. Items follow the `messages` table
// roles in spec §6. The live run streams `threadEventSchema`; this is the stored transcript.

export const threadSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  createdBy: z.string(),
  createdAt: z.iso.datetime(),
  /** The plan output this thread works on now. Moves forward as the thread makes new plans. */
  baseOutputId: z.uuid().nullable(),
  /** The plan output the thread started from. */
  fromOutputId: z.uuid().nullable(),
  /** True when the person chose to ignore earlier plans. */
  fresh: z.boolean(),
});

const splitSchema = z.object({
  title: z.string(),
  groups: z.array(z.string()).min(1),
  /** Percent per group, adding up to 100. */
  values: z.array(z.number().int().min(0).max(100)),
});

const questionBase = { id: z.string(), prompt: z.string() };

/** A question card. The fields after `card` depend on its type, spec §9.3 and design-system §7.14. */
export const questionCardSchema = z.discriminatedUnion('card', [
  z.object({
    ...questionBase,
    card: z.literal('single'),
    options: z.array(questionOptionSchema),
    /** Under the options, such as that typing an answer works too. */
    hint: z.string().optional(),
  }),
  z.object({ ...questionBase, card: z.literal('match'), options: z.array(questionOptionSchema) }),
  z.object({
    ...questionBase,
    card: z.literal('multi'),
    options: z.array(questionOptionSchema),
    /** Under the options, such as that typing an answer works too. */
    hint: z.string().optional(),
  }),
  z.object({
    ...questionBase,
    card: z.literal('text'),
    hint: z.string(),
    /** File names the person can attach instead of typing. Simulated in the demo. */
    attachments: z.array(z.string()).optional(),
  }),
  z.object({ ...questionBase, card: z.literal('split'), split: splitSchema }),
  z.object({ ...questionBase, card: z.literal('date'), defaultValue: z.iso.date() }),
  z.object({
    ...questionBase,
    card: z.literal('file'),
    dropLabel: z.string(),
    /** A way to answer without a file, such as "I'll type the numbers instead". */
    altLabel: z.string().optional(),
  }),
  z.object({
    ...questionBase,
    card: z.literal('confirm'),
    rows: z.array(z.object({ label: z.string(), value: z.string() })),
    primary: splitSchema,
    secondary: splitSchema.nullable(),
    holdLabel: z.string(),
    hold: z.number().int().min(0).max(200),
  }),
]);

export const threadItemSchema = z.discriminatedUnion('role', [
  z.object({ id: z.string(), role: z.literal('user'), text: z.string() }),
  z.object({ id: z.string(), role: z.literal('agent'), text: z.string() }),
  z.object({
    id: z.string(),
    role: z.literal('question'),
    question: questionCardSchema,
    /** What the person answered, as shown back to them. Null while the card is open. */
    answer: z.string().nullable(),
  }),
  z.object({
    id: z.string(),
    role: z.literal('trace'),
    steps: z.array(z.string()),
    /** Steps finished so far. Equal to `steps.length` once the run is done. */
    done: z.number().int().min(0),
    /** What the queries found, in the order they landed. */
    findings: z.array(findingSchema).default([]),
  }),
  z.object({ id: z.string(), role: z.literal('output'), outputId: z.uuid() }),
  /** What a run started from: the brief, the plan, the chat. Shown as one "Using" line. */
  z.object({ id: z.string(), role: z.literal('context'), items: z.array(contextItemSchema) }),
]);

/** Body of `POST /threads/:id/messages` for the richer demo cards. */
export const questionAnswerSchema = z.discriminatedUnion('card', [
  z.object({ card: z.literal('options'), optionIds: z.array(z.string()).min(1) }),
  z.object({ card: z.literal('text'), text: z.string().min(1) }),
  z.object({ card: z.literal('attachments'), names: z.array(z.string()).min(1) }),
  z.object({ card: z.literal('split'), values: z.array(z.number().int()) }),
  z.object({ card: z.literal('date'), value: z.iso.date() }),
  z.object({ card: z.literal('file'), name: z.string() }),
  z.object({ card: z.literal('alt') }),
  z.object({
    card: z.literal('confirm'),
    primary: z.array(z.number().int()),
    secondary: z.array(z.number().int()).nullable(),
    hold: z.number().int(),
  }),
]);

export type Thread = z.infer<typeof threadSchema>;
export type QuestionCard = z.infer<typeof questionCardSchema>;
export type ThreadItem = z.infer<typeof threadItemSchema>;
export type QuestionAnswer = z.infer<typeof questionAnswerSchema>;
