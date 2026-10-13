import { z } from 'zod';

// Values are from the Qloo Insights API docs (docs/backend/qloo.md). Not yet confirmed with our
// own key, see the status table there.

/** Entity types Insights can return. `locality` is only partly supported by Qloo. */
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
