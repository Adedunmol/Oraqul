import type { ReportItem } from '@oraqul/schema';
import type { LanguageModel } from 'ai';
import type { ProviderOptions } from '../../llm/llm.js';
import {
  FallbackReportWriter as LaunchFallbackReportWriter,
  ModelReportWriter as LaunchModelReportWriter,
  type ReportWriteInput as LaunchReportWriteInput,
  type ReportWriter as LaunchReportWriter,
  TemplateReportWriter as LaunchTemplateReportWriter,
  type ReportKit,
} from '../launch/report-writer.js';
import type { WrittenLine } from '../launch/writer.js';
import type { BooksRead } from './read.js';
import { briefBlock, RULES } from './writer.js';

export type ReportWriteInput = LaunchReportWriteInput<BooksRead>;
export type ReportWriter = LaunchReportWriter<BooksRead>;

export const REPORT_WRITER_SYSTEM = `You write two short lists for an audit of a book launch plan, for Oraqul, from findings measured in Qloo taste data and your publishing knowledge. The verdicts on the plan's beliefs are already decided and given to you. You never change them and never write a number of your own.

${RULES}

- risks: what could go wrong with this plan, most serious first, one to three sentences each with what to do about it. Write one for every belief that is weak or breaks, and one for each belief that could not be tested and matters. A risk about taste, comps or readers is grounded and cites its finding. If results are given, say where the launch fell short of the plan.
- alternatives: stronger options the findings point to, such as a market, a recent comparable book, a screen comparison or a bookshop that ranks higher. Every alternative cites the finding that names it. Never tell the team to drop a market, a comparable book, a screen comparison or a bookshop they chose: suggest what to add beside it or what to do first.
- Never say a belief "holds", "breaks" or "is weak" in your own words; the verdict pill says it.`;

const line = (text: string, findingIds: string[], names: string[]): WrittenLine => ({
  kind: 'grounded',
  text,
  findingIds,
  sourceIds: [],
  names,
  group: null,
});

export const booksReportKit: ReportKit<BooksRead> = {
  system: REPORT_WRITER_SYSTEM,
  brief: briefBlock,
  audience: 'your book’s readers',
  compsRisk:
    'The comparable books may speak to different readers, so one title can skew the whole read: check what each one signals on its own.',
  // The comps the plan pitches against, whose age is tested, are beliefs of subject `comps`.
  otherRisk: (item: ReportItem) => {
    if (!item.id.startsWith('a-shop-')) return null;
    return line(
      'A bookshop you named is not among the ones your readers go to most, so an event there may reach fewer of them: pair it with one that ranks higher.',
      item.findingIds.slice(0, 1),
      [],
    );
  },
};

export class ModelReportWriter extends LaunchModelReportWriter<BooksRead> {
  constructor(model: LanguageModel, timeoutMs: number, options: ProviderOptions = {}) {
    super(model, timeoutMs, booksReportKit, options);
  }
}

/** Falls back to the template writer when the model fails, so a report never stops at writing. */
export class FallbackReportWriter extends LaunchFallbackReportWriter<BooksRead> {}

/** Writes the lists from the verdicts alone, for runs with no model key or when the model fails. */
export class TemplateReportWriter extends LaunchTemplateReportWriter<BooksRead> {
  constructor() {
    super(booksReportKit);
  }
}
