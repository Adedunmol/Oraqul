import {
  criterionFields,
  type FundCriterion,
  fundTypeSchema,
  type ProjectStage,
} from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import type { WebSearch } from '../llm/llm.js';
import { parseDay } from '../watch/actuals-parse.js';
import { type FetchedPage, fetchPage, pageContains } from '../web/page-fetch.js';

// Funds and sponsorship evidence from the web, at run time. Nothing is seeded or hand kept: a fund
// exists here only because a page said so. The search sees only the kind of work, the stage, who is
// making it and the places, never the title. A model reads the results, and code then fetches each
// cited page and keeps a field only if the page holds the words. A result whose page does not hold
// the claimed deadline or amount is dropped whole.

export interface FundSearch {
  category: string;
  stage: ProjectStage | null;
  nationality: string | null;
  territories: string[];
  /** `YYYY-MM-DD` */
  today: string;
}

export interface VerifiedFund {
  name: string;
  owner: string | null;
  type: z.infer<typeof fundTypeSchema>;
  /** As the page writes it. */
  amount: string | null;
  currency: string | null;
  /** `YYYY-MM-DD`, from words the page holds. */
  deadline: string | null;
  criteria: FundCriterion[];
  /** True when something the model reported could not be found on the page, or the page lists more. */
  otherConditions: boolean;
  applicationUrl: string | null;
  sourceUrl: string;
  sourceTitle: string;
  retrievedAt: string;
}

export interface SponsorSearch {
  brand: string;
  category: string;
  territory: string;
  today: string;
}

export interface VerifiedEvidence {
  url: string;
  title: string;
  retrievedAt: string;
  quote: string;
}

export interface FundingResearcher {
  /** False when there is nothing to search with: nothing is looked up and the page says so. */
  readonly enabled: boolean;
  funds(search: FundSearch): Promise<{ funds: VerifiedFund[]; tokens: number }>;
  evidence(search: SponsorSearch): Promise<{ evidence: VerifiedEvidence | null; tokens: number }>;
}

export const FUNDING_RESEARCHER = Symbol('FUNDING_RESEARCHER');

export class NoFundingResearch implements FundingResearcher {
  readonly enabled = false;
  async funds() {
    return { funds: [], tokens: 0 };
  }
  async evidence() {
    return { evidence: null, tokens: 0 };
  }
}

const MAX_FUNDS = 8;
const MAX_PAGES = 8;

const fundsSchema = z.object({
  funds: z
    .array(
      z.object({
        name: z.string().min(1),
        owner: z.string().nullable(),
        type: fundTypeSchema,
        /** The amount exactly as the page writes it, or null when it gives none. */
        amountText: z.string().nullable(),
        /** The closing date exactly as the page writes it, or null when it gives none. */
        deadlineText: z.string().nullable(),
        deadlineIso: z.string().nullable(),
        applicationUrl: z.string().nullable(),
        /** True when the page lists conditions beyond the criteria given here. */
        otherConditions: z.boolean(),
        criteria: z
          .array(
            z.object({
              field: z.enum(criterionFields),
              value: z.string().nullable(),
              /** The criterion exactly as the page words it. */
              quote: z.string().min(1),
            }),
          )
          .max(12),
        /** The number of the source in the list, from 1. */
        source: z.number().int().min(1),
      }),
    )
    .max(MAX_FUNDS),
});

const evidenceSchema = z.object({
  found: z
    .object({
      /** The sentence on the page that says what the brand sponsored and when, exactly as written. */
      quote: z.string().min(1),
      source: z.number().int().min(1),
    })
    .nullable(),
});

const currencyOf = (amount: string): string | null =>
  amount.match(/[£$€₦]|\b(?:USD|GBP|EUR|NGN|GHS|ZAR|KES|CAD|AUD)\b/)?.[0] ?? null;

export const fundSearchPrompt = (s: FundSearch): string =>
  [
    `Find funds, grants, loans and sponsorship programmes that are open now for a ${s.category} project${s.stage ? ` at the ${s.stage} stage` : ''}${s.nationality ? ` made by ${s.nationality} producers` : ''}, in or for ${s.territories.join(', ') || 'any market'}.`,
    `Today is ${s.today}.`,
    'For each, give its name, who runs it, what it offers, its closing date, and its eligibility criteria exactly as the page words them, with the page.',
  ].join('\n');

const lastYears = (today: string) => {
  const year = Number(today.slice(0, 4));
  return [year, year - 1, year - 2].map(String);
};

/**
 * Pure verification of what a model read from a page: each field is kept only when the fetched
 * page holds the words, and a fund whose page lacks the deadline or amount it claims is dropped.
 */
export function verifyFunds(
  read: z.infer<typeof fundsSchema>['funds'],
  pages: { title: string; url: string; fetched: FetchedPage | null }[],
  today: string,
): VerifiedFund[] {
  const out: VerifiedFund[] = [];
  const seen = new Set<string>();
  for (const f of read) {
    const page = pages[f.source - 1];
    const fetched = page?.fetched;
    if (!page || !fetched) continue;
    if (!pageContains(fetched, f.name)) continue;
    if (f.amountText && !pageContains(fetched, f.amountText)) continue;
    let deadline: string | null = null;
    if (f.deadlineText) {
      const iso = parseDay(f.deadlineText);
      if (!iso || !pageContains(fetched, f.deadlineText)) continue;
      if (f.deadlineIso && f.deadlineIso !== iso) continue;
      // A fund already closed is no use to the team and would only mislead.
      if (iso < today) continue;
      deadline = iso;
    }
    const criteria: FundCriterion[] = [];
    let otherConditions = f.otherConditions;
    for (const c of f.criteria) {
      if (pageContains(fetched, c.quote)) {
        criteria.push({ text: c.quote.trim(), field: c.field, value: c.value });
      } else {
        // A criterion the page does not hold is not claimed, and the fund is not called complete.
        otherConditions = true;
      }
    }
    const key = `${f.name.toLowerCase()}|${fetched.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: f.name.trim(),
      owner: f.owner && pageContains(fetched, f.owner) ? f.owner.trim() : null,
      type: f.type,
      amount: f.amountText?.trim() ?? null,
      currency: f.amountText ? currencyOf(f.amountText) : null,
      deadline,
      criteria,
      otherConditions,
      applicationUrl:
        f.applicationUrl &&
        (pageContains(fetched, f.applicationUrl) || f.applicationUrl === fetched.url)
          ? f.applicationUrl
          : null,
      sourceUrl: fetched.url,
      sourceTitle: page.title,
      retrievedAt: fetched.retrievedAt,
    });
  }
  return out;
}

export class ModelFundingResearcher implements FundingResearcher {
  readonly enabled = true;

  constructor(
    private readonly search: WebSearch,
    private readonly extract: LanguageModel,
    private readonly timeoutMs: number,
    private readonly fetchPageImpl: (url: string) => Promise<FetchedPage | null> = fetchPage,
  ) {}

  private async pagesOf(found: { sources: { title: string; url: string }[] }) {
    const unique = [...new Map(found.sources.map((s) => [s.url, s])).values()].slice(0, MAX_PAGES);
    return Promise.all(
      unique.map(async (s) => ({
        title: s.title,
        url: s.url,
        fetched: await this.fetchPageImpl(s.url),
      })),
    );
  }

  async funds(input: FundSearch) {
    const found = await this.search({
      system:
        'You find funding programmes on web pages. Report only what a page states. Never guess an amount, a date or a rule.',
      prompt: fundSearchPrompt(input),
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    const pages = await this.pagesOf(found);
    if (pages.length === 0 || !found.text.trim()) return { funds: [], tokens: found.tokens };
    const { output, usage } = await generateText({
      model: this.extract,
      system:
        'From the research notes, list each funding programme. Copy the amount, the closing date and every criterion exactly as the page words them. Leave a field null when the notes do not give it. Set otherConditions when the page lists conditions you did not include.',
      prompt: [
        'Research notes:',
        found.text,
        '',
        'Sources:',
        ...pages.map((p, i) => `${i + 1}. ${p.title} (${p.url})`),
      ].join('\n'),
      output: Output.object({ schema: fundsSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return {
      funds: verifyFunds(output.funds, pages, input.today),
      tokens: found.tokens + (usage.totalTokens ?? 0),
    };
  }

  async evidence(input: SponsorSearch) {
    const found = await this.search({
      system:
        'You find sponsorship by brands on web pages. Report only what a page states. Never guess.',
      prompt: `Find recent entertainment sponsorship by ${input.brand} in ${input.territory}: film, music, television, events or festivals, in the last two years. Today is ${input.today}. Give what it sponsored, when, and the page.`,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    const pages = await this.pagesOf(found);
    if (pages.length === 0 || !found.text.trim()) return { evidence: null, tokens: found.tokens };
    const { output, usage } = await generateText({
      model: this.extract,
      system:
        'From the research notes, give the one sentence on a page that says what the brand sponsored and when, copied exactly, and the number of its source. Null when no source says it.',
      prompt: [
        `Brand: ${input.brand}`,
        'Research notes:',
        found.text,
        '',
        'Sources:',
        ...pages.map((p, i) => `${i + 1}. ${p.title} (${p.url})`),
      ].join('\n'),
      output: Output.object({ schema: evidenceSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    const tokens = found.tokens + (usage.totalTokens ?? 0);
    const hit = output.found;
    const page = hit ? pages[hit.source - 1] : undefined;
    const fetched = page?.fetched;
    if (!hit || !page || !fetched) return { evidence: null, tokens };
    // Kept only when the page holds both the brand and the sentence, and the sentence says a recent year.
    const recent = lastYears(input.today).some((y) => hit.quote.includes(y));
    if (!pageContains(fetched, input.brand) || !pageContains(fetched, hit.quote) || !recent) {
      return { evidence: null, tokens };
    }
    return {
      evidence: {
        url: fetched.url,
        title: page.title,
        retrievedAt: fetched.retrievedAt,
        quote: hit.quote.trim(),
      },
      tokens,
    };
  }
}
