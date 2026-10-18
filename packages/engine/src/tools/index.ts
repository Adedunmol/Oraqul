import type { ToolName } from '@oraqul/schema';
import { audienceBySegment, audienceOutputSchema } from './audience-by-segment';
import { compareAudiences, compareAudiencesOutputSchema } from './compare-audiences';
import { findTaste, findTasteOutputSchema } from './find-taste';
import { lift, liftOutputSchema } from './lift';
import { partnerFit, partnerFitOutputSchema } from './partner-fit';
import { rankPlaces, rankPlacesOutputSchema } from './rank-places';
import { resolveBundle, resolveBundleOutputSchema } from './resolve-bundle';
import { resolveTags, resolveTagsOutputSchema } from './resolve-tags';
import { searchEntity, searchEntityOutputSchema } from './search-entity';
import { themeTags, themeTagsOutputSchema } from './theme-tags';
import type { Tool } from './tool';

export { type TasteType, tasteTypes } from './find-taste';
export { normalizeTitle } from './resolve-bundle';
export { themeTagTypes } from './theme-tags';
export type { SeenEntity, Tool, ToolContext, ToolData } from './tool';

export const tools: Record<ToolName, Tool> = {
  searchEntity,
  audienceBySegment,
  resolveBundle,
  rankPlaces,
  lift,
  partnerFit,
  compareAudiences,
  findTaste,
  resolveTags,
  themeTags,
};

export {
  audienceOutputSchema,
  compareAudiencesOutputSchema,
  findTasteOutputSchema,
  liftOutputSchema,
  partnerFitOutputSchema,
  rankPlacesOutputSchema,
  resolveBundleOutputSchema,
  resolveTagsOutputSchema,
  searchEntityOutputSchema,
  themeTagsOutputSchema,
};
