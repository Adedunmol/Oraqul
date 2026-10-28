import type { PartnerCheck } from '@oraqul/schema';
import { z } from 'zod';

/** What Wikidata says about each name. A name it cannot place is `unverified`, never a failure. */
export interface BrandChecker {
  check(names: string[]): Promise<Map<string, PartnerCheck>>;
}

const unverified: PartnerCheck = { state: 'unverified', note: null, country: null };

/** Used when no check is wanted: every name stays as Qloo gave it. */
export class NoBrandChecker implements BrandChecker {
  async check(names: string[]) {
    return new Map(names.map((n) => [n, unverified]));
  }
}

const API = 'https://www.wikidata.org/w/api.php';
// The first search hit is often something else (EE is a country, Chime a game), so a hit must read
// as a business and not as a person, place or work.
const BUSINESS =
  /(company|brand|bank|chain|operator|retailer|cinema|theat|supermarket|manufacturer|corporation|provider|startup|fintech|beverage|tea|coffee|dairy|noodle|brewer|beer|network|carrier|telecom|mobile|business)/i;
const NOT_BUSINESS =
  /(video game|novel|film|author|researcher|country|city|county|drug|album|song|band|politician|cinematographer|actor|actress|singer|footballer|writer|born)/i;

const searchSchema = z.object({
  search: z.array(z.object({ id: z.string(), description: z.string().optional() })).default([]),
});
const claimSchema = z.object({
  mainsnak: z.object({ datavalue: z.object({ value: z.unknown() }).optional() }),
});
const entitiesSchema = z.object({
  entities: z.record(
    z.string(),
    z.object({ claims: z.record(z.string(), z.array(claimSchema)).default({}) }),
  ),
});
const labelsSchema = z.object({
  entities: z.record(
    z.string(),
    z.object({ labels: z.object({ en: z.object({ value: z.string() }) }).partial() }),
  ),
});
const timeValue = z.object({ time: z.string() });
const idValue = z.object({ id: z.string() });

interface Cached {
  at: number;
  check: PartnerCheck;
}

export interface WikidataOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** How long an answer is kept in memory. A brand rarely changes, so weeks. */
  ttlMs?: number;
  /** Calls in flight at once, to stay a polite client. */
  concurrency?: number;
  now?: () => number;
  year?: () => number;
}

/**
 * Checks brand names against Wikidata (open data, CC0). It never throws: a timeout, a bad answer
 * or a name it cannot match is `unverified`, so a plan runs the same with the source down.
 */
export class WikidataBrandChecker implements BrandChecker {
  private readonly cache = new Map<string, Cached>();
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly ttlMs: number;
  private readonly concurrency: number;
  private readonly now: () => number;
  private readonly year: () => number;

  constructor(options: WikidataOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.ttlMs = options.ttlMs ?? 21 * 86_400_000;
    this.concurrency = options.concurrency ?? 3;
    this.now = options.now ?? Date.now;
    this.year = options.year ?? (() => new Date().getFullYear());
  }

  async check(names: string[]): Promise<Map<string, PartnerCheck>> {
    const out = new Map<string, PartnerCheck>();
    const queue = [...new Set(names)];
    const worker = async () => {
      for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
        out.set(name, await this.one(name));
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, queue.length) }, worker));
    return out;
  }

  private async one(name: string): Promise<PartnerCheck> {
    const key = name.trim().toLowerCase();
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.check;
    let check = unverified;
    try {
      check = await this.lookup(name);
    } catch {
      // Not cached: a source that was down should be asked again next time.
      return unverified;
    }
    this.cache.set(key, { at: this.now(), check });
    return check;
  }

  private async get<T extends z.ZodType>(
    params: Record<string, string>,
    shape: T,
  ): Promise<z.infer<T>> {
    const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
    const res = await this.fetchImpl(url, {
      headers: { 'User-Agent': 'Oraqul/0.1 (brand check; https://github.com/oraqul)' },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`Wikidata answered ${res.status}`);
    return shape.parse(await res.json());
  }

  private async lookup(name: string): Promise<PartnerCheck> {
    const found = await this.get(
      { action: 'wbsearchentities', search: name, language: 'en', limit: '7', type: 'item' },
      searchSchema,
    );
    const match = found.search.find(
      (h) => BUSINESS.test(h.description ?? '') && !NOT_BUSINESS.test(h.description ?? ''),
    );
    if (!match) return unverified;

    const body = await this.get(
      { action: 'wbgetentities', ids: match.id, props: 'claims' },
      entitiesSchema,
    );
    const claims = body.entities[match.id]?.claims ?? {};

    const closed = timeValue.safeParse(claims.P576?.[0]?.mainsnak.datavalue?.value);
    const year = closed.success ? Number(/^[+-]?(\d{4})/.exec(closed.data.time)?.[1]) : Number.NaN;
    if (Number.isFinite(year) && year <= this.year()) {
      return {
        state: 'problem',
        note: `No longer exists: it closed in ${year}.`,
        country: null,
      };
    }

    const place = idValue.safeParse((claims.P495 ?? claims.P17)?.[0]?.mainsnak.datavalue?.value);
    if (!place.success) return { state: 'verified', note: null, country: null };
    const labels = await this.get(
      { action: 'wbgetentities', ids: place.data.id, props: 'labels', languages: 'en' },
      labelsSchema,
    );
    const country = labels.entities[place.data.id]?.labels.en?.value;
    return { state: 'verified', note: null, country: country ?? null };
  }
}
