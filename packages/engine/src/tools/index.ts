import type { ToolName } from '@oraqul/schema';
import { audienceBySegment, audienceOutputSchema } from './audience-by-segment';
import { bookProfiles, bookProfilesOutputSchema } from './book-profiles';
import { findTaste, findTasteOutputSchema } from './find-taste';
import { gameProfiles, gameProfilesOutputSchema } from './game-profiles';
import { lift, liftOutputSchema } from './lift';
import { partnerFit, partnerFitOutputSchema } from './partner-fit';
import { rankPlaces, rankPlacesOutputSchema } from './rank-places';
import { resolveBundle, resolveBundleOutputSchema } from './resolve-bundle';
import { resolveTags, resolveTagsOutputSchema } from './resolve-tags';
import { scoreRivals, scoreRivalsOutputSchema } from './score-rivals';
import { searchEntity, searchEntityOutputSchema } from './search-entity';
import { themeTags, themeTagsOutputSchema } from './theme-tags';
import type { Tool } from './tool';
import { topicMap, topicMapOutputSchema, topicOwnership } from './topic-map';

export { seriesOf } from './book-profiles';
export { type TasteType, tasteTypes } from './find-taste';
export { gameTagKinds } from './game-profiles';
export { normalizeTitle } from './resolve-bundle';
export { type RivalType, rivalTypeOf, rivalTypes } from './score-rivals';
export { themeTagTypes } from './theme-tags';
export type { SeenEntity, Tool, ToolContext, ToolData } from './tool';
export { topicOwnership };

export const tools: Record<ToolName, Tool> = {
  searchEntity,
  audienceBySegment,
  resolveBundle,
  rankPlaces,
  lift,
  partnerFit,
  scoreRivals,
  findTaste,
  resolveTags,
  themeTags,
  gameProfiles,
  bookProfiles,
  topicMap,
};

export {
  audienceOutputSchema,
  bookProfilesOutputSchema,
  findTasteOutputSchema,
  gameProfilesOutputSchema,
  liftOutputSchema,
  partnerFitOutputSchema,
  rankPlacesOutputSchema,
  resolveBundleOutputSchema,
  resolveTagsOutputSchema,
  scoreRivalsOutputSchema,
  searchEntityOutputSchema,
  themeTagsOutputSchema,
  topicMapOutputSchema,
};
