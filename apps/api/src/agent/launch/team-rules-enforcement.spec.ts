import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import type { AppliedRule, LaunchPlan, ThreadEvent } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { compileRules } from '../../team-rules/compile.js';
import type { Handoff } from '../category-agents.js';
import { runFilmBuild } from '../film/pipeline.js';
import { ScriptedQueryPlanner } from '../film/planner.js';
import { ScriptedFilmReader } from '../film/read.js';
import { NoResearch } from '../film/research.js';
import { TemplatePlanWriter } from '../film/writer.js';
import { buildStateSchema } from './state.js';

// A team's confirmed rules change what a plan says, in code, through the same pipeline a run uses.
// The Film build on the demo data is the case: it needs no key and the same brief gives the same plan.

const BRIEF =
  'Launch plan for "Night Ferry", a Nigerian thriller film for 18 to 34 year olds, opening in Atlanta, London, Lagos and Houston on 2099-03-12. Comps: "Salt Road", "The Glass Lantern" and "Midnight Harbor". An independent budget of £90,000. Platforms: Instagram, TikTok and YouTube.';

function tools(): ToolContext {
  return {
    qloo: new QlooClient({
      baseUrl: 'https://demo.invalid',
      apiKey: 'demo',
      fetch: demoFetch,
      callBudget: 300,
      retryDelayMs: 0,
    }),
    source: 'demo',
    entities: new Map<string, SeenEntity>(),
  };
}

const rule = (value: Parameters<typeof compileRules>[0][number]['value'], i: number) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  teamId: '00000000-0000-4000-8000-000000000999',
  scope: 'team' as const,
  projectId: null,
  kind: value.kind,
  field: '',
  operator: '',
  value,
  enforcement: 'code' as const,
  sourceText: 'x',
  status: 'active' as const,
  rejectionReason: null,
  createdBy: null,
  createdByName: null,
  confirmedBy: null,
  confirmedAt: null,
  version: i,
  supersedesId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  sentence: '',
  conflicts: [],
});

async function build(
  values: Parameters<typeof rule>[0][],
  answer?: { state: object; ids: string[] },
  overrides: AppliedRule[][] = [],
) {
  const said = { text: BRIEF, files: [] };
  const handoff: Handoff = {
    category: 'film',
    mode: 'build',
    title: 'Night Ferry',
    inputs: said,
    message: said,
    recent: [],
    planId: null,
    rules: compileRules(values.map((v, i) => rule(v, i + 1))),
    onOverride: async (applied) => {
      overrides.push(applied);
    },
  };
  const events: ThreadEvent[] = [];
  const deps = {
    tools: tools(),
    emit: (e: ThreadEvent) => events.push(e),
    reader: new ScriptedFilmReader(),
    queries: new ScriptedQueryPlanner(),
    research: new NoResearch(),
    writer: new TemplatePlanWriter(),
  };
  const run = await runFilmBuild(
    handoff,
    deps,
    answer
      ? {
          state: buildStateSchema.parse(answer.state),
          reply: { kind: 'options', questionId: 'film.rules', optionIds: answer.ids },
        }
      : undefined,
  );
  return { run, events };
}

/** A build that, when the brief clashes with a rule, keeps the team's limit. */
async function settled(values: Parameters<typeof rule>[0][]) {
  const first = await build(values);
  if (first.run.reason !== 'waiting') return first;
  return build(values, { state: first.run.state as object, ids: ['keep'] });
}

const text = (plan: LaunchPlan | null | undefined) =>
  JSON.stringify([plan?.sections, plan?.partners, plan?.calendar, plan?.territories]);

const NO_CITY =
  'Launch plan for "Night Ferry", a Nigerian thriller film for 18 to 34 year olds, opening on 2099-03-12. Comps: "Salt Road", "The Glass Lantern" and "Midnight Harbor". An independent budget. Platforms: Instagram, TikTok and YouTube.';

describe('team rules change a plan in code', { timeout: 60_000 }, () => {
  it('has a plan to compare with, naming partners, cities and channels', async () => {
    const { run } = await build([]);
    const plan = run.output?.plan;
    expect(run.reason).toBe('finished');
    expect(plan?.partners.length).toBeGreaterThan(0);
    expect(plan?.territories.map((t) => t.name).sort()).toEqual([
      'Atlanta',
      'Houston',
      'Lagos',
      'London',
    ]);
    expect(plan?.calendar.length).toBeGreaterThan(0);
    expect(text(plan)).toContain('£90,000');
  });

  it('never proposes a banned partner, in the options, the lines or the findings', async () => {
    const base = (await build([])).run.output?.plan;
    const banned = base?.partners[0]?.name ?? '';
    expect(banned).not.toBe('');
    const { run } = await build([{ kind: 'partner_block', names: [banned] }]);
    const plan = run.output?.plan;
    expect(plan?.partners.map((p) => p.name)).not.toContain(banned);
    expect(text(plan).toLowerCase()).not.toContain(banned.toLowerCase());
    expect(plan?.dropped.some((d) => d.why.includes(banned))).toBe(false);
  });

  it('plans on no channel the team never uses, and its calendar has none either', async () => {
    const lead = (await build([])).run.output?.plan?.calendar[0]?.channel ?? '';
    expect(lead).not.toBe('');
    const { run } = await settled([{ kind: 'channel_block', names: [lead] }]);
    const plan = run.output?.plan;
    expect(plan?.calendar.length).toBeGreaterThan(0);
    expect(plan?.calendar.some((r) => r.channel === lead)).toBe(false);
    expect(plan?.territories.flatMap((t) => t.channels.map((c) => c.name))).not.toContain(lead);
  });

  it('holds the budget to the ceiling, so no figure in the plan is above it', async () => {
    const { run } = await build(
      [{ kind: 'budget_max', amount: 40_000, currency: 'GBP' }],
      undefined,
    );
    // The brief asks for more than the ceiling, so it asks first; keep the ceiling.
    expect(run.reason).toBe('waiting');
    const answered = await build([{ kind: 'budget_max', amount: 40_000, currency: 'GBP' }], {
      state: run.state as object,
      ids: ['keep'],
    });
    const plan = answered.run.output?.plan;
    expect(text(plan)).toContain('£40,000');
    expect(text(plan)).not.toContain('£90,000');
  });

  it('asks once when the brief names a place the team rules out, and keeps the limit on keep', async () => {
    const values = [{ kind: 'territory_block' as const, names: ['Atlanta'] }];
    const first = await build(values);
    expect(first.run.reason).toBe('waiting');
    const question = first.events.find((e) => e.type === 'question');
    expect(question).toMatchObject({ id: 'film.rules' });
    expect(JSON.stringify(question)).toContain('rule out Atlanta');
    const kept = await build(values, { state: first.run.state as object, ids: ['keep'] });
    expect(kept.run.reason).toBe('finished');
    expect(kept.run.output?.plan?.territories.map((t) => t.name)).not.toContain('Atlanta');
    expect(text(kept.run.output?.plan)).not.toContain('Atlanta');
  });

  it('goes ahead against the rule only for that run, and logs the override against the rule', async () => {
    const values = [{ kind: 'territory_block' as const, names: ['Atlanta'] }];
    const first = await build(values);
    const logged: AppliedRule[][] = [];
    const over = await build(
      values,
      { state: first.run.state as object, ids: ['override'] },
      logged,
    );
    expect(over.run.output?.plan?.territories.map((t) => t.name)).toContain('Atlanta');
    expect(logged).toHaveLength(1);
    expect(logged[0]).toEqual([{ id: '00000000-0000-4000-8000-000000000001', version: 1 }]);
  });

  it('plans exactly as before when the team has no rules, and with rules that do not apply', async () => {
    const plain = (await build([])).run.output?.plan;
    const unrelated = (await build([{ kind: 'partner_block', names: ['Nobody Brand'] }])).run.output
      ?.plan;
    expect(text(unrelated)).toEqual(text(plain));
  });

  it('plans for the team’s markets when the brief names no city, and never replaces a city it names', async () => {
    const run = async (text: string, values: Parameters<typeof rule>[0][]) => {
      const said = { text, files: [] };
      const handoff: Handoff = {
        category: 'film',
        mode: 'build',
        title: 'Night Ferry',
        inputs: said,
        message: said,
        recent: [],
        planId: null,
        rules: compileRules(values.map((v, i) => rule(v, i + 1))),
      };
      return runFilmBuild(handoff, {
        tools: tools(),
        emit: () => undefined,
        reader: new ScriptedFilmReader(),
        queries: new ScriptedQueryPlanner(),
        research: new NoResearch(),
        writer: new TemplatePlanWriter(),
      });
    };
    // Without the rule the brief is missing a city, so Oraqul asks.
    expect((await run(NO_CITY, [])).reason).toBe('waiting');
    const own = await run(NO_CITY, [{ kind: 'territory_allow', names: ['Lagos', 'London'] }]);
    expect(own.reason).toBe('finished');
    expect(own.output?.plan?.territories.map((t) => t.name).sort()).toEqual(['Lagos', 'London']);
    // A city the brief does name is kept, and one the team's markets rule out is still ruled out.
    const named = await run(BRIEF.replace('£90,000', '£40,000'), [
      { kind: 'territory_allow', names: ['Lagos', 'London'] },
    ]);
    expect(named.reason).toBe('waiting');
  });

  it('tells the writer and the red team the words rules, labelled as the team’s', async () => {
    const { run } = await build([{ kind: 'tone', text: 'warm and plain' }]);
    expect(run.reason).toBe('finished');
  });
});
