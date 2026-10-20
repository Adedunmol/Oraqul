import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { auditReportSchema, launchPlanSchema, type ThreadEvent } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import type { Handoff, Reply } from '../category-agents.js';
import type { PlanRun } from '../launch/pipeline.js';
import { ScriptedResultsReader } from '../launch/results-read.js';
import type { AuditState, FixState } from '../launch/state.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedGamesReader } from './read.js';
import { TemplateReportWriter } from './report-writer.js';
import { NoResearch } from './research.js';
import { type GamesAuditDeps, gamesAuditInputsSchema, runGamesAudit, runGamesFix } from './runs.js';
import { TemplatePlanWriter } from './writer.js';

const PLAN =
  'Ember Keep launch plan. The game "Ember Keep", a roguelike for Steam and Xbox for people aged 25 to 34, launching in London and Berlin. Comparable games: "Hollow Hills" and "Crown of Ash". Collab with "Pixel Choir". Store tags: Roguelike, Indie.';
const RESULTS = 'It came out last month.\nLondon: 300\nBerlin: 4,200';

function setup(text: string, mode: Handoff['mode'], callBudget = 90) {
  const events: ThreadEvent[] = [];
  const said = { text, files: [] };
  const handoff: Handoff = {
    category: 'games',
    mode,
    title: 'Ember Keep',
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
  const deps = (): GamesAuditDeps => ({
    reader: new ScriptedGamesReader(),
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

describe('Games audit on demo data', { timeout: 30_000 }, () => {
  it('tests the platforms, the store tags and a named collab, and saves a report, not a plan', async () => {
    const { handoff, deps } = setup(PLAN, 'audit');
    const run = await runGamesAudit(handoff, deps());
    expect(run.reason).toBe('finished');
    const output = run.output;
    if (!output?.report) throw new Error('Expected a report');
    expect(output.kind).toBe('audit');
    expect(output.plan).toBeNull();
    const report = auditReportSchema.parse(output.report);

    const byId = new Map(report.items.map((i) => [i.id, i]));
    for (const id of ['a-age', 'a-place-london', 'a-comps', 'a-platform', 'a-store-tags']) {
      expect(byId.has(id), id).toBe(true);
    }
    // The beliefs only Games tests are `other`, and cite the finding that tested them.
    expect(byId.get('a-platform')?.subject).toBe('other');
    expect(byId.get('a-platform')?.findingIds).toEqual(['f-a-platform']);
    expect(byId.get('a-store-tags')?.subject).toBe('other');
    // Xbox is not where the demo comps live, so the platform belief is not a plain hold.
    expect(byId.get('a-platform')?.verdict).not.toBe('holds');

    // A named collab is placed among the partners Qloo scored in its medium.
    const collab = byId.get('a-collab-pixel-choir');
    expect(collab?.subject).toBe('media');
    expect(collab?.source).toContain('Your message');
    expect(collab?.findingIds).toEqual(['f-fan-collab-pixel-choir']);

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
    const state = auditState(await runGamesAudit(handoff, deps()));
    expect(state.pending?.id).toBe('audit.plan');

    const done = await runGamesAudit(handoff, deps(), { state, reply: typed(PLAN) });
    expect(done.reason).toBe('finished');
    expect(done.output?.report?.items.length).toBeGreaterThan(0);
  });

  it('asks for results once when the launch is out, and compares them with the plan', async () => {
    const { handoff, deps } = setup(`${PLAN}\nIt came out last month.`, 'audit');
    const state = auditState(await runGamesAudit(handoff, deps()));
    expect(state.pending?.id).toBe('audit.results');

    const done = await runGamesAudit(handoff, deps(), { state, reply: typed(RESULTS) });
    expect(done.reason).toBe('finished');
    const report = done.output?.report;
    if (!report?.results) throw new Error('Expected results in the report');
    expect(report.phase).toBe('post');
    expect(report.results.rows.map((r) => r.place).sort()).toEqual(['Berlin', 'London']);
  });

  it('stops without saving when the Qloo call budget is spent', async () => {
    const { handoff, deps } = setup(PLAN, 'audit', 1);
    const run = await runGamesAudit(handoff, deps());
    expect(run.reason).toBe('budget');
    expect(run.output).toBeNull();
  });
});

describe('Games fix on demo data', { timeout: 30_000 }, () => {
  it('audits the plan first, saves the report, then a plan written from it', async () => {
    const { handoff, deps } = setup(`${PLAN}\nWe have not launched yet.`, 'fix');
    const state = fixState(await runGamesFix(handoff, deps()));
    expect(state.pending?.id).toBe('fix.phase');

    const run = await runGamesFix(handoff, deps(), {
      state,
      reply: { kind: 'options', questionId: 'fix.phase', optionIds: ['pre'] },
    });
    expect(run.reason).toBe('finished');
    expect(run.earlier?.map((o) => o.kind)).toEqual(['audit']);
    const plan = run.output;
    if (!plan?.plan) throw new Error('Expected a plan');
    expect(plan.kind).toBe('fix');
    launchPlanSchema.parse(plan.plan);
    // The team's regions and collab stay in the fixed plan.
    expect(plan.brief.places.map((p) => p.name).sort()).toEqual(['Berlin', 'London']);
    expect(plan.brief.fan?.some((f) => f.name === 'Pixel Choir')).toBe(true);
  });

  it('writes only the plan when it fixes a report that is already saved', async () => {
    const { handoff, deps } = setup(PLAN, 'audit');
    const audited = await runGamesAudit(handoff, deps());
    const inputs = audited.output?.inputs;
    if (!inputs) throw new Error('Expected audit inputs');

    const again = setup(PLAN, 'fix');
    const run = await runGamesFix(again.handoff, again.deps(), undefined, {
      from: { inputs: gamesAuditInputsSchema.parse(inputs) },
    });
    expect(run.reason).toBe('finished');
    expect(run.earlier).toBeUndefined();
    expect(run.output?.kind).toBe('fix');
  });
});
