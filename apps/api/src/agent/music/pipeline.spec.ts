import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { briefSchema, launchPlanSchema, type ThreadEvent } from '@oraqul/schema';
import type { Handoff } from '../category-agents.js';
import type { PlanRun } from '../launch/pipeline.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedMusicReader } from './read.js';
import { NoResearch } from './research.js';
import { musicInputsSchema, runMusicBuild } from './runs.js';
import { TemplatePlanWriter } from './writer.js';

function setup(text: string, callBudget = 60) {
  const events: ThreadEvent[] = [];
  // Most specs are not about the budget band card, so the brief states one.
  const said = {
    text: `${text} An independent budget. Platforms: Instagram, TikTok and YouTube.`,
    files: [],
  };
  const handoff: Handoff = {
    category: 'music',
    mode: 'build',
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
  const deps = () => ({
    reader: new ScriptedMusicReader(),
    queries: new ScriptedQueryPlanner(),
    research: new NoResearch(),
    writer: new TemplatePlanWriter(),
    tools: context(),
    emit: (e: ThreadEvent) => events.push(e),
  });
  return { events, handoff, deps };
}

const BRIEF =
  'Launch plan for "Night Songs", an afrobeats album from artist "Neon Tide" for 18 to 34 year olds, touring Lagos, London and Houston. Sound-alikes: "Ada Lux" and "Kola Wave".';

function waiting(run: PlanRun) {
  expect(run.reason).toBe('waiting');
  if (run.state?.job !== 'build') throw new Error('Expected a paused build');
  return run.state;
}

describe('Music build pipeline on demo data', { timeout: 20_000 }, () => {
  it('builds a plan with the artist as an anchor, a tour order and the music sections', async () => {
    const { events, handoff, deps } = setup(BRIEF);
    const run = await runMusicBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const output = run.output;
    if (!output?.plan) throw new Error('Expected a launch plan');
    briefSchema.parse(output.brief);
    const plan = launchPlanSchema.parse(output.plan);

    expect(events.some((e) => e.type === 'question')).toBe(false);
    expect(events.filter((e) => e.type === 'trace.step').every((e) => e.agent === 'music')).toBe(
      true,
    );

    // The artist is an anchor, never one of its own comps.
    expect(plan.comps.map((c) => c.name).sort()).toEqual(['Ada Lux', 'Kola Wave']);
    const inputs = musicInputsSchema.parse(output.inputs);
    expect(inputs.resolved.map((a) => a.name).sort()).toEqual([
      'Ada Lux',
      'Kola Wave',
      'Neon Tide',
    ]);
    expect(inputs.read.artist).toBe('Neon Tide');
    expect(inputs.read.releaseType).toBe('album');

    const keys = plan.sections.map((s) => s.key);
    expect(keys.slice(0, 4)).toEqual(['bottom-line', 'positioning', 'audience', 'markets']);
    for (const key of ['tour', 'support', 'sync', 'publicity', 'partnerships'] as const) {
      expect(keys).toContain(key);
    }
    for (const key of ['placement', 'route', 'cadence'] as const) expect(keys).not.toContain(key);
    expect(keys.at(-1)).toBe('gaps');

    // The tour order is tested as an assumption of its own, and cites a finding.
    const route = plan.findings.find((f) => f.id === 'f-a-route');
    expect(route?.verdict).toMatch(/holds|weak|breaks/);
    expect(output.brief.assumptions.map((a) => a.id)).toContain('a-route');

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

    expect(output.brief.places.map((p) => p.name).sort()).toEqual(['Houston', 'Lagos', 'London']);
    const bottom = plan.sections[0]?.lines.map((l) => l.text).join(' ') ?? '';
    for (const other of ['Abuja', 'Accra', 'Manchester', 'Nairobi', 'Cairo']) {
      expect(bottom).not.toContain(other);
    }
  });

  it('asks one question when the brief has no market, then plans with the answer', async () => {
    const { handoff, deps } = setup(
      'Launch plan for "Night Songs", an afrobeats album from artist "Neon Tide". Sound-alikes: "Ada Lux", "Kola Wave".',
    );
    const state = waiting(await runMusicBuild(handoff, deps()));
    expect(state.pending).toMatchObject({ id: 'music.minimum', card: 'text' });

    const done = await runMusicBuild(handoff, deps(), {
      state,
      reply: { kind: 'typed', text: 'Playing Lagos.' },
    });
    expect(done.reason).toBe('finished');
    expect(done.output?.brief.places.map((p) => p.name)).toEqual(['Lagos']);
  });

  it('plans from the sound-alikes when Qloo does not know the artist yet', async () => {
    const { handoff, deps } = setup(
      'Launch plan for "Night Songs", an afrobeats album from artist "Zanzibar Quill Ensemble", touring Lagos and London. Sound-alikes: "Ada Lux" and "Kola Wave".',
    );
    const run = await runMusicBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const inputs = musicInputsSchema.parse(run.output?.inputs);
    expect(inputs.resolved.map((a) => a.name).sort()).toEqual(['Ada Lux', 'Kola Wave']);
    expect(inputs.dropped.map((d) => d.name)).toEqual(['Zanzibar Quill Ensemble']);
    expect(run.output?.brief.cannot.some((c) => c.item === 'Zanzibar Quill Ensemble')).toBe(true);
  });

  it('says in Gaps that Qloo does not know the artist, and what the plan rests on', async () => {
    const withAlikes = setup(
      'Launch plan for "Night Songs", an afrobeats album from artist "Zanzibar Quill Ensemble", touring Lagos and London. Sound-alikes: "Ada Lux" and "Kola Wave".',
    );
    const run = await runMusicBuild(withAlikes.handoff, withAlikes.deps());
    const gaps = run.output?.plan?.sections.find((s) => s.key === 'gaps');
    expect(gaps?.lines[0]?.text).toContain('Zanzibar Quill Ensemble is new');
    expect(gaps?.lines[0]?.text).toContain('Ada Lux and Kola Wave');
    expect(gaps?.lines[0]?.text).toContain('Name your own and I will swap them in');
  });

  it('uses an act featured on the release as an audience anchor, not as a sound-alike', async () => {
    const { handoff, deps } = setup(
      'Launch plan for "Night Songs", an afrobeats album from artist "Neon Tide" featuring "Sade Rhythm", touring Lagos and London. Sound-alikes: "Ada Lux" and "Kola Wave".',
    );
    const run = await runMusicBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const inputs = musicInputsSchema.parse(run.output?.inputs);
    expect(inputs.read.featuredActs).toEqual(['Sade Rhythm']);
    expect(inputs.read.comps).toEqual(['Ada Lux', 'Kola Wave']);
    expect(inputs.resolved.map((a) => a.name)).toContain('Sade Rhythm');
  });

  it('stops with no plan when the budget runs out', async () => {
    const { handoff, deps } = setup(BRIEF, 2);
    const run = await runMusicBuild(handoff, deps());
    expect(run.reason).toBe('budget');
    expect(run.output).toBeNull();
  });
});
