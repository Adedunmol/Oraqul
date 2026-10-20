import type { OutputDetail } from '@oraqul/schema';

/**
 * What a read only link shows: the output as the team reads it, minus what only the team may see.
 * A receipt keeps its endpoint, rule, confidence and time, and loses what was sent to Qloo and what
 * came back, because Qloo has not said that raw data may be shown publicly (PRD O4). The other
 * outputs, the chat and the project's private fields stay out too.
 */
export function redactForShare(detail: OutputDetail): OutputDetail {
  const { output, project, thread } = detail;
  return {
    output: {
      ...output,
      createdBy: '',
      receipts: output.receipts.map((r) => ({ ...r, input: {}, returned: null })),
      plan: output.plan ? { ...output.plan, dropped: [] } : null,
      report: output.report ? { ...output.report, dropped: [] } : null,
    },
    project: { ...project, qlooMatch: null, extra: {} },
    thread: {
      ...thread,
      name: '',
      createdBy: '',
      baseOutputId: null,
      fromOutputId: null,
    },
    builtOn: null,
    share: null,
  };
}
