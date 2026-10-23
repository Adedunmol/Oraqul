import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { briefSchema, launchPlanSchema, type ThreadEvent } from '@oraqul/schema';
import type { Handoff } from '../category-agents.js';
import type { PlanRun } from '../launch/pipeline.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedShowsReader } from './read.js';
import { NoResearch } from './research.js';
import { runShowsBuild, showsInputsSchema } from './runs.js';
import { TemplatePlanWriter } from './writer.js';

function setup(text: string, callBudget = 80) {
  const events: ThreadEvent[] = [];
  // Most specs are not about the budget band card, so the brief states one.
  const said = {
    text: `${text} An independent budget. Platforms: Instagram, TikTok and YouTube.`,
    files: [],
  };
  const handoff: Handoff = {
    category: 'shows',
    mode: 'build',
    title: 'Night Songs Live',
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
    reader: new ScriptedShowsReader(),
    queries: new ScriptedQueryPlanner(),
    research: new NoResearch(),
    writer: new TemplatePlanWriter(),
    tools: context(),
    emit: (e: ThreadEvent) => events.push(e),
  });
  return { events, handoff, deps };
}

const BRIEF =
  'Launch plan for the concert "Night Songs Live", an afrobeats show from artist "Neon Tide" for 18 to 34 year olds, playing Lagos, London and Houston on 2099-03-12. Venue capacity: 500. Ticket price band: under $30. Target 80 percent. Sound-alikes: "Ada Lux" and "Kola Wave".\nRivals: Sade Rhythm on 2099-03-12; Kola Wave on 2099-04-20';

function waiting(run: PlanRun) {
  expect(run.reason).toBe('waiting');
  if (run.state?.job !== 'build') throw new Error('Expected a paused build');
  return run.state;
}

describe('Live shows build pipeline on demo data', { timeout: 20_000 }, () => {
  it('builds a plan with the on-sale, final push, calendar and show sections', async () => {
    const { handoff, deps } = setup(BRIEF);
    const run = await runShowsBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const output = run.output;
    if (!output?.plan) throw new Error('Expected a launch plan');
    briefSchema.parse(output.brief);
    const plan = launchPlanSchema.parse(output.plan);

    const inputs = showsInputsSchema.parse(output.inputs);
    expect(inputs.read).toMatchObject({
      act: 'Neon Tide',
      showType: 'concert',
      capacity: 500,
      priceBand: 'under $30',
    });
    expect(inputs.read.rivalDates).toHaveLength(2);

    const keys = plan.sections.map((s) => s.key);
    expect(keys.slice(0, 4)).toEqual(['bottom-line', 'positioning', 'audience', 'markets']);
    for (const key of [
      'onsale',
      'finalpush',
      'calendar',
      'publicity',
      'venues',
      'partnerships',
      'channels',
      'timeline',
      'budget',
      'measure',
    ] as const) {
      expect(keys).toContain(key);
    }
    for (const key of ['tour', 'support', 'sync'] as const) expect(keys).not.toContain(key);
    expect(keys.at(-1)).toBe('gaps');

    const text = (key: string) =>
      plan.sections
        .find((s) => s.key === key)
        ?.lines.map((l) => l.text)
        .join('\n') ?? '';
    // Ticket targets come from the team: 80 percent of 500 is 400 tickets, and nothing is invented.
    expect(text('onsale')).toContain('Venue capacity: 500');
    expect(text('onsale')).toContain('Ticket price band: under $30');
    expect(text('onsale')).toContain('of 400 tickets sold');
    expect(text('onsale')).toContain('never plan a presale with no end date');
    expect(text('finalpush')).toContain('People who already hold tickets get show information');
    expect(text('budget')).toContain('Announce and on sale: 40%');
    expect(text('budget')).toContain('Final push: 40%');
    expect(plan.signal?.primary).toBe('Tickets sold against capacity (sell-through)');
    expect(plan.signal?.target).toMatchObject({ value: 80, from: 'team' });

    // The calendar follows the show rules and stays playbook.
    expect(plan.calendar.length).toBeGreaterThan(0);
    expect(plan.calendar.every((r) => r.grade === 'directional')).toBe(true);

    // A rival on the same night is flagged; one weeks away is okay. Direction only.
    const same = plan.calls.find((c) => c.id === 'call-date-2099-03-12');
    expect(same?.direction).not.toBe('okay');
    expect(same?.teamChoice).toBe(true);
    expect(plan.calls.find((c) => c.id === 'call-date-2099-04-20')?.direction).toBe('okay');

    for (const line of plan.sections.flatMap((s) => s.lines)) {
      if (line.kind === 'playbook') expect(line.findingIds).toEqual([]);
      expect(line.text).not.toMatch(/receipt|[0-9a-f]{8}-[0-9a-f]{4}/i);
    }
  });

  it('shows not available where the team gave no capacity or price band', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the concert "Night Songs Live", an afrobeats show from artist "Neon Tide", playing Lagos on 2099-03-12. Sound-alikes: "Ada Lux" and "Kola Wave".',
    );
    const run = await runShowsBuild(handoff, deps());
    const plan = launchPlanSchema.parse(run.output?.plan);
    const onsale = plan.sections.find((s) => s.key === 'onsale')?.lines.map((l) => l.text) ?? [];
    expect(onsale.join(' ')).toContain('Venue capacity: not available');
    expect(onsale.join(' ')).toContain('Ticket price band: not available');
    expect(onsale.join(' ')).toContain('Give a target and a venue capacity');
  });

  it('marks a theatre window as user supplied, and says when none was given', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the stage play "Night Songs Live", a theatre show by "Neon Tide", playing London on 2099-03-12. Sound-alikes: "Ada Lux" and "Kola Wave".',
    );
    const plan = launchPlanSchema.parse((await runShowsBuild(handoff, deps())).output?.plan);
    const text = plan.sections.find((s) => s.key === 'onsale')?.lines.map((l) => l.text) ?? [];
    expect(text[0]).toContain('user supplied');
    expect(text[0]).toContain('not researched');
  });

  it('asks one question when the brief has no market, then plans with the answer', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the concert "Night Songs Live" from artist "Neon Tide". Sound-alikes: "Ada Lux", "Kola Wave".',
    );
    const state = waiting(await runShowsBuild(handoff, deps()));
    expect(state.pending).toMatchObject({ id: 'shows.minimum', card: 'text' });
    const done = await runShowsBuild(handoff, deps(), {
      state,
      reply: { kind: 'typed', text: 'Playing Lagos.' },
    });
    expect(done.reason).toBe('finished');
    expect(done.output?.brief.places.map((p) => p.name)).toEqual(['Lagos']);
  });

  it('stops with no plan when the budget runs out', async () => {
    const { handoff, deps } = setup(BRIEF, 2);
    const run = await runShowsBuild(handoff, deps());
    expect(run.reason).toBe('budget');
    expect(run.output).toBeNull();
  });
});
