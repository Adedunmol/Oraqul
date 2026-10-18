import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { briefSchema, launchPlanSchema, type ThreadEvent } from '@oraqul/schema';
import type { Handoff } from '../category-agents.js';
import { type FilmState, type PlanRun, runFilmBuild } from './pipeline.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedFilmReader } from './read.js';
import { NoResearch } from './research.js';
import { TemplatePlanWriter } from './writer.js';

function setup(text: string, callBudget = 60) {
  const events: ThreadEvent[] = [];
  const said = { text, files: [] };
  const handoff: Handoff = {
    category: 'film',
    mode: 'build',
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
  const deps = () => ({
    reader: new ScriptedFilmReader(),
    queries: new ScriptedQueryPlanner(),
    research: new NoResearch(),
    writer: new TemplatePlanWriter(),
    tools: context(),
    emit: (e: ThreadEvent) => events.push(e),
  });
  return { events, handoff, deps };
}

const BRIEF =
  'Launch plan for "Night Ferry", a thriller film for 18 to 34 year olds, opening in Lagos and London. Comps: "Salt Road", "The Glass Lantern" and "Midnight Harbor".';

function waiting(run: PlanRun): FilmState {
  expect(run.reason).toBe('waiting');
  if (!run.state) throw new Error('Expected a paused state');
  return run.state;
}

// A whole build makes about 30 demo calls, which can pass 5 seconds on a busy machine.
describe('Film build pipeline on demo data', { timeout: 20_000 }, () => {
  it('builds a plan with no cards, findings first, every grounded line on a finding', async () => {
    const { events, handoff, deps } = setup(BRIEF);
    const run = await runFilmBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const output = run.output;
    if (!output?.plan) throw new Error('Expected a launch plan');
    briefSchema.parse(output.brief);
    const plan = launchPlanSchema.parse(output.plan);

    expect(events.some((e) => e.type === 'question')).toBe(false);
    // Same-name comps are settled by code, and the choice is stated.
    const harbor = plan.comps.find((c) => c.name === 'Midnight Harbor');
    expect(harbor?.choice).toContain('Midnight Harbor');

    expect(plan.sections.map((s) => s.key).slice(0, 4)).toEqual([
      'bottom-line',
      'positioning',
      'audience',
      'markets',
    ]);
    expect(plan.sections.at(-1)?.key).toBe('gaps');
    const findingIds = new Set(plan.findings.map((f) => f.id));
    const lineIds = new Set(run.receipts.flatMap((r) => (r.lineId ? [r.lineId] : [])));
    for (const f of plan.findings) expect(lineIds.has(f.id)).toBe(true);
    for (const line of plan.sections.flatMap((s) => s.lines)) {
      if (line.kind === 'grounded') {
        expect(line.findingIds.length).toBeGreaterThan(0);
        for (const id of line.findingIds) expect(findingIds.has(id)).toBe(true);
      } else {
        expect(line.findingIds).toEqual([]);
      }
      expect(line.text).not.toMatch(/receipt|[0-9a-f]{8}-[0-9a-f]{4}/i);
    }

    // The team's cities lead; no other city is in the bottom line.
    expect(output.headline).toMatch(/^Open in (Lagos|London) first/);
    const bottom = plan.sections[0]?.lines.map((l) => l.text).join(' ') ?? '';
    for (const other of ['Abuja', 'Accra', 'Manchester', 'Nairobi', 'Cairo']) {
      expect(bottom).not.toContain(other);
    }
    expect(output.brief.places.map((p) => p.name).sort()).toEqual(['Lagos', 'London']);

    // Findings stream into the chat before the plan's message.
    const firstFinding = events.findIndex((e) => e.type === 'finding');
    const message = events.findLastIndex((e) => e.type === 'message');
    expect(firstFinding).toBeGreaterThan(-1);
    expect(firstFinding).toBeLessThan(message);
    expect(events[0]).toEqual({
      type: 'memory.used',
      items: [{ source: 'project', label: 'your brief' }],
    });
    expect(
      events.filter((e) => e.type === 'trace.step').map((e) => e.type === 'trace.step' && e.step),
    ).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('asks one question when the brief has no market, then plans with the answer', async () => {
    const { handoff, deps } = setup(
      'Launch plan for "Night Ferry", a thriller film. Comps: "Salt Road", "The Glass Lantern".',
    );
    const state = waiting(await runFilmBuild(handoff, deps()));
    expect(state.pending).toMatchObject({ id: 'film.minimum', card: 'text' });

    const done = await runFilmBuild(handoff, deps(), {
      state,
      reply: { kind: 'typed', text: 'Opening in Lagos.' },
    });
    expect(done.reason).toBe('finished');
    expect(done.output?.brief.places.map((p) => p.name)).toEqual(['Lagos']);
  });

  it('stops with no plan when the budget runs out', async () => {
    const { handoff, deps } = setup(
      'Launch plan for "Night Ferry", a thriller opening in Lagos. Comps: "Salt Road", "The Glass Lantern" and "Salt Road 2".',
      2,
    );
    const run = await runFilmBuild(handoff, deps());
    expect(run.reason).toBe('budget');
    expect(run.output).toBeNull();
  });
});
