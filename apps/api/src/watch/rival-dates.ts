import type { WatchEvidence } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import type { WebSearch } from '../llm/llm.js';
import { isIsoDay } from '../outputs/ics.js';
import { type FetchedPage, fetchPage, pageContains } from '../web/page-fetch.js';
import { parseDay } from './actuals-parse.js';

/** What a search for rivals may say about the launch: the kind of work and where, never its title. */
export interface RivalSearch {
  category: string;
  kind: string | null;
  genre: string | null;
  cities: string[];
  /** The plan's release date, `YYYY-MM-DD`. */
  release: string;
  today: string;
  /** Days either side of the release the search covers. */
  spanDays: number;
}

/** A rival whose title and date were both found on the page it cites, so the date is the page's own. */
export interface VerifiedRival {
  title: string;
  date: string;
  evidence: WatchEvidence;
}

export interface RivalFinder {
  /** False when there is nothing to search with: the check then says so and raises nothing. */
  readonly enabled: boolean;
  find(search: RivalSearch): Promise<{ rivals: VerifiedRival[]; tokens: number }>;
}

export const RIVAL_FINDER = Symbol('RIVAL_FINDER');

export class NoRivalFinder implements RivalFinder {
  readonly enabled = false;
  async find() {
    return { rivals: [], tokens: 0 };
  }
}

const MAX_RELEASES = 10;
const MAX_PAGES = 5;

const releasesSchema = z.object({
  releases: z
    .array(
      z.object({
        title: z.string().min(1),
        /** The opening date as `YYYY-MM-DD`. */
        isoDate: z.string(),
        /** The date exactly as the page writes it. */
        dateText: z.string().min(1),
        /** The number of the source in the list, from 1. */
        source: z.number().int().min(1),
      }),
    )
    .max(MAX_RELEASES),
});

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const rivalPrompt = (s: RivalSearch): string =>
  [
    `Find ${s.kind ?? s.category} releases${s.genre ? ` in the ${s.genre} genre` : ''} that open in ${s.cities.join(', ') || 'the main markets'} between ${addDays(s.release, -s.spanDays)} and ${addDays(s.release, s.spanDays)}.`,
    `Today is ${s.today}.`,
    'For each, give its title, the opening date exactly as a page writes it, and that page. Skip any release whose date no page states.',
  ].join('\n');

/**
 * Finds rival releases near a plan's date. The search sees only the kind of work, the genre, the
 * cities and a date range. A rival is kept only when the page it cites, fetched here, holds both its
 * title and the date as written there and the two agree: a date the page does not say is dropped,
 * however sure the model was.
 */
export class ModelRivalFinder implements RivalFinder {
  readonly enabled = true;

  constructor(
    private readonly search: WebSearch,
    private readonly extract: LanguageModel,
    private readonly timeoutMs: number,
    private readonly fetchPageImpl: (url: string) => Promise<FetchedPage | null> = fetchPage,
  ) {}

  async find(input: RivalSearch) {
    const found = await this.search({
      system:
        'You find release dates on web pages. Report only releases a page gives a date for. Never guess a date.',
      prompt: rivalPrompt(input),
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    const pages = [...new Map(found.sources.map((s) => [s.url, s])).values()].slice(0, MAX_PAGES);
    if (pages.length === 0 || !found.text.trim()) return { rivals: [], tokens: found.tokens };

    const { output, usage } = await generateText({
      model: this.extract,
      system:
        'From the research notes, list each release with its opening date and the number of the source that states it. Use only what the notes say.',
      prompt: [
        'Research notes:',
        found.text,
        '',
        'Sources:',
        ...pages.map((p, i) => `${i + 1}. ${p.title} (${p.url})`),
      ].join('\n'),
      output: Output.object({ schema: releasesSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });

    const fetched = new Map<number, FetchedPage | null>();
    const pageOf = async (n: number) => {
      if (!fetched.has(n)) {
        const page = pages[n - 1];
        fetched.set(n, page ? await this.fetchPageImpl(page.url) : null);
      }
      return fetched.get(n) ?? null;
    };
    const low = addDays(input.release, -input.spanDays);
    const high = addDays(input.release, input.spanDays);
    const rivals: VerifiedRival[] = [];
    for (const r of output.releases) {
      const page = await pageOf(r.source);
      if (!page || !isIsoDay(r.isoDate) || r.isoDate < low || r.isoDate > high) continue;
      if (parseDay(r.dateText) !== r.isoDate) continue;
      if (!pageContains(page, r.dateText) || !pageContains(page, r.title)) continue;
      rivals.push({
        title: r.title.trim(),
        date: r.isoDate,
        evidence: {
          url: page.url,
          title: pages[r.source - 1]?.title ?? page.url,
          retrievedAt: page.retrievedAt,
          quote: r.dateText,
        },
      });
    }
    return { rivals, tokens: found.tokens + (usage.totalTokens ?? 0) };
  }
}
