import { z } from 'zod';

export const categories = ['film', 'music', 'books', 'podcasts', 'games'] as const;
export const categorySchema = z.enum(categories);
export type Category = z.infer<typeof categorySchema>;

export const jobs = ['plan', 'audit', 'rescue', 'scenario', 'date', 'partner'] as const;
export const jobSchema = z.enum(jobs);
export type Job = z.infer<typeof jobSchema>;

export const roles = ['owner', 'editor', 'viewer'] as const;
export const roleSchema = z.enum(roles);
export type Role = z.infer<typeof roleSchema>;
