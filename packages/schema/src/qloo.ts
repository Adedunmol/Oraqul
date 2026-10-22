import { z } from 'zod';

// Values are from the Qloo Insights API docs. Which ones are confirmed against the live API is in
// the status table in docs/backend/qloo.md.

/** Entity types Insights can return. `destination` and `locality` are not used by any category yet, and `locality` is only partly supported by Qloo. */
export const qlooEntityTypes = [
  'urn:entity:artist',
  'urn:entity:book',
  'urn:entity:brand',
  'urn:entity:destination',
  'urn:entity:locality',
  'urn:entity:movie',
  'urn:entity:person',
  'urn:entity:place',
  'urn:entity:podcast',
  'urn:entity:tv_show',
  'urn:entity:videogame',
] as const;
export const qlooEntityTypeSchema = z.enum(qlooEntityTypes);
export type QlooEntityType = z.infer<typeof qlooEntityTypeSchema>;

/** What each category pack asks Qloo about. Titles are the category's own work. */
export const qlooCoverageSchema = z.object({
  titles: z.array(qlooEntityTypeSchema).min(1),
  talent: z.array(qlooEntityTypeSchema),
  partners: z.array(qlooEntityTypeSchema),
  places: z.array(qlooEntityTypeSchema),
});
export type QlooCoverage = z.infer<typeof qlooCoverageSchema>;
