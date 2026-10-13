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

/** `GET /demo/projects`: one project per category, keyed by the category id. */
export const demoProjectsResponseSchema = z.array(
  z.object({ id: categorySchema, project: projectInputSchema }),
);
export type DemoProjectsResponse = z.infer<typeof demoProjectsResponseSchema>;
