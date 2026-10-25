'use client';

import type { Verdict } from '@oraqul/schema';
import { ChipButton, Confidence, ReceiptChip, VerdictPill } from '@oraqul/ui';
import { useState } from 'react';
import { ChartCard, VerdictBar, verdictTable } from '../charts';
import { useOutputView } from './context';
import { Line, Mark, Stack, TabTitle } from './line';
import { ReportItems, ReportLines, ReportResults, RuleChecks } from './report-document';
import { PlanTab } from './tabs-core';

type Filter = Verdict | 'all';

const reportPaper =
  'max-w-[780px] rounded-2xl bg-card px-5 py-7 shadow-none! min-[640px]:px-10 min-[640px]:py-10 min-[900px]:px-14';

/** The audit's assumptions: every belief the plan rests on, with its verdict and where it says so. */
export function ReportAssumptionsTab() {
  const { output, openReceipt } = useOutputView();
  const report = output.report;
  const [filter, setFilter] = useState<Filter>('all');
  if (!report) return null;
  const filters: [Filter, string][] = [
    ['all', 'All'],
    ['breaks', 'Breaks'],
    ['weak', 'Weak'],
    ['holds', 'Holds'],
    ['cant', 'Could not test'],
  ];
  return (
    <>
      <TabTitle
        title="Assumptions"
        note="Every belief your plan rests on, stated and unstated. Each has a verdict and a receipt."
      />
      <ChartCard title="Verdicts" table={verdictTable(output.counts)}>
        <VerdictBar counts={output.counts} />
      </ChartCard>
      <div className="flex flex-wrap gap-2">
        {filters.map(([key, label]) => (
          <ChipButton key={key} selected={filter === key} onClick={() => setFilter(key)}>
            {label}
            {key === 'all' ? '' : ` ${output.counts[key]}`}
          </ChipButton>
        ))}
      </div>
      <article className={reportPaper}>
        <ReportItems
          report={report}
          only={filter === 'all' ? undefined : filter}
          onSource={(id) => openReceipt(id)}
        />
        <div className="mt-10">
          <RuleChecks checks={report.ruleChecks} />
        </div>
      </article>
    </>
  );
}

/** What could go wrong with the plan. On an older output, the risks at the end of its plan. */
export function RisksTab() {
  const { output, openReceipt } = useOutputView();
  if (!output.report) return <PlanTab />;
  return (
    <article className={reportPaper}>
      <ReportLines
        title="Risks"
        lines={output.report.risks}
        report={output.report}
        onSource={(id) => openReceipt(id)}
      />
      {output.report.risks.length === 0 ? (
        <p className="text-muted">No risks were found to write up.</p>
      ) : null}
    </article>
  );
}

/** Stronger options the data points to, beside the team's own choices. */
export function AlternativesTab() {
  const { output, openReceipt } = useOutputView();
  const report = output.report;
  if (!report) return null;
  return (
    <article className={reportPaper}>
      <ReportLines
        title="Worth a look"
        lines={report.alternatives}
        report={report}
        onSource={(id) => openReceipt(id)}
      />
      {report.alternatives.length === 0 ? (
        <p className="text-muted">
          Nothing in the data pointed to a stronger option than the ones in your plan.
        </p>
      ) : null}
    </article>
  );
}

export function ReportResultsTab() {
  const { output } = useOutputView();
  if (!output.report?.results) return null;
  return (
    <article className={reportPaper}>
      <ReportResults results={output.report.results} />
    </article>
  );
}

/**
 * On a fixed plan: what the audit found weak or broken, beside what the new plan does about it.
 * The plan keeps every choice the team made, so a fix reorders or adds and never removes.
 */
export function FixesTab() {
  const { output, openReceipt, goToTab } = useOutputView();
  const report = output.report;
  if (!report) return null;
  const items = report.items.filter((i) => i.verdict === 'breaks' || i.verdict === 'weak');
  return (
    <>
      <TabTitle
        title="What was fixed"
        note="What the audit found weak or broken in your plan, and what the new plan does about it. Your own choices stay in it."
      />
      <article className={reportPaper}>
        <Stack>
          {items.length ? (
            items.map((i) => (
              <Line
                key={i.id}
                title={i.claim}
                tags={i.unstated ? <Mark>Unstated</Mark> : null}
                side={
                  <>
                    <VerdictPill verdict={i.verdict} />
                    <Confidence level={i.confidence} />
                    {i.findingIds[0] ? (
                      <ReceiptChip
                        onClick={() => openReceipt(i.findingIds[0] ?? '')}
                        aria-label="Open receipt"
                      />
                    ) : null}
                  </>
                }
              >
                <p>{i.why}</p>
                <p className="text-ink">
                  <b>What changed:</b> {i.fix?.text ?? 'Nothing to change in the plan for this.'}
                </p>
              </Line>
            ))
          ) : (
            <p className="text-muted">
              Every assumption that could be tested held, so nothing broke.
            </p>
          )}
        </Stack>
        <div>
          <button
            type="button"
            onClick={() => goToTab('plan')}
            className="text-[13.5px] font-semibold text-accent underline underline-offset-2"
          >
            Back to the plan
          </button>
        </div>
      </article>
    </>
  );
}
