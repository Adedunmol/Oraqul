import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { auditReportSchema, launchPlanSchema, type ThreadEvent } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import type { Handoff, Reply } from '../category-agents.js';
import { type AuditDeps, runFilmAudit } from './audit.js';
import { rankVerdict } from './audit-verdicts.js';
import { runFilmFix } from './fix.js';
import type { PlanRun } from './pipeline.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedFilmReader } from './read.js';
import { TemplateReportWriter } from './report-writer.js';
import { NoResearch } from './research.js';
import { compareResults } from './results.js';
import { checkResults, ScriptedResultsReader } from './results-read.js';
import type { AuditState, FixState } from './state.js';
import { TemplatePlanWriter } from './writer.js';

const PLAN =
  'Night Ferry launch plan. A thriller film for women aged 25 to 34, opening in Lagos and London. Comps: "Salt Road", "The Glass Lantern" and "Midnight Harbor".';
const RESULTS = 'It opened last month.\nLagos: 1,100\nLondon: 4,200';

function setup(text: string, mode: Handoff['mode'], callBudget = 80) {
  const events: ThreadEvent[] = [];
  const said = { text, files: [] };
  const handoff: Handoff = {
    category: 'film',
    mode,
    title: 'Night Ferry',
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
  const deps = (): AuditDeps => ({
    reader: new ScriptedFilmReader(),
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

describe('rankVerdict', () => {
  it('holds in the top third, is weak in the middle and breaks in the bottom third', () => {
    expect([1, 2, 3, 4, 5, 6].map((p) => rankVerdict(p, 6))).toEqual([
      'holds',
      'holds',
      'weak',
      'weak',
      'breaks',
      'breaks',
    ]);
  });

  it('does not rank fewer than three candidates', () => {
    expect(rankVerdict(1, 2)).toBe('cant');
  });
});

describe('checkResults', () => {
  const reading = (value: number, quote: string) => ({
    launched: { value: true, quote: 'It opened' },
    measure: null,
    asOf: null,
    byPlace: [{ place: 'Lagos', value, quote }],
    byAge: null,
  });

  it('keeps a result only when the figure is the one written', () => {
    const text = 'It opened last month. Lagos: 1,100';
    expect(checkResults(reading(1100, 'Lagos: 1,100'), text).results?.byPlace).toEqual([
      { place: 'Lagos', value: 1100 },
    ]);
    expect(checkResults(reading(9000, 'Lagos: 1,100'), text).results).toBeNull();
  });

  it('drops a quote that is not in the person’s words', () => {
    expect(checkResults(reading(1100, 'Lagos: 1,100'), 'Lagos did well.').results).toBeNull();
  });
});

describe('compareResults', () => {
  it('finds the city furthest below its planned place', () => {
    const comparison = compareResults({
      planned: ['Lagos', 'London', 'Houston'],
      results: {
        asOf: null,
        measure: 'tickets',
        byPlace: [
          { place: 'London', value: 500 },
          { place: 'Houston', value: 300 },
          { place: 'Lagos', value: 100 },
        ],
        byAge: null,
      },
      findings: [],
      ages: {},
    });
    expect(comparison.rows.map((r) => [r.place, r.actualRank, r.gap])).toEqual([
      ['London', 1, 'over'],
      ['Houston', 2, 'as-planned'],
      ['Lagos', 3, 'under'],
    ]);
    expect(comparison.brokeItemId).toBe('a-place-lagos');
    expect(comparison.rows.reduce((sum, r) => sum + r.actualShare, 0)).toBeCloseTo(100, 0);
  });
});

describe('Film audit on demo data', { timeout: 20_000 }, () => {
  it('tests each assumption in the plan and saves a report, not a plan', async () => {
    const { events, handoff, deps } = setup(PLAN, 'audit');
    const run = await runFilmAudit(handoff, deps());
    expect(run.reason).toBe('finished');
    const output = run.output;
    if (!output?.report) throw new Error('Expected a report');
    expect(output.kind).toBe('audit');
    expect(output.plan).toBeNull();
    expect(run.earlier).toBeUndefined();
    const report = auditReportSchema.parse(output.report);
    expect(report.phase).toBe('pre');
    expect(report.results).toBeNull();

    const ids = report.items.map((i) => i.id);
    expect(ids).toContain('a-place-lagos');
    expect(ids).toContain('a-place-london');
    expect(ids).toContain('a-comps');
    expect(report.items.find((i) => i.id === 'a-comps')?.unstated).toBe(true);

    const findingIds = new Set(report.findings.map((f) => f.id));
    for (const item of report.items) {
      for (const id of item.findingIds) expect(findingIds.has(id)).toBe(true);
      // A team's choices are constraints: a fix reorders or adds, it never says to drop.
      if (item.fix) expect(item.fix.text).not.toMatch(/\b(drop|remove|cut|abandon)\b/i);
      // Where the plan states a belief, the report says where.
      if (item.id === 'a-place-lagos') expect(item.source).toContain('Your message');
    }
    for (const line of [...report.risks, ...report.alternatives]) {
      if (line.kind === 'grounded') {
        expect(line.findingIds.length).toBeGreaterThan(0);
        for (const id of line.findingIds) expect(findingIds.has(id)).toBe(true);
      }
      expect(line.text).not.toMatch(/receipt|[0-9a-f]{8}-[0-9a-f]{4}/i);
    }

    expect(output.headline).toMatch(/assumptions in your plan hold/);
    expect(output.brief.assumptions.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'question')).toBe(false);
    expect(
      events.filter((e) => e.type === 'trace.step').map((e) => e.type === 'trace.step' && e.step),
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('asks for the plan when the message holds nothing to test, then goes on', async () => {
    const { handoff, deps } = setup('Check my plan', 'audit');
    const first = await runFilmAudit(handoff, deps());
    const state = auditState(first);
    expect(state.pending?.id).toBe('audit.plan');
    expect(first.output).toBeNull();

    const done = await runFilmAudit(handoff, deps(), { state, reply: typed(PLAN) });
    expect(done.reason).toBe('finished');
    expect(done.output?.report?.items.length).toBeGreaterThan(0);
  });

  it('asks for results once when the launch is out, and compares them with the plan', async () => {
    const { handoff, deps } = setup(`${PLAN}\nIt opened last month.`, 'audit');
    const first = await runFilmAudit(handoff, deps());
    const state = auditState(first);
    expect(state.pending?.id).toBe('audit.results');

    const done = await runFilmAudit(handoff, deps(), { state, reply: typed(RESULTS) });
    expect(done.reason).toBe('finished');
    const report = done.output?.report;
    if (!report?.results) throw new Error('Expected results in the report');
    expect(report.phase).toBe('post');
    expect(report.results.rows.map((r) => r.place)).toEqual(['London', 'Lagos']);
    expect(report.results.rows.find((r) => r.place === 'Lagos')?.gap).toBe('under');
    expect(report.results.brokeItemId).toBe('a-place-lagos');
    expect(done.output?.headline).toMatch(/fell short where the plan leaned on Lagos/);
    expect(report.risks.some((l) => /Lagos finished/.test(l.text))).toBe(true);
  });

  it('does not ask again when the person skips the results', async () => {
    const { handoff, deps } = setup(`${PLAN}\nIt opened last month.`, 'audit');
    const first = await runFilmAudit(handoff, deps());
    const done = await runFilmAudit(handoff, deps(), {
      state: auditState(first),
      reply: typed('skip'),
    });
    expect(done.reason).toBe('finished');
    expect(done.output?.report?.results).toBeNull();
  });

  it('stops without saving when the Qloo call budget is spent', async () => {
    const { events, handoff, deps } = setup(PLAN, 'audit', 1);
    const run = await runFilmAudit(handoff, deps());
    expect(run.reason).toBe('budget');
    expect(run.output).toBeNull();
    expect(events.some((e) => e.type === 'message')).toBe(true);
  });
});

describe('Film fix on demo data', { timeout: 30_000 }, () => {
  it('audits the plan first, saves the report, then a plan written from it', async () => {
    const { events, handoff, deps } = setup(`${PLAN}\nWe have not launched yet.`, 'fix');
    const first = await runFilmFix(handoff, deps());
    const state = fixState(first);
    expect(state.pending?.id).toBe('fix.phase');

    const run = await runFilmFix(handoff, deps(), {
      state,
      reply: { kind: 'options', questionId: 'fix.phase', optionIds: ['pre'] },
    });
    expect(run.reason).toBe('finished');
    expect(run.earlier?.map((o) => o.kind)).toEqual(['audit']);
    expect(run.earlier?.[0]?.callIds?.length).toBeGreaterThan(0);
    const plan = run.output;
    if (!plan?.plan) throw new Error('Expected a plan');
    expect(plan.kind).toBe('fix');
    expect(plan.report).toBeNull();
    launchPlanSchema.parse(plan.plan);
    expect(plan.plan.sections[0]?.key).toBe('bottom-line');
    // The team's cities stay in the fixed plan.
    expect(plan.brief.places.map((p) => p.name).sort()).toEqual(['Lagos', 'London']);
    expect(events.filter((e) => e.type === 'message')).toHaveLength(2);
  });

  it('asks for results when the launch is out, and orders the cities by how they did', async () => {
    const { handoff, deps } = setup(`${PLAN}\nIt opened last month.`, 'fix');
    const asked = await runFilmFix(handoff, deps());
    const state = fixState(asked);
    expect(state.pending?.id).toBe('fix.results');

    const run = await runFilmFix(handoff, deps(), { state, reply: typed(RESULTS) });
    expect(run.reason).toBe('finished');
    expect(run.earlier?.[0]?.report?.phase).toBe('post');
    expect(run.output?.kind).toBe('fix');
    const bottom = run.output?.plan?.sections[0]?.lines.map((l) => l.text).join(' ') ?? '';
    expect(bottom).toMatch(/Lagos|London/);
  });

  it('writes only the plan when it fixes a report that is already saved', async () => {
    const { handoff, deps } = setup(PLAN, 'audit');
    const audited = await runFilmAudit(handoff, deps());
    const inputs = audited.output?.inputs;
    if (!inputs) throw new Error('Expected audit inputs');

    const again = setup(PLAN, 'fix');
    const { filmAuditInputsSchema } = await import('./audit.js');
    const run = await runFilmFix(again.handoff, again.deps(), undefined, {
      from: { inputs: filmAuditInputsSchema.parse(inputs) },
    });
    expect(run.reason).toBe('finished');
    expect(run.earlier).toBeUndefined();
    expect(run.output?.kind).toBe('fix');
  });
});
