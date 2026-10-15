import { z } from 'zod';
import { categorySchema } from './categories';

/** The project fields the agent reads (spec §6 `projects`), without ids or team. */
export const projectInputSchema = z.object({
  category: categorySchema,
  name: z.string().min(1),
  kind: z.string().optional(),
  genre: z.string().optional(),
  places: z.array(z.string()),
  window: z.string().optional(),
  lead: z.string().min(1),
  comps: z.array(z.string()),
});
export type ProjectInput = z.infer<typeof projectInputSchema>;

/**
 * Draft: a project as `GET /projects` and `GET /projects/:id` return it in the web demo.
 * `lead` may be empty while the agent is still asking for it, so this does not extend the input.
 */
export const projectSchema = z.object({
  id: z.uuid(),
  category: categorySchema,
  name: z.string().min(1),
  kind: z.string(),
  genre: z.string(),
  places: z.array(z.string()),
  window: z.string(),
  lead: z.string(),
  comps: z.array(z.string()),
  status: z.string(),
  updatedAt: z.iso.datetime(),
  /** The Qloo entity the person picked, or how the agent falls back when none matched. */
  qlooMatch: z.string().nullable(),
  /** Answers to the category's extra question, keyed by its label, such as "Budget band". */
  extra: z.record(z.string(), z.string()),
});
export type Project = z.infer<typeof projectSchema>;

/** Draft: what a category page shows about its pack (spec §3.2 coverage lists). */
export const categoryInfoSchema = z.object({
  id: categorySchema,
  name: z.string(),
  short: z.string(),
  blurb: z.string(),
  tools: z.array(z.string()),
  coverage: z.object({
    tests: z.array(z.string()),
    thin: z.array(z.string()),
    notSupported: z.array(z.string()),
  }),
  /** Labels for the chat's quick actions: rival date check, add results, partner brief. */
  quick: z.object({ date: z.string(), results: z.string(), partner: z.string() }),
  /** The first preset scenario, shown as the what if bar's example. */
  scenarioExample: z.string(),
  /** What this category calls each project input, such as "Cast" or "Route cities". */
  inputLabels: z.object({
    kind: z.string(),
    genre: z.string(),
    lead: z.string(),
    comps: z.string(),
    places: z.string(),
    window: z.string(),
  }),
  /** The label of the category's extra question, the key into `project.extra`. */
  extraLabel: z.string(),
  /** What the agent uses when the title is not in Qloo, such as "comps and cast". */
  fallback: z.string(),
});
export type CategoryInfo = z.infer<typeof categoryInfoSchema>;
