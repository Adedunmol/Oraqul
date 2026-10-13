// Fixed vocabularies from the Qloo docs (docs/backend/qloo.md). Entity types are in
// `@oraqul/schema` because packs need them too.

/** The six bands Qloo returns in demographics rows. */
export const ageBands = [
  '24_and_younger',
  '25_to_29',
  '30_to_34',
  '35_to_44',
  '45_to_54',
  '55_and_older',
] as const;
export type AgeBand = (typeof ageBands)[number];

/** Bands accepted as a signal: the six above plus two coarse ones. */
export const signalAgeBands = [...ageBands, '35_and_younger', '36_to_55'] as const;
export type SignalAgeBand = (typeof signalAgeBands)[number];

export const genders = ['male', 'female'] as const;
export type Gender = (typeof genders)[number];

/** Qloo takes a number or one of these words wherever a signal has a weight. */
export const weightLevels = ['very_low', 'low', 'mid', 'medium', 'high', 'very_high'] as const;
export type WeightLevel = (typeof weightLevels)[number];
export type Weight = number | WeightLevel;

export const biasLevels = ['off', ...weightLevels] as const;
export type BiasLevel = (typeof biasLevels)[number];

export const setOperators = ['union', 'intersection'] as const;
export type SetOperator = (typeof setOperators)[number];

export const audienceParentTypes = [
  'urn:audience:communities',
  'urn:audience:global_issues',
  'urn:audience:hobbies_and_interests',
  'urn:audience:investing_interests',
  'urn:audience:leisure',
  'urn:audience:life_stage',
  'urn:audience:lifestyle_preferences_beliefs',
  'urn:audience:political_preferences',
  'urn:audience:professional_area',
  'urn:audience:spending_habits',
] as const;
export type AudienceParentType = (typeof audienceParentTypes)[number];

export const contentRatings = [
  'G',
  'PG',
  'PG-13',
  'R',
  'NC-17',
  'TV-G',
  'TV-PG',
  'TV-14',
  'TV-MA',
  'TV-Y',
  'TV-Y7',
  'TV-Y7-FV',
  'Not Rated',
  'Unrated',
  'Approved',
  'Passed',
  'X',
  'GP',
  'M',
  '13+',
  '16+',
  '18+',
] as const;
export type ContentRating = (typeof contentRatings)[number];

/** Ids Qloo can look up an entity by (`/entities`, `external.<source>.ids`). */
export const externalIdSources = [
  'facebook',
  'goodreads',
  'goodreads_author',
  'igdb',
  'imdb',
  'instagram',
  'isbn10',
  'isbn13',
  'itunes',
  'lastfm',
  'library_of_congress',
  'metacritic',
  'michelin',
  'musicbrainz',
  'resy',
  'rottentomatoes',
  'soundcloud',
  'spotify',
  'tablet',
  'twitch',
  'twitter',
  'wikidata',
] as const;
export type ExternalIdSource = (typeof externalIdSources)[number];

/** Keys for `filter.external.exists`. */
export const externalExistsKeys = ['resy', 'michelin', 'tablet'] as const;
export type ExternalExistsKey = (typeof externalExistsKeys)[number];

export const weekdays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type Weekday = (typeof weekdays)[number];

/** `sort_by` on `/v2/insights`. `quality` is for places only. */
export type InsightsSortBy = 'affinity' | 'distance' | 'rating' | 'quality';
/** `sort_by` on `/search`. */
export type SearchSortBy = 'match' | 'distance' | 'popularity';

/** `diversify.by` on `/v2/insights`. `subtype` is for `urn:tag` only. */
export type DiversifyBy = 'properties.geocode.city' | 'properties.geocode.metro' | 'subtype';

/** Heatmap output: `urn:geohash` returns grid cells, `urn:entity:locality` returns named places. */
export type HeatmapBoundary = 'urn:geohash' | 'urn:entity:locality';
export type HeatmapDimension = 'quality' | 'popularity' | 'hotel_class' | 'price_level';

export type CompareModel = 'descriptive' | 'predictive';
export type CompareSubtype = 'urn:tag:genre' | 'urn:tag:occupation';
