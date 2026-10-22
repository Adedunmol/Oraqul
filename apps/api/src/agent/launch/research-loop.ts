import type { Finding, Understanding } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import { rankEvidence } from './evidence.js';
import type { Grounded } from './findings.js';

/** Most extra queries one second round may run. */
export const MAX_EXTRA = 3;
/** Qloo calls a second round needs left, because one query asks up to five cities. */
export const MIN_CALLS_LEFT = 12;

export interface CatalogEntry {
  key: string;
  /** `core` queries run for every plan; the others with their module. */
  for: string;
  label: string;
}

export const assessmentSchema = z.object({
  checks: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['covered', 'thin', 'missing']),
      findingIds: z.array(z.string()).max(6),
    }),
  ),
  extra: z
    .array(z.object({ query: z.string(), check: z.string(), why: z.string() }))
    .max(MAX_EXTRA),
});
export type Assessment = z.infer<typeof assessmentSchema>;

export interface ResearchInput {
  category: string;
  title: string;
  understanding: Understanding;
  findings: Finding[];
  gaps: Grounded['gaps'];
  /** Queries the catalog offers that the first round did not run. */
  unrun: CatalogEntry[];
  callsLeft: number;
}

export interface ResearchPlanner {
  assess(input: ResearchInput): Promise<{ assessment: Assessment | null; tokens: number }>;
}

export const RESEARCH_SYSTEM = `You are the research check of Oraqul, a launch planner that grounds every claim in Qloo taste data. A first round of Qloo queries has run. Judge whether it gives the plan what the request needs.

You get the checks a good answer must pass, the findings (id, query, confidence, text), what came back empty, and the queries not yet run.
- checks: for every check listed, "covered" when findings bear on it directly, "thin" when they only touch it or are low confidence, "missing" when nothing measured it. List the finding ids you judge bear on it.
- extra: up to ${MAX_EXTRA} queries from the unrun list that would cover a thin or missing check, each with the check id and a one-line reason. Choose none when the first round is enough or nothing unrun helps. Never name a query that is not on the list.

You never write a number or a verdict about an audience.`;

export class ModelResearchPlanner implements ResearchPlanner {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async assess(input: ResearchInput) {
    const { output, usage } = await generateText({
      model: this.model,
      system: RESEARCH_SYSTEM,
      prompt: [
        `Category: ${input.category}`,
        `Launch title: ${input.title}`,
        `What they want: ${input.understanding.asked}`,
        '',
        'Checks:',
        ...input.understanding.criteria
          .filter((c) => c.evidence)
          .map((c) => `- ${c.id}: ${c.text}`),
        '',
        'Findings:',
        ...input.findings.map((f) => `- ${f.id} [${f.query}, ${f.confidence}] ${f.text}`),
        '',
        'Came back empty or failed:',
        ...(input.gaps.length ? input.gaps.map((g) => `- ${g.item}: ${g.why}`) : ['- nothing']),
        '',
        'Queries not yet run:',
        ...(input.unrun.length
          ? input.unrun.map((q) => `- ${q.key}: ${q.label}`)
          : ['- none left']),
      ].join('\n'),
      output: Output.object({ schema: assessmentSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { assessment: output, tokens: usage.totalTokens ?? 0 };
  }
}

/** With no key, or when the model fails: no judgement, so no second round and no coverage claim. */
export class ScriptedResearchPlanner implements ResearchPlanner {
  async assess() {
    return { assessment: null, tokens: 0 };
  }
}

export class FallbackResearchPlanner implements ResearchPlanner {
  constructor(
    private readonly primary: ResearchPlanner,
    private readonly fallback: ResearchPlanner,
    private readonly onError: (err: unknown) => void,
  ) {}

  async assess(input: ResearchInput) {
    try {
      return await this.primary.assess(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.assess(input);
    }
  }
}

/**
 * Checks the model's judgement against the findings. A check counts as covered only when at least
 * one finding it names exists and is better than low confidence, so a model cannot claim coverage
 * the data does not show. Extra queries must be on the unrun list and fit the call budget.
 */
export function applyAssessment(
  understanding: Understanding,
  findings: Finding[],
  assessment: Assessment | null,
  unrun: CatalogEntry[],
  callsLeft: number,
): { understanding: Understanding; extra: { query: string; check: string; why: string }[] } {
  if (!assessment) return { understanding, extra: [] };
  const byId = new Map(findings.map((f) => [f.id, f]));
  const said = new Map(assessment.checks.map((c) => [c.id, c]));
  const criteria = understanding.criteria.map((c) => {
    // A check about following the request needs no Qloo evidence, so it is not judged on it.
    if (!c.evidence) return c;
    const judged = said.get(c.id);
    if (!judged) return { ...c, status: 'thin' as const };
    const real = judged.findingIds.filter((id) => byId.has(id));
    const solid = real.some((id) => byId.get(id)?.confidence !== 'lower');
    const status =
      real.length === 0
        ? 'missing'
        : judged.status === 'covered' && !solid
          ? 'thin'
          : judged.status;
    return { ...c, status, findingIds: real };
  });
  const offered = new Set(unrun.map((q) => q.key));
  const extra =
    callsLeft >= MIN_CALLS_LEFT
      ? assessment.extra
          .filter(
            (e, i, all) => offered.has(e.query) && all.findIndex((x) => x.query === e.query) === i,
          )
          .slice(0, MAX_EXTRA)
      : [];
  return { understanding: { ...understanding, criteria: rankEvidence(criteria, findings) }, extra };
}

/**
 * After the second round: a check an extra query was run for is covered when that query made a
 * finding better than low confidence, and thin when it made only low ones. A query that made
 * nothing leaves the check as it was and shows as a gap.
 */
export function applyRound2(
  understanding: Understanding,
  more: Finding[],
  extra: { query: string; check: string }[],
  all: Finding[],
): Understanding {
  const criteria = understanding.criteria.map((c) => {
    const queries = extra.filter((e) => e.check === c.id).map((e) => e.query);
    const made = more.filter((f) => queries.includes(f.query));
    if (made.length === 0) return c;
    const solid = made.some((f) => f.confidence !== 'lower');
    return {
      ...c,
      status: solid ? ('covered' as const) : c.status === 'missing' ? ('thin' as const) : c.status,
      findingIds: [...c.findingIds, ...made.map((f) => f.id)],
    };
  });
  return { ...understanding, criteria: rankEvidence(criteria, all) };
}
