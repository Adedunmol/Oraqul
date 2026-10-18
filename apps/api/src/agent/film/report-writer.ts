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
import type { FilmRead } from './read.js';
import { briefBlock, RULES } from './writer.js';

export type { WrittenReport } from '../launch/report-writer.js';

export type ReportWriteInput = LaunchReportWriteInput<FilmRead>;
export type ReportWriter = LaunchReportWriter<FilmRead>;

export const REPORT_WRITER_SYSTEM = `You write two short lists for an audit of a launch plan, for Oraqul, from findings measured in Qloo taste data and your launch knowledge. The verdicts on the plan's beliefs are already decided and given to you. You never change them and never write a number of your own.

${RULES}

- risks: what could go wrong with this plan, most serious first, one to three sentences each with what to do about it. Write one for every belief that is weak or breaks, and one for each belief that could not be tested and matters. A risk about taste or audience is grounded and cites its finding. If results are given, say where the launch fell short of the plan.
- alternatives: stronger options the findings point to, such as a city, a partner brand or an artist that ranks higher. Every alternative cites the finding that names it. Never tell the team to drop a city, a comp or a partner they chose: suggest what to add beside it or what to do first.
- Never say a belief "holds", "breaks" or "is weak" in your own words; the verdict pill says it.`;

export const filmReportKit: ReportKit<FilmRead> = {
  system: REPORT_WRITER_SYSTEM,
  brief: briefBlock,
  audience: 'your comps’ audience',
  compsRisk:
    'The comps may speak to different audiences, so one title can skew the whole read: check what each one signals on its own.',
};

export class ModelReportWriter extends LaunchModelReportWriter<FilmRead> {
  constructor(model: LanguageModel, timeoutMs: number, options: ProviderOptions = {}) {
    super(model, timeoutMs, filmReportKit, options);
  }
}

/** Falls back to the template writer when the model fails, so a report never stops at writing. */
export class FallbackReportWriter extends LaunchFallbackReportWriter<FilmRead> {}

/** Writes the lists from the verdicts alone, for runs with no model key or when the model fails. */
export class TemplateReportWriter extends LaunchTemplateReportWriter<FilmRead> {
  constructor() {
    super(filmReportKit);
  }
}
