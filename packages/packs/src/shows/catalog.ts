import type { LaunchModuleKey, LaunchSectionKey } from '@oraqul/schema';
import type { ShowType } from '../rules/shows';

// The Live shows query catalog (spec §4.6). The model picks from these and fills in their context;
// code runs them, within the call budget, and turns each result into a finding. Qloo holds no
// ticket prices, venue capacity or event calendars: the team supplies those, and a missing one
// shows as "not available".
// Checked live 2026-10-23 (docs/backend/qloo.md): concert acts resolve as artists, comedians as
// people, and a stage play only as a film or a cast album. Venue lists are good in London and New
// York and thin or empty in Lagos and Accra for comedy clubs, theatres and concert halls.

export const showsQueryKeys = [
  'audience',
  'markets',
  'similar',
  'brands',
  'podcasts',
  'venues',
] as const;
export type ShowsQueryKey = (typeof showsQueryKeys)[number];

export interface ShowsQuerySpec {
  key: ShowsQueryKey;
  /** `core` queries run for every plan; the others only when their module is in it. */
  for: 'core' | LaunchModuleKey;
  /** Sections whose lines usually cite it. Any line may cite any finding. */
  feeds: LaunchSectionKey[];
  /** For the chat trace, as "Asking Qloo about …". */
  label: string;
}

export const SHOWS_QUERIES: Record<ShowsQueryKey, ShowsQuerySpec> = {
  audience: {
    key: 'audience',
    for: 'core',
    feeds: ['audience', 'bottom-line'],
    label: "the act's audience by age and gender",
  },
  markets: {
    key: 'markets',
    for: 'core',
    feeds: ['markets', 'bottom-line'],
    label: 'where in your cities that audience is strongest',
  },
  similar: {
    key: 'similar',
    for: 'publicity',
    feeds: ['publicity', 'audience'],
    label: 'the artists that audience plays in each city',
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
  venues: {
    key: 'venues',
    for: 'venues',
    feeds: ['venues', 'partnerships'],
    label: 'the venues where that audience goes out',
  },
};

/** Tag namespaces each query's phrases must resolve into, and the parent type for brands. */
export const TAG_SPACES = {
  similar: { prefix: 'urn:tag:genre:music', parent: null },
  podcasts: { prefix: 'urn:tag:genre:media', parent: null },
  brands: { prefix: 'urn:tag:genre:brand', parent: 'urn:entity:brand' },
  venues: { prefix: 'urn:tag:category:place', parent: null },
} as const;

/**
 * Place categories asked for each kind of show. Only the first two phrases are resolved. A
 * category that lists nothing in a city shows as a gap, never a guess.
 */
export const SHOWS_VENUE_PLACES: Record<ShowType, string[]> = {
  concert: ['concert hall', 'night club'],
  club: ['night club'],
  comedy: ['comedy club'],
  theatre: ['theater'],
  screening: ['movie theater'],
};
