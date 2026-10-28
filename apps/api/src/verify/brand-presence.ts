import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import type { WebSearch } from '../llm/llm.js';

/** Whether a source says a brand sells to people in a country. */
export interface BrandPresence {
  state: 'present' | 'absent' | 'unknown';
  source: { title: string; url: string } | null;
}

export const presenceKey = (name: string, country: string) =>
  `${name.trim().toLowerCase()}|${country.trim().toLowerCase()}`;

export interface PresenceChecker {
  /** Each brand with the country it was ranked for. Never throws: a failure is `unknown`. */
  check(items: { name: string; country: string }[]): Promise<Map<string, BrandPresence>>;
}

const unknown: BrandPresence = { state: 'unknown', source: null };

/** Used when there is no web search: every brand stays unchecked. */
export class NoPresenceChecker implements PresenceChecker {
  async check(items: { name: string; country: string }[]) {
    return new Map(items.map((i) => [presenceKey(i.name, i.country), unknown]));
  }
}

const factsSchema = z.object({
  brands: z.array(
    z.object({
      name: z.string(),
      operates: z.enum(['yes', 'no', 'unknown']),
      /** The 1 based number of the source the answer comes from, or null. */
      source: z.number().int().nullable(),
    }),
  ),
});

const SEARCH_SYSTEM = `You check whether named consumer brands sell their products or services to people in one country. Use the web. Prefer the brand's own site, a regulator, or a news page. For each brand say whether it operates in that country, naming the page you found. Say a brand does not operate there only when a page says so or shows it is limited to other countries. Say you found nothing when you found nothing. Write short plain notes.`;

const EXTRACT_SYSTEM = `You read research notes about whether brands operate in one country, and return one answer per brand. "yes" only when a source says the brand sells or operates there. "no" only when a source says it does not, or is limited to other countries. Otherwise "unknown". The source is the number of the page the answer comes from.`;

interface Cached {
  at: number;
  presence: BrandPresence;
}

/**
 * Asks the provider's web search whether each brand operates in the country it was ranked for. One
 * search per country, so a plan makes at most a few. A failure is `unknown` and never stops a plan.
 */
export class WebPresenceChecker implements PresenceChecker {
  private readonly cache = new Map<string, Cached>();

  constructor(
    private readonly search: WebSearch,
    private readonly extract: LanguageModel,
    private readonly timeoutMs: number,
    private readonly ttlMs = 21 * 86_400_000,
    private readonly now: () => number = Date.now,
  ) {}

  async check(items: { name: string; country: string }[]) {
    const out = new Map<string, BrandPresence>();
    const wanted = new Map<string, Set<string>>();
    for (const { name, country } of items) {
      const key = presenceKey(name, country);
      const hit = this.cache.get(key);
      if (hit && this.now() - hit.at < this.ttlMs) {
        out.set(key, hit.presence);
        continue;
      }
      wanted.set(country, (wanted.get(country) ?? new Set()).add(name));
    }
    await Promise.all(
      [...wanted].map(async ([country, names]) => {
        const found = await this.one(country, [...names]).catch(() => null);
        for (const name of names) {
          const key = presenceKey(name, country);
          const presence = found?.get(name.trim().toLowerCase()) ?? unknown;
          out.set(key, presence);
          // A failed search is asked again next time.
          if (found) this.cache.set(key, { at: this.now(), presence });
        }
      }),
    );
    return out;
  }

  private async one(country: string, names: string[]): Promise<Map<string, BrandPresence>> {
    const found = await this.search({
      system: SEARCH_SYSTEM,
      prompt: `Country: ${country}\nBrands: ${names.join('; ')}\nFor each brand: does it sell to people in ${country}? Name the page.`,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    const pages = [...new Map(found.sources.map((s) => [s.url, s])).values()];
    const result = new Map<string, BrandPresence>();
    if (pages.length === 0 || !found.text.trim()) return result;
    const { output } = await generateText({
      model: this.extract,
      system: EXTRACT_SYSTEM,
      prompt: [
        `Country: ${country}`,
        `Brands: ${names.join('; ')}`,
        '',
        'Research notes:',
        found.text,
        '',
        'Sources:',
        ...pages.map((p, i) => `${i + 1}. ${p.title} (${p.url})`),
      ].join('\n'),
      output: Output.object({ schema: factsSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    for (const b of output.brands) {
      const page = b.source !== null ? pages[b.source - 1] : undefined;
      const state = b.operates === 'yes' ? 'present' : b.operates === 'no' ? 'absent' : 'unknown';
      // A yes or no with no page behind it is not a finding.
      result.set(b.name.trim().toLowerCase(), {
        state: page ? state : 'unknown',
        source: page ? { title: page.title, url: page.url } : null,
      });
    }
    return result;
  }
}
