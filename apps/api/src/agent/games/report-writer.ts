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
import type { GamesRead } from './read.js';
import { briefBlock, RULES } from './writer.js';

export type ReportWriteInput = LaunchReportWriteInput<GamesRead>;
export type ReportWriter = LaunchReportWriter<GamesRead>;

export const REPORT_WRITER_SYSTEM = `You write two short lists for an audit of a video game launch plan, for Oraqul, from findings measured in Qloo taste data and your launch knowledge. The verdicts on the plan's beliefs are already decided and given to you. You never change them and never write a number of your own.

${RULES}

- risks: what could go wrong with this plan, most serious first, one to three sentences each with what to do about it. Write one for every belief that is weak or breaks, and one for each belief that could not be tested and matters. A risk about taste or audience is grounded and cites its finding. If results are given, say where the launch fell short of the plan.
- alternatives: stronger options the findings point to, such as a region, a collab, a platform or a partner brand that ranks higher. Every alternative cites the finding that names it. Never tell the team to drop a region, a comparable game, a collab or a partner they chose: suggest what to add beside it or what to do first.
- Never say a belief "holds", "breaks" or "is weak" in your own words; the verdict pill says it.`;

const line = (text: string, findingIds: string[], names: string[]): WrittenLine => ({
  kind: 'grounded',
  text,
  findingIds,
  sourceIds: [],
  names,
  group: null,
});

export const gamesReportKit: ReportKit<GamesRead> = {
  system: REPORT_WRITER_SYSTEM,
  brief: briefBlock,
  audience: 'your game’s players',
  compsRisk:
    'The comparable games may speak to different players, so one title can skew the whole read: check what each one signals on its own.',
  // The platforms and the store tags are the beliefs of subject `other` that Qloo can test.
  otherRisk: (item: ReportItem) => {
    const first = item.findingIds.slice(0, 1);
    if (item.id === 'a-platform') {
      return line(
        'Some of your comparable games are on a platform you are not shipping to, so their players may meet the game somewhere else: say which platforms you ship on across the store page and the trailer.',
        first,
        [],
      );
    }
    if (item.id === 'a-store-tags') {
      return line(
        'Your store tags differ from what your comparable games carry, so the store may not show the game to their players: add the tags most of them share.',
        first,
        [],
      );
    }
    return null;
  },
};

export class ModelReportWriter extends LaunchModelReportWriter<GamesRead> {
  constructor(model: LanguageModel, timeoutMs: number, options: ProviderOptions = {}) {
    super(model, timeoutMs, gamesReportKit, options);
  }
}

/** Falls back to the template writer when the model fails, so a report never stops at writing. */
export class FallbackReportWriter extends LaunchFallbackReportWriter<GamesRead> {}

/** Writes the lists from the verdicts alone, for runs with no model key or when the model fails. */
export class TemplateReportWriter extends LaunchTemplateReportWriter<GamesRead> {
  constructor() {
    super(gamesReportKit);
  }
}
