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
import { askSupport, type SupportInput, type SupportResult } from './support.js';

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
        /** One question only the person can answer to settle the issue, or null. */
        ask: z.string().nullable(),
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
  /** Blocking issues from earlier drafts, that the writer was sent back with. */
  earlier: string[];
}

export interface Reviewer {
  review(input: ReviewInput): Promise<{ review: RawReview | null; tokens: number }>;
  /**
   * Whether each grounded line is supported by the evidence it cites. `null` when no model could
   * answer, in which case the lines stay (the code checks have already run).
   */
  support(input: SupportInput): Promise<{ results: SupportResult[] | null; tokens: number }>;
}

export const REVIEW_SYSTEM = `You are the red team of Oraqul, a launch planner that grounds every claim in Qloo taste data. You get a request, what the project already holds, the checks a good answer must pass, the evidence found, and a draft plan. Judge the draft the way the person who asked would, hard but fairly.

Compare three things: what was asked, the context, and what the draft says. Report an issue when:
- missing: a check is not answered, or something they asked for is absent.
- off-brief: the draft plans something they did not ask for, or ignores a constraint, a city, a comp, a window or a budget they gave.
- contradicts-context: it conflicts with the project's earlier decisions or the chat so far.
- weak-evidence: a claim leans on a finding that does not support it, or the evidence for a check is thin and the draft sounds surer than it is.
- unhelpful: it is true but gives the person nothing to act on.
- vague: a line a team could not act on.
- dead-end: the draft says something was not found, is thin or is unknown and stops there, with no closest suggestion and no question or next step for the person. Every thin spot must end with what the draft used instead, called close, and what the person could tell you to sharpen it.
- overclaim: the draft presents a stand-in as the real thing: a comp Oraqul chose called the team's own, a nearby city read as the team's city, a brand with no confirmed market given one.

blocking is true only when the person would clearly be let down: a check is not answered at all, the ask is missed, a constraint or detail they gave is contradicted, or a claim goes against the evidence. Missing detail the person never gave (a release date, a distribution model), wanting more specifics or more spend lines, style, and small gaps are never blocking: put what they could provide in "next" instead. Do not ask the draft to explain limits or data gaps; ask it to show the closest thing it has and what would sharpen it. A dead-end or an overclaim is always blocking. Mark at most 3 other issues blocking, and do not repeat an issue the last draft already fixed. For each issue say what the next draft should do (fix). When more Qloo evidence would fix it, name one query from the unrun list in "query"; when writing fixes it, use null. Set "section" to the key of the section an issue is about, or null. When an issue, blocking or not, cannot be settled by writing or by more Qloo evidence and only the person can settle it, such as a window, a market, a budget or a choice between two options they did not make, set "ask" to the one question to put to them, in plain words; otherwise null. It is put to them only if the plan still cannot pass after the last draft, so ask for the one answer that would help most. When a blocking issue from an earlier draft is still missing from this one, the writer cannot supply it from the evidence and the request: set "ask" for it, naming the choice you need from the person.

Details listed under "Assumed, not said by the person" were filled in by Oraqul, from the description or the team's defaults. Never fault the draft for lacking what the person did not give, and never ask them to confirm an assumption. Report off-brief only when the draft presents an assumed detail as if the person had said it. The person may not know their audience, comps or what to launch for: never make "next" ask them for comps or what their audience likes. Ask for what only they know about the work: what it is about, its genre, who is in it, where and when it opens, the budget.

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
        ...(input.earlier.length
          ? [
              '',
              'Blocking issues you raised on earlier drafts, which the writer was told to fix:',
              ...input.earlier.map((e) => `- ${e}`),
            ]
          : []),
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

  support(input: SupportInput) {
    return askSupport(this.model, this.timeoutMs, input);
  }
}

/** With no key, or when the model fails: no review, and the plan says it was not reviewed. */
export class ScriptedReviewer implements Reviewer {
  async review() {
    return { review: null, tokens: 0 };
  }

  async support() {
    return { results: null, tokens: 0 };
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

  async support(input: SupportInput) {
    try {
      return await this.primary.support(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.support(input);
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
  /** The question only the person can answer: the first blocking issue's, else the first issue's that has one. */
  ask: string | null;
}

/** Turns the model's review into a verdict. The model lists issues; code decides pass or fail. */
/**
 * A dead end or an overclaim never ships, so the red team's say-so is not needed: the writer is
 * sent back for either, whatever the model marked.
 */
const ALWAYS_BLOCKS: ReadonlySet<ReviewIssue['type']> = new Set(['dead-end', 'overclaim']);

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
    blocking: (i.blocking || ALWAYS_BLOCKS.has(i.type)) && !byCode(i),
    ...(i.ask && !byCode(i) ? { ask: i.ask } : {}),
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
    ask: (issues.find((i) => i.blocking && i.ask) ?? issues.find((i) => i.ask))?.ask ?? null,
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
