import type {
  BiasLevel,
  ContentRating,
  DiversifyBy,
  ExternalExistsKey,
  Gender,
  InsightsSortBy,
  SetOperator,
  SignalAgeBand,
  Weekday,
  Weight,
} from '../urns';

// Parameter sets per `filter.type`, from the Entity Type Parameter Guide. Names are Qloo's own.
// Qloo silently ignores a parameter a type does not support, so each type only offers its own.
// Write these as `type`, not `interface`: they must be assignable to `QlooParams`.

type Paging = { take?: number; page?: number; offset?: number };

/** What the results should be close to. Entities, tags and demographics. */
export type SignalParams = {
  'signal.interests.entities'?: string[];
  'signal.interests.tags'?: string[];
  'signal.demographics.age'?: SignalAgeBand[];
  'signal.demographics.gender'?: Gender;
};

/**
 * In the Parameter Reference or the OpenAPI definition, but not in the Entity Type Parameter
 * Guide's table, and not yet tried against the live API. Qloo ignores a parameter it does not
 * support without an error, so none of these is known to work. TODO(verify) with `qloo:smoke`.
 */
export type UnconfirmedParams = {
  'signal.interests.tags.weight'?: Weight;
  'operator.signal.interests.tags'?: SetOperator;
  'signal.demographics.age.weight'?: Weight;
  'signal.demographics.gender.weight'?: Weight;
  /** A WKT shape or a locality id. Longitude comes first in WKT. */
  'signal.location'?: string;
  'signal.location.weight'?: Weight;
  'bias.content_based'?: number;
  'backfill.cross_domain.take'?: number;
  'backfill.content_based.take'?: number;
  'filter.exists'?: ('properties.image' | 'properties.description')[];
};

/** Shared by every `urn:entity:*` type except locality. */
export type EntityBaseParams = SignalParams &
  UnconfirmedParams &
  Paging & {
    // Verified for movie, tv_show, artist, book, podcast and videogame:
    /** A place name such as `Lagos`. Changes the ranking. */
    'signal.location.query'?: string;
    /** Changes the ranking when mixed with another signal. */
    'signal.interests.entities.weight'?: Weight;
    /** Adds `query.explainability` to each result. */
    'feature.explainability'?: boolean;
    'bias.trends'?: BiasLevel;
    /** 0 to 1. Closer to 1 is more popular. */
    'filter.popularity.min'?: number;
    'filter.popularity.max'?: number;
    'filter.tags'?: string[];
    'operator.filter.tags'?: SetOperator;
    'filter.exclude.tags'?: string[];
    // TODO(verify): the OpenAPI definition calls this `operator.filter.exclude.tags`.
    'operator.exclude.tags'?: SetOperator;
    'filter.exclude.entities'?: string[];
    /** Rank only these entities. Used to score named candidates against a signal. */
    'filter.results.entities'?: string[];
    'filter.results.entities.query'?: string;
    'filter.external.exists'?: ExternalExistsKey[];
    'operator.filter.external.exists'?: SetOperator;
    /** Audience parent types, or entity types for tags. */
    'filter.parents.types'?: string[];
  };

type FilmFilters = {
  'filter.content_rating'?: ContentRating[];
  'filter.release_year.min'?: number;
  'filter.release_year.max'?: number;
  // TODO(verify): in the OpenAPI definition only.
  'filter.release_date.min'?: string;
  'filter.release_date.max'?: string;
  /** Countries the title was first released in. */
  'filter.release_country'?: string[];
  'operator.filter.release_country'?: SetOperator;
  /** Qloo rating, 0 to 5. */
  'filter.rating.min'?: number;
  'filter.rating.max'?: number;
};

type LocationFilters = {
  /** `latitude,longitude`, a WKT shape, or a locality id. */
  'filter.location'?: string;
  'filter.location.query'?: string;
  /** Metres, up to 800 000. */
  'filter.location.radius'?: number;
  'filter.location.geohash'?: string;
  'filter.exclude.location.geohash'?: string;
  'filter.geocode.name'?: string;
  'filter.geocode.admin1_region'?: string;
  'filter.geocode.admin2_region'?: string;
  /** Two letters. */
  'filter.geocode.country_code'?: string;
};

export type MovieInsights = EntityBaseParams & FilmFilters & { 'filter.type': 'urn:entity:movie' };

export type TvShowInsights = EntityBaseParams &
  FilmFilters & {
    'filter.type': 'urn:entity:tv_show';
    'filter.finale_year.min'?: number;
    'filter.finale_year.max'?: number;
    'filter.latest_known_year.min'?: number;
    'filter.latest_known_year.max'?: number;
  };

export type ArtistInsights = EntityBaseParams & { 'filter.type': 'urn:entity:artist' };

export type BookInsights = EntityBaseParams & {
  'filter.type': 'urn:entity:book';
  'filter.publication_year.min'?: number;
  'filter.publication_year.max'?: number;
};

export type PodcastInsights = EntityBaseParams & { 'filter.type': 'urn:entity:podcast' };

export type VideogameInsights = EntityBaseParams & { 'filter.type': 'urn:entity:videogame' };

export type BrandInsights = EntityBaseParams & { 'filter.type': 'urn:entity:brand' };

export type PersonInsights = EntityBaseParams & {
  'filter.type': 'urn:entity:person';
  'filter.gender'?: string;
  /** `YYYY-MM-DD`. */
  'filter.date_of_birth.min'?: string;
  'filter.date_of_birth.max'?: string;
  'filter.date_of_death.min'?: string;
  'filter.date_of_death.max'?: string;
};

export type DestinationInsights = EntityBaseParams &
  LocationFilters & {
    'filter.type': 'urn:entity:destination';
    /** Required for destinations. */
    'signal.interests.entities': string[];
  };

export type PlaceInsights = EntityBaseParams &
  LocationFilters & {
    'filter.type': 'urn:entity:place';
    sort_by?: InsightsSortBy;
    /** Biases ranking by quality. Places without a quality score are dropped. */
    'bias.quality'?: Weight;
    'diversify.by'?: Exclude<DiversifyBy, 'subtype'>;
    'diversify.take'?: number;
    'filter.address'?: string;
    'filter.hours'?: Weekday;
    'filter.price_level.min'?: number;
    'filter.price_level.max'?: number;
    'filter.price_range.from'?: number;
    'filter.price_range.to'?: number;
    'filter.hotel_class.min'?: number;
    'filter.hotel_class.max'?: number;
    'filter.properties.business_rating.min'?: number;
    'filter.properties.business_rating.max'?: number;
    'filter.references_brand'?: string[];
    'operator.filter.references_brand'?: SetOperator;
    // TODO(verify): the Entity Type Parameter Guide spells the Resy names differently.
    'filter.external.resy.rating.min'?: number;
    'filter.external.resy.rating.max'?: number;
    'filter.external.resy.count.min'?: number;
    'filter.external.resy.count.max'?: number;
    'filter.external.resy.party_size.min'?: number;
    'filter.external.resy.party_size.max'?: number;
    'filter.external.tripadvisor.rating.min'?: number;
    'filter.external.tripadvisor.rating.max'?: number;
    'filter.external.tripadvisor.rating.count.min'?: number;
    'filter.external.tripadvisor.rating.count.max'?: number;
  };

/** Partly supported by Qloo: only with entity signals that are themselves localities. */
export type LocalityInsights = Paging & {
  'filter.type': 'urn:entity:locality';
  'signal.interests.entities': string[];
};

/** Entity types a request can be made for, keyed by `filter.type`. */
export type EntityInsightsRequest =
  | MovieInsights
  | TvShowInsights
  | ArtistInsights
  | BookInsights
  | PodcastInsights
  | VideogameInsights
  | BrandInsights
  | PersonInsights
  | DestinationInsights
  | PlaceInsights
  | LocalityInsights;
