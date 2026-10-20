import {
  type CompUsed,
  type Finding,
  type LaunchSectionKey,
  launchSectionKeys,
  lineKindSchema,
  type PlanSource,
} from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import type { ProviderOptions } from '../../llm/llm.js';
import type { LaunchRead } from './read-core.js';

/** A line as the writer gives it, before code checks it and gives it an id. */
export const writtenLineSchema = z.object({
  kind: lineKindSchema,
  text: z.string().min(1),
  findingIds: z.array(z.string()),
  /** The web facts the line states, by id. Empty when it states none. */
  sourceIds: z.array(z.string()),
  names: z.array(z.string()),
  group: z.string().nullable(),
});
export type WrittenLine = z.infer<typeof writtenLineSchema>;

export const writtenSectionSchema = z.object({
  key: z.enum(launchSectionKeys),
  lines: z.array(writtenLineSchema),
});
export type WrittenSection = z.infer<typeof writtenSectionSchema>;

const writtenPlanSchema = z.object({
  sections: z.array(writtenSectionSchema),
  /** Candidates the writer left out as off-genre or off-brief, with a reason for each. */
  skipped: z.array(z.object({ name: z.string(), why: z.string() })),
});

const writtenAnswerSchema = z.object({
  lines: z.array(writtenLineSchema),
  /** True when the answer would change a decision in the plan, so the agent offers a what-if. */
  changesDecision: z.boolean(),
});

export interface WriteInput<R extends LaunchRead = LaunchRead> {
  title: string;
  /** The person's own words: the brief and its files, as sent. */
  request: string;
  read: R;
  comps: CompUsed[];
  /** The sections to write, core first. Gaps and Budget split are written by code. */
  sections: LaunchSectionKey[];
  findings: Finding[];
  /** Facts found on the web, each with an id a line may cite. Empty when search is off. */
  sources: PlanSource[];
  /** `YYYY-MM-DD`. A plan never advises around a date before it. Optional: older callers omit it. */
  today?: string;
}

export interface AnswerInput<R extends LaunchRead = LaunchRead> {
  title: string;
  read: R;
  question: string;
  /** The plan's lines as plain text, for context. */
  plan: string;
  chat: string;
  findings: Finding[];
}

export interface PlanWriter<R extends LaunchRead = LaunchRead> {
  write(input: WriteInput<R>): Promise<{
    sections: WrittenSection[];
    skipped: { name: string; why: string }[];
    tokens: number;
    by: 'model' | 'template';
  }>;
  answer(input: AnswerInput<R>): Promise<{
    lines: WrittenLine[];
    changesDecision: boolean;
    tokens: number;
    by: 'model' | 'template';
  }>;
}

/** What differs by category: the prompts, how the brief reads, and the template lines. */
export interface WriterKit<R extends LaunchRead = LaunchRead> {
  planSystem: string;
  answerSystem: string;
  brief(title: string, read: R, comps: CompUsed[]): string;
  templateSection(key: LaunchSectionKey, input: WriteInput<R>): WrittenLine[];
}

/** Sections code writes itself: Gaps from what was not tested, Budget split from the convention. */
export const CODE_SECTIONS: LaunchSectionKey[] = ['gaps', 'budget'];

export function findingsBlock(findings: Finding[]): string {
  return findings
    .map(
      (f) =>
        `[${f.id}] ${f.text}${f.entities.length ? ` Candidates: ${f.entities.map((e) => (e.detail ? `${e.name} (${e.detail})` : e.name)).join('; ')}.` : ''} Confidence ${f.confidence}.`,
    )
    .join('\n');
}

export function sourcesBlock(sources: PlanSource[]): string {
  return sources.map((s) => `[${s.id}] ${s.fact} (${s.title})`).join('\n');
}

export class ModelPlanWriter<R extends LaunchRead = LaunchRead> implements PlanWriter<R> {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
    private readonly kit: WriterKit<R>,
    // Provider settings, such as how hard a reasoning model thinks before writing.
    private readonly options: ProviderOptions = {},
  ) {}

  async write(input: WriteInput<R>) {
    const wanted = input.sections.filter((s) => !CODE_SECTIONS.includes(s));
    const { output, usage } = await generateText({
      model: this.model,
      system: this.kit.planSystem,
      prompt: [
        'The request, as the person wrote it:',
        input.request,
        '',
        'The brief as read:',
        this.kit.brief(input.title, input.read, input.comps),
        ...(input.today
          ? ['', `Today is ${input.today}. Never advise around a date before it.`]
          : []),
        '',
        `Write these sections, in order: ${wanted.join(', ')}.`,
        '',
        'Findings:',
        findingsBlock(input.findings),
        ...(input.sources.length ? ['', 'Web facts:', sourcesBlock(input.sources)] : []),
      ].join('\n'),
      output: Output.object({ schema: writtenPlanSchema }),
      providerOptions: this.options,
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return {
      sections: output.sections,
      skipped: output.skipped,
      tokens: usage.totalTokens ?? 0,
      by: 'model' as const,
    };
  }

  async answer(input: AnswerInput<R>) {
    const { output, usage } = await generateText({
      model: this.model,
      system: this.kit.answerSystem,
      prompt: [
        this.kit.brief(input.title, input.read, []),
        '',
        'The plan:',
        input.plan,
        '',
        'Chat so far:',
        input.chat,
        '',
        'Findings:',
        findingsBlock(input.findings),
        '',
        `Question: ${input.question}`,
      ].join('\n'),
      output: Output.object({ schema: writtenAnswerSchema }),
      providerOptions: this.options,
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { ...output, tokens: usage.totalTokens ?? 0, by: 'model' as const };
  }
}

/** Falls back to the template writer when the model fails, so a plan never stops at writing. */
export class FallbackPlanWriter<R extends LaunchRead = LaunchRead> implements PlanWriter<R> {
  constructor(
    private readonly primary: PlanWriter<R>,
    private readonly fallback: PlanWriter<R>,
    private readonly onError: (err: unknown) => void,
  ) {}

  async write(input: WriteInput<R>) {
    try {
      return await this.primary.write(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.write(input);
    }
  }

  async answer(input: AnswerInput<R>) {
    try {
      return await this.primary.answer(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.answer(input);
    }
  }
}

export const NAMED = 3;

export const grounded = (
  text: string,
  finding: Finding,
  names: string[],
  group: string | null = null,
): WrittenLine => ({
  kind: 'grounded',
  text,
  findingIds: [finding.id],
  sourceIds: [],
  names,
  group,
});

export const playbook = (
  text: string,
  names: string[] = [],
  group: string | null = null,
): WrittenLine => ({
  kind: 'playbook',
  text,
  findingIds: [],
  sourceIds: [],
  names,
  group,
});

/**
 * Writes the plan from templates, for runs with no model key, a failed call and the evals. It
 * names the findings' top candidates as they are, with no judgment of genre or tone.
 */
export class TemplatePlanWriter<R extends LaunchRead = LaunchRead> implements PlanWriter<R> {
  constructor(private readonly kit: Pick<WriterKit<R>, 'templateSection'>) {}

  async write(input: WriteInput<R>) {
    const sections = input.sections
      .filter((key) => !CODE_SECTIONS.includes(key))
      .map((key) => ({ key, lines: this.kit.templateSection(key, input) }));
    return { sections, skipped: [], tokens: 0, by: 'template' as const };
  }

  async answer(input: AnswerInput<R>) {
    const words = new Set(input.question.toLowerCase().match(/\p{L}{4,}/gu) ?? []);
    const scored = input.findings
      .map((f) => ({
        f,
        score: [...words].filter((w) => f.text.toLowerCase().includes(w)).length,
      }))
      .sort((a, b) => b.score - a.score);
    const picked = scored
      .filter((s) => s.score > 0)
      .slice(0, 3)
      .map((s) => s.f);
    const use = picked.length ? picked : input.findings.slice(0, 2);
    const lines = use.map((f) =>
      grounded(
        f.text,
        f,
        f.entities.slice(0, NAMED).map((e) => e.name),
      ),
    );
    return { lines, changesDecision: false, tokens: 0, by: 'template' as const };
  }
}
