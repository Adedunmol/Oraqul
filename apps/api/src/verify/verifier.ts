import type { PartnerCheck } from '@oraqul/schema';
import { type BrandChecker, NoBrandChecker, WikidataBrandChecker } from './brand-check.js';
import { type BrandPresence, NoPresenceChecker, type PresenceChecker } from './brand-presence.js';
import {
  NominatimVenueChecker,
  NoVenueChecker,
  type VenueCheck,
  type VenueChecker,
} from './venue-check.js';

/** The checks a plan runs against open data after Qloo has answered and before it is written. */
export interface Verifier {
  brands(names: string[]): Promise<Map<string, PartnerCheck>>;
  venues(items: { name: string; city: string }[]): Promise<Map<string, VenueCheck>>;
  /** Whether a source says each brand sells in the country it was ranked for. */
  presence(items: { name: string; country: string }[]): Promise<Map<string, BrandPresence>>;
}

export class OutsideVerifier implements Verifier {
  constructor(
    private readonly brandChecker: BrandChecker,
    private readonly venueChecker: VenueChecker,
    private readonly presenceChecker: PresenceChecker = new NoPresenceChecker(),
  ) {}
  brands(names: string[]) {
    return this.brandChecker.check(names);
  }
  venues(items: { name: string; city: string }[]) {
    return this.venueChecker.check(items);
  }
  presence(items: { name: string; country: string }[]) {
    return this.presenceChecker.check(items);
  }
}

/** Wikidata for brands and OpenStreetMap for venues. */
export const openDataVerifier = (presence?: PresenceChecker): Verifier =>
  new OutsideVerifier(new WikidataBrandChecker(), new NominatimVenueChecker(), presence);

/** Nothing is checked: every name stays as Qloo gave it. */
export const noVerifier = (): Verifier =>
  new OutsideVerifier(new NoBrandChecker(), new NoVenueChecker());
