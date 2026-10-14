import { z } from 'zod';

/** The projects one person keeps at the top of their project lists, newest first. */
export const pinnedProjectsSchema = z.array(z.string().min(1));

export type PinnedProjects = z.infer<typeof pinnedProjectsSchema>;
