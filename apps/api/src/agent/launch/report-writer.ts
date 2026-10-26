import type { CompUsed, Finding, PlanSource, ReportItem, ResultsComparison } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import type { ProviderOptions } from '../../llm/llm.js';
import type { LaunchRead } from './read-core.js';
import { list } from './text.js';
import { findingsBlock, sourcesBlock, type WrittenLine, writtenLineSchema } from './writer.js';

export interface ReportWriteInput<R extends LaunchRead = LaunchRead> {
  title: string;
  /** The plan as the person wrote it, whole. */
  request: string;
  read: R;
  comps: CompUsed[];
  /** Every belief in the plan with its verdict, already decided by code. */
  items: ReportItem[];
  findings: Finding[];
  sources: PlanSource[];
  results: ResultsComparison | null;
}

export interface WrittenReport {
  risks: WrittenLine[];
  alternatives: WrittenLine[];
  tokens: number;
  by: 'model' | 'template';
}

/** Writes what could go wrong and what to consider instead. Verdicts are not its to set. */
export interface ReportWriter<R extends LaunchRead = LaunchRead> {
  write(input: ReportWriteInput<R>): Promise<WrittenReport>;
}

/** What differs by category: the prompt, how the brief reads, and a few words in the templates. */
export interface ReportKit<R extends LaunchRead = LaunchRead> {
  system: string;
  brief(title: string, read: R, comps: CompUsed[]): string;
  /** "your comps’ audience" */
  audience: string;
  /** The risk when the comps may describe different audiences. */
  compsRisk: string;
  /** A risk for a weak or broken belief the shared templates do not cover (subject `other`). */
  otherRisk?(item: ReportItem): WrittenLine | null;
}

const writtenReportSchema = z.object({
  risks: z.array(writtenLineSchema),
  alternatives: z.array(writtenLineSchema),
});

function itemsBlock(items: ReportItem[]): string {
  return items
    .map(
      (i) =>
        `[${i.id}] ${i.claim}. Verdict: ${i.verdict}. ${i.why}${i.findingIds.length ? ` Findings: ${i.findingIds.join(', ')}.` : ''}`,
    )
    .join('\n');
}

function resultsBlock(results: ResultsComparison | null): string {
  if (!results) return '';
  return [
    `Results (${results.measure}${results.asOf ? `, ${results.asOf}` : ''}), by city in the order they finished:`,
    ...results.rows.map(
      (r) =>
        `${r.actualRank}. ${r.place}: ${r.actualShare}% of the total, planned place ${r.plannedRank ?? 'none'}${r.gap === 'as-planned' ? '' : `, ${r.gap} the plan`}`,
    ),
  ].join('\n');
}

export class ModelReportWriter<R extends LaunchRead = LaunchRead> implements ReportWriter<R> {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
    private readonly kit: ReportKit<R>,
    private readonly options: ProviderOptions = {},
  ) {}

  async write(input: ReportWriteInput<R>): Promise<WrittenReport> {
    const { output, usage } = await generateText({
      model: this.model,
      system: this.kit.system,
      prompt: [
        'The plan, as the person wrote it:',
        input.request,
        '',
        'The brief as read:',
        this.kit.brief(input.title, input.read, input.comps),
        '',
        'The beliefs in the plan and their verdicts:',
        itemsBlock(input.items),
        ...(input.results ? ['', resultsBlock(input.results)] : []),
        '',
        'Findings:',
        findingsBlock(input.findings),
        ...(input.sources.length ? ['', 'Web facts:', sourcesBlock(input.sources)] : []),
      ].join('\n'),
      output: Output.object({ schema: writtenReportSchema }),
      providerOptions: this.options,
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { ...output, tokens: usage.totalTokens ?? 0, by: 'model' };
  }
}

/** Falls back to the template writer when the model fails, so a report never stops at writing. */
export class FallbackReportWriter<R extends LaunchRead = LaunchRead> implements ReportWriter<R> {
  constructor(
    private readonly primary: ReportWriter<R>,
    private readonly fallback: ReportWriter<R>,
    private readonly onError: (err: unknown) => void,
  ) {}

  async write(input: ReportWriteInput<R>): Promise<WrittenReport> {
    try {
      return await this.primary.write(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.write(input);
    }
  }
}

const line = (
  text: string,
  kind: WrittenLine['kind'],
  findingIds: string[],
  names: string[],
  group: string | null = null,
): WrittenLine => ({ kind, text, findingIds, sourceIds: [], names, group });

const ordinal = (n: number): string => {
  const rest = n % 100;
  const suffix =
    rest >= 11 && rest <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as const)[(n % 10) as 1] ?? 'th');
  return `${n}${suffix}`;
};

/** Writes the lists from the verdicts alone, for runs with no model key or when the model fails. */
export class TemplateReportWriter<R extends LaunchRead = LaunchRead> implements ReportWriter<R> {
  constructor(private readonly kit: Pick<ReportKit<R>, 'audience' | 'compsRisk' | 'otherRisk'>) {}

  async write(input: ReportWriteInput<R>): Promise<WrittenReport> {
    const risks: WrittenLine[] = [];
    const alternatives: WrittenLine[] = [];
    const cite = (item: ReportItem) => item.findingIds.slice(0, 1);

    for (const item of input.items) {
      if (item.verdict === 'weak' || item.verdict === 'breaks') {
        const finding = cite(item);
        const place = item.subject === 'place' ? placeOf(item, input.read) : null;
        if (item.subject === 'place' && place) {
          risks.push(
            line(
              `Do not rely on ${place} to carry the launch: ${this.kit.audience} is thinner there than in your other cities, so back it with a local partner or event.`,
              'grounded',
              finding,
              [place],
            ),
          );
        } else if (item.subject === 'age') {
          risks.push(
            line(
              `The age group you chose is not where ${this.kit.audience} is strongest, so test the creative on other ages before you commit the spend.`,
              'grounded',
              finding,
              [],
            ),
          );
        } else if (item.subject === 'gender') {
          risks.push(
            line(
              'The audience does not lean the way the plan says, so test the creative with both women and men.',
              'grounded',
              finding,
              [],
            ),
          );
        } else if (item.subject === 'comps') {
          risks.push(line(this.kit.compsRisk, 'grounded', finding, []));
        } else if (item.subject === 'other') {
          const risk = this.kit.otherRisk?.(item);
          if (risk) risks.push(risk);
        } else if (item.subject === 'partner' || item.subject === 'artist') {
          const name = nameOf(item);
          risks.push(
            line(
              `${name} may not be the best fit for this audience, so keep a second option ready and do not build the campaign on it alone.`,
              'grounded',
              finding,
              [name],
            ),
          );
        }
      } else if (item.verdict === 'cant') {
        risks.push(cantRisk(item, input.read));
      }
    }

    const rows = input.results?.rows ?? [];
    for (const row of rows.filter((r) => r.gap === 'under' && r.plannedRank !== null)) {
      risks.push(
        line(
          `${row.place} finished ${ordinal(row.actualRank)} in your results but the plan put it ${ordinal(row.plannedRank ?? 0)}. The plan’s order for it did not match your results; why is a hypothesis to test, not a fact.`,
          'playbook',
          [],
          [row.place],
          'Your results',
        ),
      );
    }

    const worth = input.findings.find((f) => f.id === 'f-worth-a-look');
    if (worth?.entities.length) {
      alternatives.push(
        line(
          `Consider adding ${list(worth.entities.map((e) => e.name))} beside your cities: ${this.kit.audience} is stronger there than in your weakest city.`,
          'grounded',
          [worth.id],
          worth.entities.map((e) => e.name),
          'Worth a look',
        ),
      );
    }
    for (const item of input.items) {
      if (item.verdict !== 'weak' && item.verdict !== 'breaks') continue;
      if (item.subject !== 'partner' && item.subject !== 'artist') continue;
      const finding = input.findings.find((f) => f.id === item.findingIds[0]);
      const better = finding?.entities
        .filter((e) => !nameOf(item).toLowerCase().includes(e.name.toLowerCase()))
        .slice(0, 2);
      if (!finding || !better?.length) continue;
      alternatives.push(
        line(
          `Consider ${list(better.map((e) => e.name))}${finding.context.city ? ` in ${finding.context.city}` : ''}: ${item.subject === 'partner' ? 'brands' : 'artists'} that rank higher with ${this.kit.audience}.`,
          'grounded',
          [finding.id],
          better.map((e) => e.name),
        ),
      );
    }
    for (const row of rows.filter((r) => r.gap === 'over' && r.plannedRank === null)) {
      alternatives.push(
        line(
          `${row.place} finished ${ordinal(row.actualRank)} in your results and was not in the plan. Consider adding it.`,
          'playbook',
          [],
          [row.place],
          'Your results',
        ),
      );
    }
    return { risks, alternatives, tokens: 0, by: 'template' };
  }
}

function placeOf(item: ReportItem, read: LaunchRead): string | null {
  return read.places.find((p) => item.claim.startsWith(p)) ?? null;
}

function nameOf(item: ReportItem): string {
  return item.claim.replace(/ is the right partner for this launch$| suits the audience$/, '');
}

function cantRisk(item: ReportItem, read: LaunchRead): WrittenLine {
  switch (item.subject) {
    case 'other':
      return line(
        'Nothing here tested the release window you set, so check it against rival releases before you commit.',
        'playbook',
        [],
        [],
      );
    case 'place': {
      const place = placeOf(item, read);
      return line(
        `Nothing here tested ${place ?? 'one of your cities'}, so confirm it with your own numbers before you spend against it.`,
        'playbook',
        [],
        [],
      );
    }
    case 'partner':
      return line(
        `Nothing here tested whether ${nameOf(item)} would back the launch, so ask them directly before you build on it.`,
        'playbook',
        [],
        [],
      );
    case 'artist':
      return line(
        `Nothing here tested ${nameOf(item)}, so confirm the fit with your own audience numbers.`,
        'playbook',
        [],
        [],
      );
    default:
      return line(
        'Nothing here tested who the audience is, so confirm it with your own numbers before you spend against it.',
        'playbook',
        [],
        [],
      );
  }
}
