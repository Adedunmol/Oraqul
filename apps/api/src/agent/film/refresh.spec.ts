import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import {
  launchPlanSchema,
  type Output,
  refreshReportSchema,
  type ThreadEvent,
} from '@oraqul/schema';
import type { Handoff } from '../category-agents.js';
import { launchInputsSchema } from '../launch/pipeline.js';
import { runRefresh } from '../launch/refresh.js';
import { launchDeps, runFilmBuild } from './pipeline.js';
import { ScriptedQueryPlanner } from './planner.js';
import { filmReadSchema, ScriptedFilmReader } from './read.js';
import { NoResearch } from './research.js';
import { TemplatePlanWriter } from './writer.js';

const TEXT =
  'Launch plan for "Night Ferry", a thriller film for 18 to 34 year olds, opening in Lagos and London. Comps: "Salt Road", "The Glass Lantern" and "Midnight Harbor". An independent budget. Platforms: Instagram, TikTok and YouTube.';

function setup(message = TEXT) {
  const events: ThreadEvent[] = [];
  const said = { text: TEXT, files: [] };
  const handoff: Handoff = {
    category: 'film',
    mode: 'build',
    title: 'Night Ferry',
    inputs: said,
    message: { text: message, files: [] },
    recent: [],
    planId: null,
  };
  const deps = () =>
    launchDeps({
      reader: new ScriptedFilmReader(),
      queries: new ScriptedQueryPlanner(),
      research: new NoResearch(),
      writer: new TemplatePlanWriter(),
      tools: {
        qloo: new QlooClient({
          baseUrl: 'https://demo.invalid',
          apiKey: 'demo',
          fetch: demoFetch,
          callBudget: 120,
          retryDelayMs: 0,
        }),
        source: 'demo',
        entities: new Map<string, SeenEntity>(),
      } satisfies ToolContext,
      emit: (e: ThreadEvent) => events.push(e),
    });
  return { events, handoff, deps };
}

describe('checking what has changed on a saved plan', { timeout: 30_000 }, () => {
  async function saved() {
    const built = setup();
    const run = await runFilmBuild(built.handoff, {
      reader: new ScriptedFilmReader(),
      queries: new ScriptedQueryPlanner(),
      research: new NoResearch(),
      writer: new TemplatePlanWriter(),
      tools: built.deps().tools,
      emit: () => {},
    });
    const made = run.output;
    if (!made?.plan) throw new Error('Expected a plan');
    const output = {
      id: '00000000-0000-4000-8000-0000000000aa',
      createdAt: '2026-10-01T10:00:00.000Z',
      brief: made.brief,
      plan: made.plan,
    } as unknown as Output;
    const inputs = launchInputsSchema(filmReadSchema).parse(made.inputs);
    return { output, inputs, plan: launchPlanSchema.parse(made.plan) };
  }

  it('saves a what changed output, leaves the plan as it was, and says nothing moved on the same data', async () => {
    const { output, inputs } = await saved();
    const before = JSON.stringify(output.plan);
    const check = setup('Check what has changed since this plan was made');
    const run = await runRefresh(check.handoff, check.deps(), output, inputs);
    expect(run.reason).toBe('finished');
    const made = run.output;
    expect(made?.kind).toBe('refresh');
    expect(made?.plan).toBeNull();
    const report = refreshReportSchema.parse(made?.refresh);
    expect(report.planOutputId).toBe(output.id);
    expect(report.findings.some((f) => f.status === 'moved')).toBe(false);
    expect(report.findings.filter((f) => f.status === 'unchanged').length).toBeGreaterThan(3);
    expect(report.affected).toEqual([]);
    expect(report.question).toBeNull();
    expect(report.gaps.join(' ')).toMatch(/Web research is not set up/);
    expect(JSON.stringify(output.plan)).toBe(before);
  });

  it('reports a moved finding and the plan lines that rest on it, never as a revision', async () => {
    const { output, inputs, plan } = await saved();
    const cited = plan.sections
      .flatMap((s) => s.lines)
      .find((l) => l.findingIds.includes('f-markets'));
    expect(cited).toBeDefined();
    // The plan saved a different strength for Lagos than today's data gives.
    const tampered = {
      ...plan,
      findings: plan.findings.map((f) =>
        f.id === 'f-markets'
          ? {
              ...f,
              numbers: Object.fromEntries(Object.entries(f.numbers).map(([k, v]) => [k, v * 3])),
            }
          : f,
      ),
    };
    const check = setup();
    const run = await runRefresh(
      check.handoff,
      check.deps(),
      { ...output, plan: tampered } as unknown as Output,
      inputs,
    );
    const report = refreshReportSchema.parse(run.output?.refresh);
    const markets = report.findings.find((f) => f.findingId === 'f-markets');
    expect(markets?.status).toBe('moved');
    expect(markets?.numbers.length).toBeGreaterThan(0);
    expect(report.affected.map((l) => l.lineId)).toContain(cited?.id);
    expect(run.output?.headline).toMatch(/moved/);
  });

  it('keeps the work’s title out of a specific question', async () => {
    const { output, inputs } = await saved();
    const check = setup('Has the release window for Night Ferry changed?');
    const run = await runRefresh(check.handoff, check.deps(), output, inputs);
    const report = refreshReportSchema.parse(run.output?.refresh);
    expect(report.question).toBe('Has the release window for the release changed?');
  });
});
