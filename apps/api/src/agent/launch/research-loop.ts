import type { Finding, Understanding } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import type { ConsultOffer } from './consult.js';
import { rankEvidence } from './evidence.js';
import type { Grounded, Miss } from './findings.js';

/** Most extra queries one second round may run. */
export const MAX_EXTRA = 3;
/** Most times the research check may judge the findings and send queries back out before writing. */
export const MAX_RESEARCH_ROUNDS = 3;
/** Qloo calls a second round needs left, because one query asks up to five cities. */
export const MIN_CALLS_LEFT = 12;
/** Most retries of an empty query, and consults to another side, one round may run. */
export const MAX_RETRY = 3;
export const MAX_CONSULT = 2;
/** A retry costs one Qloo call; a consult a search and two tests. */
const CALLS_PER_CONSULT = 3;
/** A catalog query asks up to five cities, so it is budgeted at three calls. */
const CALLS_PER_QUERY = 3;

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
  /** Ask a query that came back empty another way, from the ways offered for it. */
  retry: z
    .array(z.object({ miss: z.string(), alt: z.string(), check: z.string(), why: z.string() }))
    .max(MAX_RETRY),
  /** Put a question to another category's side, from the consults offered. */
  consult: z
    .array(z.object({ offer: z.string(), check: z.string(), why: z.string() }))
    .max(MAX_CONSULT),
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
  /** Queries that came back empty, with the ways each can be asked again. */
  misses: Miss[];
  /** Questions another side could answer, from names the team gave. */
  consults: ConsultOffer[];
  callsLeft: number;
}

export interface ResearchPlanner {
  assess(input: ResearchInput): Promise<{ assessment: Assessment | null; tokens: number }>;
}

export const RESEARCH_SYSTEM = `You are the research check of Oraqul, a launch planner that grounds every claim in Qloo taste data. A first round of Qloo queries has run. Judge whether it gives the plan what the request needs.

You get the checks a good answer must pass, the findings (id, query, confidence, text), what came back empty, the queries not yet run, the empty queries that can be asked another way, and the questions another category's side could answer.
- checks: for every check listed, "covered" when findings bear on it directly, "thin" when they only touch it or are low confidence, "missing" when nothing measured it. List the finding ids you judge bear on it.
- extra: up to ${MAX_EXTRA} queries from the unrun list that would cover a thin or missing check, each with the check id and a one-line reason. Choose none when the first round is enough or nothing unrun helps. Never name a query that is not on the list.
- retry: up to ${MAX_RETRY} empty queries worth asking another way, each with the miss id exactly as quoted, one of the ways offered for it (its quoted key), the check it serves and a reason. Retry only an empty query whose result a thin or missing check needs.
- consult: up to ${MAX_CONSULT} of the offered questions to another side, each with the offer id exactly as quoted, the check it serves and a reason. Choose none when the findings already cover the check.

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
        '',
        'Empty queries that can be asked another way:',
        ...(input.misses.length
          ? input.misses.map(
              (m) =>
                `- ${m.id} (${m.label}): ${m.alternatives.map((a) => `${a.key} = ${a.says}`).join('; ')}`,
            )
          : ['- none']),
        '',
        'Questions another side could answer:',
        ...(input.consults.length
          ? input.consults.map((c) => `- offer "${c.id}" (${c.name}, ${c.category}): ${c.why}`)
          : ['- none']),
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
  offered: { misses: Miss[]; consults: ConsultOffer[] } = { misses: [], consults: [] },
): {
  understanding: Understanding;
  extra: { query: string; check: string; why: string }[];
  retry: { miss: string; alt: string; check: string; why: string }[];
  consult: { offer: string; check: string; why: string }[];
} {
  if (!assessment) return { understanding, extra: [], retry: [], consult: [] };
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
  const queries = new Set(unrun.map((q) => q.key));
  const enough = callsLeft >= MIN_CALLS_LEFT;
  // Each pick is kept only if code offered it, once, in the order code listed the offers, so the
  // same findings give the same round whatever order the model names them in.
  let left = callsLeft;
  const extra = enough
    ? assessment.extra
        .filter(
          (e, i, all) => queries.has(e.query) && all.findIndex((x) => x.query === e.query) === i,
        )
        .slice(0, MAX_EXTRA)
    : [];
  left -= extra.length * CALLS_PER_QUERY;
  const retry = enough
    ? offered.misses.flatMap((m) => {
        // The model sometimes names a miss by its label; the id or the label is the same miss.
        const pick = assessment.retry.find(
          (r) =>
            (r.miss === m.id || r.miss === m.label) && m.alternatives.some((a) => a.key === r.alt),
        );
        return pick ? [{ ...pick, miss: m.id }] : [];
      })
    : [];
  const retried = retry.slice(0, MAX_RETRY).slice(0, Math.max(0, left));
  left -= retried.length;
  const consult = enough
    ? offered.consults.flatMap((c) => {
        const pick = assessment.consult.find((x) => x.offer === c.id || x.offer === c.name);
        return pick ? [{ ...pick, offer: c.id }] : [];
      })
    : [];
  const consulted = consult
    .slice(0, MAX_CONSULT)
    .slice(0, Math.max(0, Math.floor(left / CALLS_PER_CONSULT)));
  return {
    understanding: { ...understanding, criteria: rankEvidence(criteria, findings) },
    extra,
    retry: retried,
    consult: consulted,
  };
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

/** The checks that need Qloo evidence and are not yet covered by it. */
export function openChecks(understanding: Understanding): Understanding['criteria'] {
  return understanding.criteria.filter((c) => c.evidence && c.status !== 'covered');
}
