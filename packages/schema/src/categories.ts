import { z } from 'zod';

export const categories = ['film', 'music', 'books', 'podcasts', 'games', 'shows'] as const;
export const categorySchema = z.enum(categories);
export type Category = z.infer<typeof categorySchema>;

/** The three ways a project starts. Each is also the job of the run it starts. */
export const startModes = ['build', 'audit', 'fix'] as const;
export const startModeSchema = z.enum(startModes);
export type StartMode = z.infer<typeof startModeSchema>;

export const jobs = [
  'build',
  'audit',
  'fix',
  'scenario',
  'date',
  'partner',
  'creative',
  'refresh',
  'rescue',
] as const;
export const jobSchema = z.enum(jobs);
export type Job = z.infer<typeof jobSchema>;

export const roles = ['owner', 'editor', 'viewer'] as const;
export const roleSchema = z.enum(roles);
export type Role = z.infer<typeof roleSchema>;
