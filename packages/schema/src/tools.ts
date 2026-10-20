import { z } from 'zod';

// Lives in schema so packs can type their allowlist and engine can key its registry by it.
export const toolNames = [
  'searchEntity',
  'audienceBySegment',
  'resolveBundle',
  'rankPlaces',
  'lift',
  'partnerFit',
  'compareAudiences',
  'findTaste',
  'resolveTags',
  'themeTags',
  'gameProfiles',
] as const;
export const toolNameSchema = z.enum(toolNames);
export type ToolName = z.infer<typeof toolNameSchema>;
