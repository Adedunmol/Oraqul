import type { PartnerCheck } from '@oraqul/schema';
import { type BrandChecker, NoBrandChecker, WikidataBrandChecker } from './brand-check.js';
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
}

export class OutsideVerifier implements Verifier {
  constructor(
    private readonly brandChecker: BrandChecker,
    private readonly venueChecker: VenueChecker,
  ) {}
  brands(names: string[]) {
    return this.brandChecker.check(names);
  }
  venues(items: { name: string; city: string }[]) {
    return this.venueChecker.check(items);
  }
}

/** Wikidata for brands and OpenStreetMap for venues. */
export const openDataVerifier = (): Verifier =>
  new OutsideVerifier(new WikidataBrandChecker(), new NominatimVenueChecker());

/** Nothing is checked: every name stays as Qloo gave it. */
export const noVerifier = (): Verifier =>
  new OutsideVerifier(new NoBrandChecker(), new NoVenueChecker());
