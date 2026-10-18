import type { LaunchModuleKey, LaunchSectionKey } from '@oraqul/schema';

// The Music query catalog (spec §4.2). The model picks from these and fills in their context; code
// runs them, within the call budget, and turns each result into a finding.
// TODO(verify): artist signals on the live host for support, shows and films, with
// `qloo-music-probes.ts`. Until docs/backend/qloo.md says so, none of these is verified for Music.

export const musicQueryKeys = [
  'audience',
  'markets',
  'support',
  'brands',
  'podcasts',
  'shows',
  'films',
  'areas',
  'community',
] as const;
export type MusicQueryKey = (typeof musicQueryKeys)[number];

export interface MusicQuerySpec {
  key: MusicQueryKey;
  /** `core` queries run for every plan; the others only when their module is in it. */
  for: 'core' | LaunchModuleKey;
  /** Sections whose lines usually cite it. Any line may cite any finding. */
  feeds: LaunchSectionKey[];
  /** For the chat trace, as "Asking Qloo about …". */
  label: string;
}

export const MUSIC_QUERIES: Record<MusicQueryKey, MusicQuerySpec> = {
  audience: {
    key: 'audience',
    for: 'core',
    feeds: ['audience', 'bottom-line'],
    label: "the artist's audience by age and gender",
  },
  markets: {
    key: 'markets',
    for: 'core',
    feeds: ['markets', 'tour', 'bottom-line'],
    label: 'where in your cities that audience is strongest',
  },
  support: {
    key: 'support',
    for: 'support',
    feeds: ['support', 'audience'],
    label: 'the artists that audience plays in each tour city',
  },
  brands: {
    key: 'brands',
    for: 'partnerships',
    feeds: ['partnerships'],
    label: 'the brands that audience uses',
  },
  podcasts: {
    key: 'podcasts',
    for: 'publicity',
    feeds: ['publicity'],
    label: 'the podcasts that audience hears',
  },
  shows: {
    key: 'shows',
    for: 'sync',
    feeds: ['sync', 'audience'],
    label: 'the series that audience watches in each city',
  },
  films: {
    key: 'films',
    for: 'sync',
    feeds: ['sync'],
    label: 'the recent films that audience watched',
  },
  areas: {
    key: 'areas',
    for: 'community',
    feeds: ['community', 'markets'],
    label: 'which neighbourhoods in each city that audience is strongest in',
  },
  community: {
    key: 'community',
    for: 'community',
    feeds: ['community'],
    label: 'the campuses where that audience gathers',
  },
};

/** Tag namespaces each query's phrases must resolve into, and the parent type for brands. */
export const TAG_SPACES = {
  support: { prefix: 'urn:tag:genre:music', parent: null },
  podcasts: { prefix: 'urn:tag:genre:media', parent: null },
  films: { prefix: 'urn:tag:genre:media', parent: null },
  brands: { prefix: 'urn:tag:genre:brand', parent: 'urn:entity:brand' },
  community: { prefix: 'urn:tag:category:place', parent: null },
} as const;

/** Universities are where a music audience gathers that Qloo can place. No churches or venues. */
export const MUSIC_COMMUNITY_PLACES = ['university'];

/** How far back "recent" reaches for series and films, in years before the current one. */
export const RECENT_FILMS = 3;
export const RECENT_SHOWS = 6;
