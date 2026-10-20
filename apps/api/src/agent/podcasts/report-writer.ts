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
import type { PodcastsRead } from './read.js';
import { briefBlock, RULES } from './writer.js';

export type ReportWriteInput = LaunchReportWriteInput<PodcastsRead>;
export type ReportWriter = LaunchReportWriter<PodcastsRead>;

export const REPORT_WRITER_SYSTEM = `You write two short lists for an audit of a podcast launch plan, for Oraqul, from findings measured in Qloo taste data and your launch knowledge. The verdicts on the plan's beliefs are already decided and given to you. You never change them and never write a number of your own.

${RULES}

- risks: what could go wrong with this plan, most serious first, one to three sentences each with what to do about it. Write one for every belief that is weak or breaks, and one for each belief that could not be tested and matters. A risk about taste, topics or audience is grounded and cites its finding. If results are given, say where the launch fell short of the plan.
- alternatives: stronger options the findings point to, such as a market, a swap show, a topic or a sponsor that ranks higher. Every alternative cites the finding that names it. Never tell the team to drop a market, a comparable show, a topic, a swap or a sponsor they chose: suggest what to add beside it or what to do first.
- Never say a belief "holds", "breaks" or "is weak" in your own words; the verdict pill says it.`;

const line = (text: string, findingIds: string[], names: string[]): WrittenLine => ({
  kind: 'grounded',
  text,
  findingIds,
  sourceIds: [],
  names,
  group: null,
});

export const podcastsReportKit: ReportKit<PodcastsRead> = {
  system: REPORT_WRITER_SYSTEM,
  brief: briefBlock,
  audience: 'your show’s listeners',
  compsRisk:
    'The comparable shows may speak to different listeners, so one title can skew the whole read: check what each one signals on its own.',
  // The topics the team wants to own are the beliefs of subject `other` that Qloo can test.
  otherRisk: (item: ReportItem) => {
    if (!item.id.startsWith('a-topic-')) return null;
    return line(
      'A topic you want to own is one your listeners share with the rival shows’ listeners, so it will not set the show apart on its own: take an angle on it that the rivals do not.',
      item.findingIds.slice(0, 1),
      [],
    );
  },
};

export class ModelReportWriter extends LaunchModelReportWriter<PodcastsRead> {
  constructor(model: LanguageModel, timeoutMs: number, options: ProviderOptions = {}) {
    super(model, timeoutMs, podcastsReportKit, options);
  }
}

/** Falls back to the template writer when the model fails, so a report never stops at writing. */
export class FallbackReportWriter extends LaunchFallbackReportWriter<PodcastsRead> {}

/** Writes the lists from the verdicts alone, for runs with no model key or when the model fails. */
export class TemplateReportWriter extends LaunchTemplateReportWriter<PodcastsRead> {
  constructor() {
    super(podcastsReportKit);
  }
}
