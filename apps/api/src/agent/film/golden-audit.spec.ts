import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { type AuditReport, verdictSchema } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Handoff, NewOutput, Reply } from '../category-agents.js';
import { type AuditDeps, runFilmAudit } from './audit.js';
import { clearBaselineCache } from './baseline.js';
import { runFilmFix } from './fix.js';
import type { PlanRun } from './pipeline.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedFilmReader } from './read.js';
import { TemplateReportWriter } from './report-writer.js';
import { NoResearch } from './research.js';
import { ScriptedResultsReader } from './results-read.js';
import { TemplatePlanWriter } from './writer.js';

// Golden runs for audit and fix (docs/testing.md): the same plan must give the same verdicts, the
// same gaps against its results and the same chain of outputs every time. The wording is checked
// by rules, not compared, because a model writes it live.

const dir = fileURLToPath(
  new URL('../../../../../packages/eval/golden/film-audit/', import.meta.url),
);

const expectSchema = z.object({
  /** The kinds the run saved, oldest first. */
  outputs: z.array(z.string()),
  headline: z.string(),
  phase: z.enum(['pre', 'post']),
  items: z.record(z.string(), verdictSchema),
  /** The ids of the items that have a fix line. */
  fixes: z.array(z.string()),
  findings: z.record(z.string(), z.array(z.string())),
  /** Place and how its results compare with the plan, in the order they finished. */
  results: z.array(z.string()),
  brokeItem: z.string().nullable(),
  risks: z.number().int(),
  alternatives: z.number().int(),
  dropped: z.number().int(),
  /** For a fix: the sections of the plan it wrote, as `grounded/playbook` lines. */
  plan: z.record(z.string(), z.string()).nullable(),
});
type Expected = z.infer<typeof expectSchema>;

const caseSchema = z.object({
  mode: z.enum(['audit', 'fix']),
  title: z.string(),
  text: z.string(),
  replies: z.array(
    z.union([z.object({ optionIds: z.array(z.string()) }), z.object({ text: z.string() })]),
  ),
  expect: expectSchema.nullable().catch(null),
});
type GoldenCase = z.infer<typeof caseSchema>;

async function run(golden: GoldenCase): Promise<PlanRun> {
  clearBaselineCache();
  const said = { text: golden.text, files: [] };
  const handoff: Handoff = {
    category: 'film',
    mode: golden.mode,
    title: golden.title,
    inputs: said,
    message: said,
    recent: [],
    planId: null,
  };
  const deps = (): AuditDeps => {
    const tools: ToolContext = {
      qloo: new QlooClient({
        baseUrl: 'https://demo.invalid',
        apiKey: 'golden',
        fetch: demoFetch,
        callBudget: 80,
        retryDelayMs: 0,
      }),
      source: 'demo',
      entities: new Map<string, SeenEntity>(),
    };
    return {
      reader: new ScriptedFilmReader(),
      queries: new ScriptedQueryPlanner(),
      research: new NoResearch(),
      writer: new TemplatePlanWriter(),
      results: new ScriptedResultsReader(),
      report: new TemplateReportWriter(),
      tools,
      emit: () => undefined,
    };
  };
  const start = (resume?: { state: never; reply: Reply }) =>
    golden.mode === 'audit'
      ? runFilmAudit(handoff, deps(), resume)
      : runFilmFix(handoff, deps(), resume);
  let result = await start();
  for (const r of golden.replies) {
    const pending = result.state?.pending;
    if (!result.state || !pending) break;
    const reply: Reply =
      'optionIds' in r
        ? { kind: 'options', questionId: pending.id, optionIds: r.optionIds }
        : { kind: 'typed', text: r.text };
    result = await start({ state: result.state as never, reply });
  }
  return result;
}

function reportOf(result: PlanRun): { report: AuditReport; outputs: NewOutput[] } {
  const outputs = [...(result.earlier ?? []), ...(result.output ? [result.output] : [])];
  const report = outputs.find((o) => o.kind === 'audit')?.report;
  if (!report) throw new Error(`The run stopped ${result.reason} with no report`);
  return { report, outputs };
}

function summarise(result: PlanRun): Expected {
  const { report, outputs } = reportOf(result);
  const plan = outputs.find((o) => o.kind === 'fix')?.plan;
  const audit = outputs.find((o) => o.kind === 'audit');
  const count = (kind: string, lines: { kind: string }[]) =>
    lines.filter((l) => l.kind === kind).length;
  return {
    outputs: outputs.map((o) => o.kind),
    headline: audit?.headline ?? '',
    phase: report.phase,
    items: Object.fromEntries(report.items.map((i) => [i.id, i.verdict])),
    fixes: report.items.flatMap((i) => (i.fix ? [i.id] : [])),
    findings: Object.fromEntries(
      report.findings.map((f) => [f.id, f.entities.slice(0, 3).map((e) => e.name)]),
    ),
    results: report.results?.rows.map((r) => `${r.place}:${r.gap}`) ?? [],
    brokeItem: report.results?.brokeItemId ?? null,
    risks: report.risks.length,
    alternatives: report.alternatives.length,
    dropped: report.dropped.length,
    plan: plan
      ? Object.fromEntries(
          plan.sections.map((s) => [
            s.key,
            `${count('grounded', s.lines)}/${count('playbook', s.lines)}`,
          ]),
        )
      : null,
  };
}

// The rules every report's wording must keep: nothing is ever advised to drop, no line shows a
// receipt or call id, and every grounded line cites a finding of the run (spec §6.2, §6.3).
function checkRules(result: PlanRun) {
  const { report, outputs } = reportOf(result);
  const ids = new Set(report.findings.map((f) => f.id));
  const lines = [
    ...report.risks,
    ...report.alternatives,
    ...report.items.flatMap((i) => (i.fix ? [i.fix] : [])),
    ...(outputs.find((o) => o.kind === 'fix')?.plan?.sections.flatMap((s) => s.lines) ?? []),
  ];
  for (const line of lines) {
    expect(line.text).not.toMatch(/receipt|[0-9a-f]{8}-[0-9a-f]{4}-/i);
    if (line.kind === 'grounded') {
      expect(line.findingIds.length).toBeGreaterThan(0);
      for (const id of line.findingIds) {
        expect(ids.has(id) || (outputs.at(-1)?.plan?.findings ?? []).some((f) => f.id === id)).toBe(
          true,
        );
      }
    }
  }
  for (const item of report.items) {
    if (item.fix) expect(item.fix.text).not.toMatch(/\b(drop|remove|cut|abandon)\b/i);
  }
}

const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('Film audit and fix golden runs on demo data', { timeout: 30_000 }, () => {
  it('has an audit and a fix, before and after launch', () => {
    const modes = files.map((f) => {
      const g = caseSchema.parse(JSON.parse(readFileSync(`${dir}${f}`, 'utf8')));
      return `${g.mode}:${g.expect?.phase ?? '?'}`;
    });
    expect(modes).toEqual(
      expect.arrayContaining(['audit:pre', 'audit:post', 'fix:pre', 'fix:post']),
    );
  });

  it.each(files)('%s', async (file) => {
    const golden = caseSchema.parse(JSON.parse(readFileSync(`${dir}${file}`, 'utf8')));
    const result = await run(golden);
    expect(result.reason).toBe('finished');
    checkRules(result);
    const got = summarise(result);
    if (process.env.UPDATE_GOLDEN === '1') {
      writeFileSync(`${dir}${file}`, `${JSON.stringify({ ...golden, expect: got }, null, 2)}\n`);
      return;
    }
    expect(golden.expect).not.toBeNull();
    expect(got).toEqual(golden.expect);
    // A fix saves the report first and the plan second, each the child of the one before.
    if (golden.mode === 'fix') expect(got.outputs).toEqual(['audit', 'fix']);
    else expect(got.outputs).toEqual(['audit']);
  });
});
