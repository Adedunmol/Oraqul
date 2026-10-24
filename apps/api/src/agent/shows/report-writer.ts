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
import type { ShowsRead } from './read.js';
import { briefBlock, RULES } from './writer.js';

export type ReportWriteInput = LaunchReportWriteInput<ShowsRead>;
export type ReportWriter = LaunchReportWriter<ShowsRead>;

export const REPORT_WRITER_SYSTEM = `You write two short lists for an audit of a live show launch plan, for Oraqul, from findings measured in Qloo taste data and your launch knowledge. The verdicts on the plan's beliefs are already decided and given to you. You never change them and never write a number of your own.

${RULES}

- risks: what could go wrong with this plan, most serious first, one to three sentences each with what to do about it. Write one for every belief that is weak or breaks, and one for each belief that could not be tested and matters. A risk about taste or audience is grounded and cites its finding.
- alternatives: stronger options the findings point to, such as a city, a sponsor or a venue that ranks higher. Every alternative cites the finding that names it. Never tell the team to drop a city, a comparable act or a partner they chose: suggest what to add beside it or what to do first.
- Never say a belief "holds", "breaks" or "is weak" in your own words; the verdict pill says it.
- The plan's on-sale window, presale, final push and rival dates are checked against the launch rules by code. Do not judge them.`;

export const showsReportKit: ReportKit<ShowsRead> = {
  system: REPORT_WRITER_SYSTEM,
  brief: briefBlock,
  audience: 'your act’s audience',
  compsRisk:
    'The comparable acts may speak to different audiences, so one name can skew the whole read: check what each one signals on its own.',
  otherRisk: () => null,
};

export class ModelReportWriter extends LaunchModelReportWriter<ShowsRead> {
  constructor(model: LanguageModel, timeoutMs: number, options: ProviderOptions = {}) {
    super(model, timeoutMs, showsReportKit, options);
  }
}

/** Falls back to the template writer when the model fails, so a report never stops at writing. */
export class FallbackReportWriter extends LaunchFallbackReportWriter<ShowsRead> {}

/** Writes the lists from the verdicts alone, for runs with no model key or when the model fails. */
export class TemplateReportWriter extends LaunchTemplateReportWriter<ShowsRead> {
  constructor() {
    super(showsReportKit);
  }
}
