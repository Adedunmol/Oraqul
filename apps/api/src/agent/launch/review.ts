import {
  type Finding,
  type PlanReview,
  type ReviewIssue,
  reviewIssueTypes,
  type Understanding,
} from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import type { CatalogEntry } from './research-loop.js';

/** Most drafts the red team may send back before the best one is saved with its open issues. */
export const MAX_ROUNDS = 3;
const MAX_ISSUES = 6;
const MAX_NEXT = 3;

/** What the model returns. Flat, so every provider accepts the schema. */
export const rawReviewSchema = z.object({
  issues: z
    .array(
      z.object({
        check: z.string(),
        type: z.enum(reviewIssueTypes),
        text: z.string().min(1),
        fix: z.string().min(1),
        blocking: z.boolean(),
        /** A catalog query that would give the evidence this needs, or null when writing fixes it. */
        query: z.string().nullable(),
        /** The section the issue is about, as its key, or null when it is about the plan as a whole. */
        section: z.string().nullable(),
      }),
    )
    .max(MAX_ISSUES),
  /** What the person could give or try to make the plan stronger, in plain words. */
  next: z.array(z.string().min(1)).max(MAX_NEXT),
});
export type RawReview = z.infer<typeof rawReviewSchema>;

export interface ReviewInput {
  category: string;
  title: string;
  /** The person's request as they wrote it, with any answers they gave. */
  request: string;
  /** What the chat and the project already hold, for the draft to be consistent with. */
  context: string;
  understanding: Understanding;
  /** The draft as plain text, section by section. */
  draft: string;
  findings: Finding[];
  gaps: { item: string; why: string }[];
  /** Queries the catalog offers that no round has run. */
  unrun: CatalogEntry[];
  /** Sections code writes whole, which the writer cannot change. */
  codeSections: string[];
  round: number;
}

export interface Reviewer {
  review(input: ReviewInput): Promise<{ review: RawReview | null; tokens: number }>;
}

export const REVIEW_SYSTEM = `You are the red team of Oraqul, a launch planner that grounds every claim in Qloo taste data. You get a request, what the project already holds, the checks a good answer must pass, the evidence found, and a draft plan. Judge the draft the way the person who asked would, hard but fairly.

Compare three things: what was asked, the context, and what the draft says. Report an issue when:
- missing: a check is not answered, or something they asked for is absent.
- off-brief: the draft plans something they did not ask for, or ignores a constraint, a city, a comp, a window or a budget they gave.
- contradicts-context: it conflicts with the project's earlier decisions or the chat so far.
- weak-evidence: a claim leans on a finding that does not support it, or the evidence for a check is thin and the draft sounds surer than it is.
- unhelpful: it is true but gives the person nothing to act on.
- vague: a line a team could not act on.

blocking is true only when the person would clearly be let down: a check is not answered at all, the ask is missed, a constraint or detail they gave is contradicted, or a claim goes against the evidence. Missing detail the person never gave (a release date, a distribution model), wanting more specifics or more spend lines, style, and small gaps are never blocking: put what they could provide in "next" instead. Do not ask the draft to describe what could not be measured; the plan does not talk about that. Mark at most 3 issues blocking, and do not repeat an issue the last draft already fixed. For each issue say what the next draft should do (fix). When more Qloo evidence would fix it, name one query from the unrun list in "query"; when writing fixes it, use null. Set "section" to the key of the section an issue is about, or null.

Also list up to ${MAX_NEXT} things in "next" the person could give or try to make the plan stronger, in plain words, even when you pass the draft. Return no issues when the draft does what was asked. You never write a number, a score or a verdict about an audience.`;

export class ModelReviewer implements Reviewer {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async review(input: ReviewInput) {
    const { output, usage } = await generateText({
      model: this.model,
      system: REVIEW_SYSTEM,
      prompt: [
        `Category: ${input.category}`,
        `Launch title: ${input.title}`,
        `Draft number ${input.round}.`,
        '',
        'The request:',
        input.request,
        '',
        'What the project and chat already hold:',
        input.context || 'nothing yet',
        '',
        'What they want, and the checks a good answer must pass:',
        input.understanding.asked,
        ...input.understanding.criteria.map((c) => `- ${c.id} [${c.status}]: ${c.text}`),
        ...(input.understanding.assumed.length
          ? [
              '',
              'Assumed, not said by the person:',
              ...input.understanding.assumed.map((a) => `- ${a.what}: ${a.value}`),
            ]
          : []),
        '',
        'Evidence:',
        ...input.findings.map((f) => `- ${f.id} [${f.confidence}] ${f.text}`),
        ...(input.gaps.length
          ? ['', 'Could not be measured:', ...input.gaps.map((g) => `- ${g.item}: ${g.why}`)]
          : []),
        '',
        `Sections written by code, which the writer cannot change (an issue about one is for the person, not the writer): ${input.codeSections.join(', ') || 'none'}`,
        '',
        'Queries not yet run:',
        ...(input.unrun.length ? input.unrun.map((q) => `- ${q.key}: ${q.label}`) : ['- none']),
        '',
        'The draft:',
        input.draft,
      ].join('\n'),
      output: Output.object({ schema: rawReviewSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { review: output, tokens: usage.totalTokens ?? 0 };
  }
}

/** With no key, or when the model fails: no review, and the plan says it was not reviewed. */
export class ScriptedReviewer implements Reviewer {
  async review() {
    return { review: null, tokens: 0 };
  }
}

export class FallbackReviewer implements Reviewer {
  constructor(
    private readonly primary: Reviewer,
    private readonly fallback: Reviewer,
    private readonly onError: (err: unknown) => void,
  ) {}

  async review(input: ReviewInput) {
    try {
      return await this.primary.review(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.review(input);
    }
  }
}

export interface Verdict {
  issues: ReviewIssue[];
  /** True when no issue blocks. Decided here, from the issue list alone. */
  passed: boolean;
  /** Queries to run before the next draft: on the unrun list, once each. */
  research: { query: string; check: string; why: string }[];
  next: string[];
}

/** Turns the model's review into a verdict. The model lists issues; code decides pass or fail. */
export function judge(
  raw: RawReview,
  understanding: Understanding,
  unrun: CatalogEntry[],
  codeSections: string[] = [],
): Verdict {
  const checks = new Set(understanding.criteria.map((c) => c.id));
  const offered = new Set(unrun.map((q) => q.key));
  // The writer cannot change a section code writes, so an issue about one is not a reason to
  // write again: it goes to the person as a next step.
  const byCode = (i: RawReview['issues'][number]) =>
    i.section !== null && codeSections.includes(i.section);
  const issues: ReviewIssue[] = raw.issues.map((i) => ({
    check: checks.has(i.check) ? i.check : 'general',
    type: i.type,
    text: i.text,
    fix: i.fix,
    blocking: i.blocking && !byCode(i),
  }));
  const research = raw.issues
    .flatMap((i) =>
      i.query && offered.has(i.query) ? [{ query: i.query, check: i.check, why: i.fix }] : [],
    )
    .filter((r, i, all) => all.findIndex((x) => x.query === r.query) === i);
  return {
    issues,
    passed: !issues.some((i) => i.blocking),
    research,
    next: [...raw.next, ...raw.issues.filter(byCode).map((i) => i.fix)].slice(0, MAX_NEXT),
  };
}

/** The lines a writer is sent back with: what failed the line check and what the red team found. */
export function feedbackLines(
  dropped: { text: string; why: string }[],
  issues: ReviewIssue[],
): string[] {
  return [
    ...issues.map((i) => `${i.type} (${i.check}): ${i.text} Fix: ${i.fix}`),
    ...dropped.slice(0, 8).map((d) => `Line removed because ${d.why}: "${d.text}"`),
  ];
}

export function reviewOf(
  status: PlanReview['status'],
  rounds: PlanReview['rounds'],
  next: string[],
): PlanReview {
  return { status, rounds, next };
}
