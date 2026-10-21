import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { auditReportSchema, launchPlanSchema, type ThreadEvent } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import type { Handoff, Reply } from '../category-agents.js';
import type { PlanRun } from '../launch/pipeline.js';
import { ScriptedResultsReader } from '../launch/results-read.js';
import type { AuditState, FixState } from '../launch/state.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedBooksReader } from './read.js';
import { TemplateReportWriter } from './report-writer.js';
import { NoResearch } from './research.js';
import { type BooksAuditDeps, booksAuditInputsSchema, runBooksAudit, runBooksFix } from './runs.js';
import { TemplatePlanWriter } from './writer.js';

const PLAN =
  'The Lagos Ledger launch plan. The book "The Lagos Ledger", a debut literary novel for readers aged 25 to 44, published by an independent press, launching in London and Lagos. Comparable books: "Americanah" and "Purple Hibiscus". Compare it with "Normal People". Bookshop "Terra Kulture".';
const RESULTS = 'It came out last month.\nLondon: 300\nLagos: 4,200';

function setup(text: string, mode: Handoff['mode'], callBudget = 120) {
  const events: ThreadEvent[] = [];
  const said = { text, files: [] };
  const handoff: Handoff = {
    category: 'books',
    mode,
    title: 'The Lagos Ledger',
    inputs: said,
    message: said,
    recent: [],
    planId: null,
  };
  const context = (): ToolContext => ({
    qloo: new QlooClient({
      baseUrl: 'https://demo.invalid',
      apiKey: 'demo',
      fetch: demoFetch,
      callBudget,
      retryDelayMs: 0,
    }),
    source: 'demo',
    entities: new Map<string, SeenEntity>(),
  });
  const deps = (): BooksAuditDeps => ({
    reader: new ScriptedBooksReader(),
    queries: new ScriptedQueryPlanner(),
    research: new NoResearch(),
    writer: new TemplatePlanWriter(),
    results: new ScriptedResultsReader(),
    report: new TemplateReportWriter(),
    tools: context(),
    emit: (e: ThreadEvent) => events.push(e),
  });
  return { events, handoff, deps };
}

function auditState(run: PlanRun): AuditState {
  expect(run.reason).toBe('waiting');
  if (run.state?.job !== 'audit') throw new Error('Expected a paused audit');
  return run.state;
}

function fixState(run: PlanRun): FixState {
  expect(run.reason).toBe('waiting');
  if (run.state?.job !== 'fix') throw new Error('Expected a paused fix');
  return run.state;
}

const typed = (text: string): Reply => ({ kind: 'typed', text });

describe('Books audit on demo data', { timeout: 30_000 }, () => {
  it('tests the comps, a screen comparison and a bookshop, and saves a report, not a plan', async () => {
    const { handoff, deps } = setup(PLAN, 'audit');
    const run = await runBooksAudit(handoff, deps());
    expect(run.reason).toBe('finished');
    const output = run.output;
    if (!output?.report) throw new Error('Expected a report');
    expect(output.kind).toBe('audit');
    expect(output.plan).toBeNull();
    const report = auditReportSchema.parse(output.report);

    const byId = new Map(report.items.map((i) => [i.id, i]));
    for (const id of ['a-age', 'a-place-london', 'a-comps', 'a-comp-age-americanah']) {
      expect(byId.has(id), id).toBe(true);
    }
    // A comp's age is tested in the findings, and cites the finding that tested it.
    expect(byId.get('a-comp-age-americanah')?.findingIds).toEqual(['f-a-comp-age-americanah']);

    // A named screen title is placed among the titles Qloo scored in one call.
    const screen = byId.get('a-screen-normal-people');
    expect(screen?.subject).toBe('media');
    expect(screen?.source).toContain('Your message');
    expect(screen?.findingIds).toEqual(['f-screen-normal-people']);

    // A named bookshop is placed among the bookshops Qloo listed for the city.
    const shop = byId.get('a-shop-terra-kulture');
    expect(shop?.subject).toBe('other');
    expect(shop?.verdict).toBe('holds');

    const findingIds = new Set(report.findings.map((f) => f.id));
    for (const item of report.items) {
      for (const id of item.findingIds) expect(findingIds.has(id)).toBe(true);
      // A team's choices are constraints: a fix reorders or adds, it never says to drop.
      if (item.fix) expect(item.fix.text).not.toMatch(/\b(drop|remove|cut|abandon)\b/i);
    }
    for (const line of [...report.risks, ...report.alternatives]) {
      if (line.kind === 'grounded') {
        expect(line.findingIds.length).toBeGreaterThan(0);
        for (const id of line.findingIds) expect(findingIds.has(id)).toBe(true);
      }
      expect(line.text).not.toMatch(/receipt|[0-9a-f]{8}-[0-9a-f]{4}/i);
    }
    // The window is not in Qloo, so it is never given a verdict.
    expect(byId.get('a-window')).toBeUndefined();
  });

  it('asks for the plan when the message holds nothing to test, then goes on', async () => {
    const { handoff, deps } = setup('Check my plan', 'audit');
    const state = auditState(await runBooksAudit(handoff, deps()));
    expect(state.pending?.id).toBe('audit.plan');

    const done = await runBooksAudit(handoff, deps(), { state, reply: typed(PLAN) });
    expect(done.reason).toBe('finished');
    expect(done.output?.report?.items.length).toBeGreaterThan(0);
  });

  it('asks for results once when the launch is out, and compares them with the plan', async () => {
    const { handoff, deps } = setup(`${PLAN}\nIt came out last month.`, 'audit');
    const state = auditState(await runBooksAudit(handoff, deps()));
    expect(state.pending?.id).toBe('audit.results');

    const done = await runBooksAudit(handoff, deps(), { state, reply: typed(RESULTS) });
    expect(done.reason).toBe('finished');
    const report = done.output?.report;
    if (!report?.results) throw new Error('Expected results in the report');
    expect(report.phase).toBe('post');
    expect(report.results.rows.map((r) => r.place).sort()).toEqual(['Lagos', 'London']);
  });

  it('stops without saving when the Qloo call budget is spent', async () => {
    const { handoff, deps } = setup(PLAN, 'audit', 1);
    const run = await runBooksAudit(handoff, deps());
    expect(run.reason).toBe('budget');
    expect(run.output).toBeNull();
  });
});

describe('Books fix on demo data', { timeout: 30_000 }, () => {
  it('audits the plan first, saves the report, then a plan written from it', async () => {
    const { handoff, deps } = setup(`${PLAN}\nWe have not launched yet.`, 'fix');
    const state = fixState(await runBooksFix(handoff, deps()));
    expect(state.pending?.id).toBe('fix.phase');

    const run = await runBooksFix(handoff, deps(), {
      state,
      reply: { kind: 'options', questionId: 'fix.phase', optionIds: ['pre'] },
    });
    expect(run.reason).toBe('finished');
    expect(run.earlier?.map((o) => o.kind)).toEqual(['audit']);
    const plan = run.output;
    if (!plan?.plan) throw new Error('Expected a plan');
    expect(plan.kind).toBe('fix');
    launchPlanSchema.parse(plan.plan);
    // The team's markets and screen comparison stay in the fixed plan.
    expect(plan.brief.places.map((p) => p.name).sort()).toEqual(['Lagos', 'London']);
    expect(plan.brief.bridge?.some((b) => b.name === 'Normal People')).toBe(true);
  });

  it('writes only the plan when it fixes a report that is already saved', async () => {
    const { handoff, deps } = setup(PLAN, 'audit');
    const audited = await runBooksAudit(handoff, deps());
    const inputs = audited.output?.inputs;
    if (!inputs) throw new Error('Expected audit inputs');

    const again = setup(PLAN, 'fix');
    const run = await runBooksFix(again.handoff, again.deps(), undefined, {
      from: { inputs: booksAuditInputsSchema.parse(inputs) },
    });
    expect(run.reason).toBe('finished');
    expect(run.earlier).toBeUndefined();
    expect(run.output?.kind).toBe('fix');
  });
});
