import { z } from 'zod';

/** What OpenStreetMap says about a venue. A venue it cannot place is `unverified`, never dropped. */
export type VenueCheck = { state: 'verified' | 'unverified' | 'problem'; kind: string | null };

export interface VenueChecker {
  /** `items` are looked up one by one; the answer is keyed by `venueKey`. */
  check(items: { name: string; city: string }[]): Promise<Map<string, VenueCheck>>;
}

export const venueKey = (v: { name: string; city: string }) =>
  `${v.name.trim().toLowerCase()}|${v.city.trim().toLowerCase()}`;

const unverified: VenueCheck = { state: 'unverified', kind: null };

export class NoVenueChecker implements VenueChecker {
  async check(items: { name: string; city: string }[]) {
    return new Map(items.map((v) => [venueKey(v), unverified]));
  }
}

const hitSchema = z.array(
  z.object({ class: z.string(), type: z.string(), display_name: z.string().optional() }),
);

// Stage and civic places that are not somewhere a film opens. A cinema is `amenity=cinema`.
const NOT_A_SCREEN = new Set(['theatre', 'arts_centre', 'community_centre', 'place_of_worship']);
const SCREEN_WORDS = /\b(cinemas?|film|movies?|screens?|picturehouse|odeon|imax|cineplex)\b/i;

export interface NominatimOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  ttlMs?: number;
  /** Nominatim allows one request a second, from one client. */
  gapMs?: number;
  /** The most places looked up in one call, so a plan does not wait on a long list. */
  maxLookups?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Checks that a place named for a cinema list is a screen and not a stage theatre or a community
 * hall. Only a clear mismatch is a problem: a place it cannot find, or finds as something else,
 * stays as it is, because OpenStreetMap is missing many venues.
 */
export class NominatimVenueChecker implements VenueChecker {
  private readonly cache = new Map<string, { at: number; check: VenueCheck }>();
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly ttlMs: number;
  private readonly gapMs: number;
  private readonly maxLookups: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: NominatimOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 6000;
    this.ttlMs = options.ttlMs ?? 21 * 86_400_000;
    this.gapMs = options.gapMs ?? 1100;
    this.maxLookups = options.maxLookups ?? 16;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async check(items: { name: string; city: string }[]): Promise<Map<string, VenueCheck>> {
    const out = new Map<string, VenueCheck>();
    let asked = 0;
    for (const item of items) {
      const key = venueKey(item);
      if (out.has(key)) continue;
      const hit = this.cache.get(key);
      if (hit && this.now() - hit.at < this.ttlMs) {
        out.set(key, hit.check);
        continue;
      }
      if (asked >= this.maxLookups) {
        out.set(key, unverified);
        continue;
      }
      if (asked > 0) await this.sleep(this.gapMs);
      asked += 1;
      try {
        const check = await this.lookup(item);
        this.cache.set(key, { at: this.now(), check });
        out.set(key, check);
      } catch {
        // Not cached: a source that was down should be asked again next time.
        out.set(key, unverified);
      }
    }
    return out;
  }

  private async lookup(item: { name: string; city: string }): Promise<VenueCheck> {
    const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
      format: 'json',
      limit: '1',
      q: `${item.name} ${item.city}`,
    })}`;
    const res = await this.fetchImpl(url, {
      headers: { 'User-Agent': 'Oraqul/0.1 (venue check; https://github.com/oraqul)' },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`Nominatim answered ${res.status}`);
    const [hit] = hitSchema.parse(await res.json());
    if (!hit) return unverified;
    // The first word that is not a filler has to appear in what was found, or it is another place.
    const word = item.name
      .toLowerCase()
      .split(/\W+/)
      .find((w) => w.length > 3 && !['the', 'cinema', 'cinemas', 'theatre', 'theater'].includes(w));
    if (word && !(hit.display_name ?? '').toLowerCase().includes(word)) return unverified;
    if (hit.class === 'amenity' && hit.type === 'cinema') {
      return { state: 'verified', kind: 'cinema' };
    }
    if (hit.class === 'amenity' && NOT_A_SCREEN.has(hit.type) && !SCREEN_WORDS.test(item.name)) {
      return { state: 'problem', kind: hit.type.replace('_', ' ') };
    }
    return unverified;
  }
}
