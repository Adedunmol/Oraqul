import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { auditReportSchema, launchPlanSchema, type ThreadEvent } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import type { Handoff, Reply } from '../category-agents.js';
import type { PlanRun } from '../launch/pipeline.js';
import { ScriptedResultsReader } from '../launch/results-read.js';
import type { AuditState, FixState } from '../launch/state.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedMusicReader } from './read.js';
import { TemplateReportWriter } from './report-writer.js';
import { NoResearch } from './research.js';
import { type MusicAuditDeps, musicAuditInputsSchema, runMusicAudit, runMusicFix } from './runs.js';
import { TemplatePlanWriter } from './writer.js';

const PLAN =
  'Night Songs launch plan. An afrobeats album from artist "Neon Tide" for people aged 25 to 34, touring Lagos, London and Houston, with support from "Sade Rhythm". Sound-alikes: "Ada Lux" and "Kola Wave".';
const RESULTS = 'It came out last month.\nLagos: 300\nLondon: 4,200\nHouston: 900';

function setup(text: string, mode: Handoff['mode'], callBudget = 80) {
  const events: ThreadEvent[] = [];
  const said = { text, files: [] };
  const handoff: Handoff = {
    category: 'music',
    mode,
    title: 'Night Songs',
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
  const deps = (): MusicAuditDeps => ({
    reader: new ScriptedMusicReader(),
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

describe('Music audit on demo data', { timeout: 20_000 }, () => {
  it('tests the tour order and a named support act, and saves a report, not a plan', async () => {
    const { events, handoff, deps } = setup(PLAN, 'audit');
    const run = await runMusicAudit(handoff, deps());
    expect(run.reason).toBe('finished');
    const output = run.output;
    if (!output?.report) throw new Error('Expected a report');
    expect(output.kind).toBe('audit');
    expect(output.plan).toBeNull();
    const report = auditReportSchema.parse(output.report);
    expect(report.phase).toBe('pre');

    const byId = new Map(report.items.map((i) => [i.id, i]));
    for (const id of ['a-age', 'a-place-lagos', 'a-comps', 'a-route', 'a-artist-sade-rhythm']) {
      expect(byId.has(id), id).toBe(true);
    }
    // The tour order is a belief of its own, tested by code from the heatmap lifts.
    expect(byId.get('a-route')?.subject).toBe('other');
    expect(byId.get('a-route')?.findingIds).toEqual(['f-a-route']);
    // A named support act is placed among the artists Qloo ranked for the audience.
    const act = byId.get('a-artist-sade-rhythm');
    expect(act?.subject).toBe('artist');
    expect(act?.verdict).toBe('holds');
    expect(act?.source).toContain('Your message');

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
    expect(output.headline).toMatch(/assumptions in your plan hold/);
    expect(events.some((e) => e.type === 'question')).toBe(false);
    expect(
      events.filter((e) => e.type === 'trace.step').map((e) => e.type === 'trace.step' && e.step),
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('asks for the plan when the message holds nothing to test, then goes on', async () => {
    const { handoff, deps } = setup('Check my plan', 'audit');
    const first = await runMusicAudit(handoff, deps());
    const state = auditState(first);
    expect(state.pending?.id).toBe('audit.plan');

    const done = await runMusicAudit(handoff, deps(), { state, reply: typed(PLAN) });
    expect(done.reason).toBe('finished');
    expect(done.output?.report?.items.length).toBeGreaterThan(0);
  });

  it('asks for results once when the launch is out, and compares them with the plan', async () => {
    const { handoff, deps } = setup(`${PLAN}\nIt came out last month.`, 'audit');
    const first = await runMusicAudit(handoff, deps());
    const state = auditState(first);
    expect(state.pending?.id).toBe('audit.results');

    const done = await runMusicAudit(handoff, deps(), { state, reply: typed(RESULTS) });
    expect(done.reason).toBe('finished');
    const report = done.output?.report;
    if (!report?.results) throw new Error('Expected results in the report');
    expect(report.phase).toBe('post');
    expect(report.results.rows.map((r) => r.place)).toEqual(['London', 'Houston', 'Lagos']);
    expect(report.results.rows.find((r) => r.place === 'Lagos')?.gap).toBe('under');
  });

  it('stops without saving when the Qloo call budget is spent', async () => {
    const { handoff, deps } = setup(PLAN, 'audit', 1);
    const run = await runMusicAudit(handoff, deps());
    expect(run.reason).toBe('budget');
    expect(run.output).toBeNull();
  });
});

describe('Music fix on demo data', { timeout: 30_000 }, () => {
  it('audits the plan first, saves the report, then a plan written from it', async () => {
    const { events, handoff, deps } = setup(`${PLAN}\nWe have not launched yet.`, 'fix');
    const state = fixState(await runMusicFix(handoff, deps()));
    expect(state.pending?.id).toBe('fix.phase');

    const run = await runMusicFix(handoff, deps(), {
      state,
      reply: { kind: 'options', questionId: 'fix.phase', optionIds: ['pre'] },
    });
    expect(run.reason).toBe('finished');
    expect(run.earlier?.map((o) => o.kind)).toEqual(['audit']);
    const plan = run.output;
    if (!plan?.plan) throw new Error('Expected a plan');
    expect(plan.kind).toBe('fix');
    launchPlanSchema.parse(plan.plan);
    // The team's cities stay in the fixed plan.
    expect(plan.brief.places.map((p) => p.name).sort()).toEqual(['Houston', 'Lagos', 'London']);
    expect(events.filter((e) => e.type === 'message')).toHaveLength(2);
  });

  it('writes only the plan when it fixes a report that is already saved', async () => {
    const { handoff, deps } = setup(PLAN, 'audit');
    const audited = await runMusicAudit(handoff, deps());
    const inputs = audited.output?.inputs;
    if (!inputs) throw new Error('Expected audit inputs');

    const again = setup(PLAN, 'fix');
    const run = await runMusicFix(again.handoff, again.deps(), undefined, {
      from: { inputs: musicAuditInputsSchema.parse(inputs) },
    });
    expect(run.reason).toBe('finished');
    expect(run.earlier).toBeUndefined();
    expect(run.output?.kind).toBe('fix');
  });
});
