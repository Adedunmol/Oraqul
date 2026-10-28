import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  cityNames,
  demoFetch,
  QlooClient,
  type SeenEntity,
  type ToolContext,
} from '@oraqul/engine';
import { verdictSchema } from '@oraqul/schema';
import { z } from 'zod';
import type { Handoff, Reply } from '../category-agents.js';
import { ungroundedLines } from '../grounding.js';
import { analysisSchema } from '../launch/analyse.js';
import { clearBaselineCache } from '../launch/baseline.js';
import { FixtureAnalyst } from '../launch/fixture-analyst.js';
import { groundingReport } from '../launch/grounding-report.js';
import type { PlanRun } from '../launch/pipeline.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedBooksReader } from './read.js';
import { NoResearch } from './research.js';
import { runBooksBuild } from './runs.js';
import { TemplatePlanWriter } from './writer.js';

// Golden runs (docs/testing.md): the same input must give the same findings and verdicts every
// time. The wording is checked by rules, not compared, because a model writes it live. Books has no
// recorded live runs yet.
// Release dates are far in the future so the launch beats do not change with the day it runs.

const dir = fileURLToPath(new URL('../../../../../packages/eval/golden/books/', import.meta.url));

const expectSchema = z.object({
  headline: z.string(),
  assumptions: z.record(z.string(), verdictSchema),
  // The markets, as the plan ranks them.
  cities: z.array(z.string()),
  comps: z.array(z.object({ name: z.string(), source: z.enum(['you', 'added', 'genre']) })),
  // Each finding's id and the first three names it returned.
  findings: z.record(z.string(), z.array(z.string())),
  // Lines per section by kind, as `grounded/playbook`.
  sections: z.record(z.string(), z.string()),
  moves: z.array(z.string().nullable()),
  grounding: z.object({
    lines: z.number().int(),
    backed: z.number().int(),
    rankKept: z.number().int(),
    findingsUsed: z.number().int(),
    cities: z.record(z.string(), z.number().int()),
  }),
  dropped: z.number().int(),
  cannot: z.array(z.string()),
});
type Expected = z.infer<typeof expectSchema>;

const caseSchema = z.object({
  title: z.string(),
  brief: z.string(),
  // What a model analyst would have answered, so the chosen-comps path is tested without a model.
  analysis: analysisSchema.optional(),
  replies: z.array(
    z.union([z.object({ optionIds: z.array(z.string()) }), z.object({ text: z.string() })]),
  ),
  // An expectation in an older shape reads as missing, so `UPDATE_GOLDEN=1` can replace it.
  expect: expectSchema.nullable().catch(null),
});
type GoldenCase = z.infer<typeof caseSchema>;

async function run(golden: GoldenCase) {
  clearBaselineCache();
  const said = { text: golden.brief, files: [] };
  const handoff: Handoff = {
    category: 'books',
    mode: 'build',
    title: golden.title,
    inputs: said,
    message: said,
    recent: [],
    planId: null,
  };
  const deps = () => {
    const tools: ToolContext = {
      qloo: new QlooClient({
        baseUrl: 'https://demo.invalid',
        apiKey: 'golden',
        fetch: demoFetch,
        callBudget: 120,
        retryDelayMs: 0,
      }),
      source: 'demo',
      entities: new Map<string, SeenEntity>(),
    };
    return {
      reader: new ScriptedBooksReader(),
      ...(golden.analysis ? { analyst: new FixtureAnalyst(golden.analysis) } : {}),
      queries: new ScriptedQueryPlanner(),
      research: new NoResearch(),
      writer: new TemplatePlanWriter(),
      tools,
      emit: () => undefined,
    };
  };
  let result: PlanRun = await runBooksBuild(handoff, deps());
  for (const r of golden.replies) {
    if (result.state?.job !== 'build' || !result.state.pending) break;
    const reply: Reply =
      'optionIds' in r
        ? { kind: 'options', questionId: result.state.pending.id, optionIds: r.optionIds }
        : { kind: 'typed', text: r.text };
    result = await runBooksBuild(handoff, deps(), { state: result.state, reply });
  }
  return result;
}

function summarise(result: PlanRun): Expected {
  const output = result.output;
  if (!output?.plan) throw new Error(`The run stopped ${result.reason} with no plan`);
  const b = output.brief;
  const plan = output.plan;
  const count = (kind: string, lines: { kind: string }[]) =>
    lines.filter((l) => l.kind === kind).length;
  return {
    headline: output.headline,
    assumptions: Object.fromEntries(b.assumptions.map((a) => [a.id, a.verdict])),
    cities: b.places.map((p) => p.name),
    comps: plan.comps.map(({ name, source }) => ({ name, source })),
    findings: Object.fromEntries(
      plan.findings.map((f) => [f.id, f.entities.slice(0, 3).map((e) => e.name)]),
    ),
    sections: Object.fromEntries(
      plan.sections.map((s) => [
        s.key,
        `${count('grounded', s.lines)}/${count('playbook', s.lines)}`,
      ]),
    ),
    moves: output.moves.map((m) => m.lineId),
    grounding: (({ lines, backed, rankKept, findingsUsed, cities }) => ({
      lines,
      backed,
      rankKept,
      findingsUsed,
      cities,
    }))(
      groundingReport(
        plan,
        b.places.map((p) => p.name),
      ),
    ),
    dropped: plan.dropped.length,
    cannot: b.cannot.map((c) => c.item),
  };
}

// The rules every plan's wording must keep (spec §6.2): the bottom line names only the regions
// the plan ranked, no line shows a receipt or call id, and every grounded line cites a finding.
function checkRules(result: PlanRun, teamCities: string[]) {
  const plan = result.output?.plan;
  if (!plan) throw new Error('Expected a plan');
  const ids = new Set(plan.findings.map((f) => f.id));
  const bottom = plan.sections.find((s) => s.key === 'bottom-line')?.lines ?? [];
  for (const line of bottom) {
    for (const city of cityNames()) {
      if (line.text.includes(city)) expect(teamCities).toContain(city);
    }
  }
  for (const line of plan.sections.flatMap((s) => s.lines)) {
    expect(line.text).not.toMatch(/receipt|[0-9a-f]{8}-[0-9a-f]{4}-/i);
    if (line.kind === 'grounded') {
      expect(line.findingIds.length).toBeGreaterThan(0);
      for (const id of line.findingIds) expect(ids.has(id)).toBe(true);
    }
  }
}

const cases = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('Books golden runs on demo data', { timeout: 20_000 }, () => {
  it('has the Books build inputs', () => {
    expect(cases.length).toBeGreaterThanOrEqual(7);
  });

  it.each(cases)('%s', async (file) => {
    const golden = caseSchema.parse(JSON.parse(readFileSync(`${dir}${file}`, 'utf8')));
    const result = await run(golden);
    expect(result.reason).toBe('finished');
    const output = result.output;
    if (!output) throw new Error('Expected a plan');
    // Grounding: every tested line has a receipt and names only what Qloo returned.
    expect(ungroundedLines(output.brief, result.receipts)).toEqual([]);
    checkRules(
      result,
      output.brief.places.map((p) => p.name),
    );
    const got = summarise(result);
    if (process.env.UPDATE_GOLDEN === '1') {
      writeFileSync(`${dir}${file}`, `${JSON.stringify({ ...golden, expect: got }, null, 2)}\n`);
      return;
    }
    expect(golden.expect).not.toBeNull();
    expect(got).toEqual(golden.expect);
  });
});
