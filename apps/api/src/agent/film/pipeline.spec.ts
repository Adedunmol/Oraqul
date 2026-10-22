import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { briefSchema, launchPlanSchema, type ThreadEvent } from '@oraqul/schema';
import type { Handoff } from '../category-agents.js';
import type { RawReview, ReviewInput } from '../launch/review.js';
import { type PlanRun, runFilmBuild } from './pipeline.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedFilmReader } from './read.js';
import { NoResearch } from './research.js';
import type { BuildState } from './state.js';
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

function waiting(run: PlanRun): BuildState {
  expect(run.reason).toBe('waiting');
  if (run.state?.job !== 'build') throw new Error('Expected a paused build');
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
    expect(events.some((e) => e.type === 'memory.used')).toBe(false);
    expect(
      events.filter((e) => e.type === 'trace.step').map((e) => e.type === 'trace.step' && e.step),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
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

  it('covers a thin check with a second round the research check asks for', async () => {
    const { handoff, deps } = setup(BRIEF);
    const base = deps();
    // Only the core queries in the first round, so the podcasts query is left for the second.
    const queries = {
      plan: async (input: Parameters<ScriptedQueryPlanner['plan']>[0]) => {
        const { plan, tokens } = await new ScriptedQueryPlanner().plan(input);
        return { plan: { ...plan, queries: ['audience' as const, 'markets' as const] }, tokens };
      },
    };
    const researchPlanner = {
      assess: async () => ({
        tokens: 0,
        assessment: {
          checks: [{ id: 'c2', status: 'thin' as const, findingIds: ['f-audience', 'f-not-real'] }],
          extra: [
            { query: 'podcasts', check: 'c2', why: 'press angles need the shows they hear' },
            { query: 'not-in-the-catalog', check: 'c2', why: 'made up' },
          ],
        },
      }),
    };
    const run = await runFilmBuild(handoff, { ...base, queries, researchPlanner });
    const plan = launchPlanSchema.parse(run.output?.plan);
    // The extra query ran and the invented one did not.
    expect(plan.findings.some((f) => f.query === 'podcasts')).toBe(true);
    const checks = new Map(plan.understanding?.criteria.map((c) => [c.id, c]));
    const ids = checks.get('c2')?.findingIds ?? [];
    expect(ids).toContain('f-audience');
    expect(ids).not.toContain('f-not-real');
    expect(checks.get('c2')?.status).toBe('covered');
    expect(ids.some((id) => id.startsWith('f-podcasts'))).toBe(true);
    // The audience is asked once: the second round does not repeat the core findings.
    expect(plan.findings.filter((f) => f.id === 'f-audience')).toHaveLength(1);
  });

  describe('red team', () => {
    const issue = (
      over: Partial<RawReview['issues'][number]> = {},
    ): RawReview['issues'][number] => ({
      check: 'c1',
      type: 'missing',
      text: 'Does not say which city to open in.',
      fix: 'Name the first city and why.',
      blocking: true,
      query: null,
      section: null,
      ...over,
    });
    const reviewerOf = (reviews: RawReview[]) => {
      const seen: { round: number; draft: string }[] = [];
      return {
        seen,
        reviewer: {
          review: async (input: ReviewInput) => {
            seen.push({ round: input.round, draft: input.draft });
            return {
              review: reviews[Math.min(input.round, reviews.length) - 1] ?? null,
              tokens: 0,
            };
          },
        },
      };
    };

    it('sends a draft back with the issues and saves the one that passes', async () => {
      const { handoff, deps } = setup(BRIEF);
      const feedback: string[][] = [];
      const template = new TemplatePlanWriter();
      const writer = {
        write: async (input: Parameters<TemplatePlanWriter['write']>[0]) => {
          feedback.push(input.feedback ?? []);
          return template.write(input);
        },
        answer: (input: Parameters<TemplatePlanWriter['answer']>[0]) => template.answer(input),
      };
      const { reviewer, seen } = reviewerOf([
        { issues: [issue()], next: ['Add the date you want to open'] },
        { issues: [], next: [] },
      ]);
      const run = await runFilmBuild(handoff, { ...deps(), writer, reviewer });
      const plan = launchPlanSchema.parse(run.output?.plan);
      expect(seen.map((s) => s.round)).toEqual([1, 2]);
      // The second draft was written knowing what was wrong with the first.
      expect(feedback[0]).toEqual([]);
      expect(feedback[1]?.[0]).toContain('missing (c1): Does not say which city to open in.');
      expect(plan.review?.status).toBe('passed');
      expect(plan.review?.rounds.map((r) => r.action)).toEqual(['rewrote', 'approved']);
    });

    it('researches an issue that asks for evidence before the next draft', async () => {
      const { handoff, deps } = setup(BRIEF);
      const queries = {
        plan: async (input: Parameters<ScriptedQueryPlanner['plan']>[0]) => {
          const { plan, tokens } = await new ScriptedQueryPlanner().plan(input);
          return { plan: { ...plan, queries: ['audience' as const, 'markets' as const] }, tokens };
        },
      };
      const { reviewer } = reviewerOf([
        { issues: [issue({ query: 'podcasts' })], next: [] },
        { issues: [], next: [] },
      ]);
      const run = await runFilmBuild(handoff, { ...deps(), queries, reviewer });
      const plan = launchPlanSchema.parse(run.output?.plan);
      expect(plan.findings.some((f) => f.query === 'podcasts')).toBe(true);
      expect(plan.review?.rounds.map((r) => r.action)).toEqual(['researched', 'approved']);
    });

    it('saves the draft flagged, with what would help, when the same issue comes back', async () => {
      const { events, handoff, deps } = setup(BRIEF);
      const { reviewer, seen } = reviewerOf([
        { issues: [issue()], next: ['Add the date you want to open', 'Name a fourth comp'] },
      ]);
      const run = await runFilmBuild(handoff, { ...deps(), reviewer });
      const plan = launchPlanSchema.parse(run.output?.plan);
      expect(run.reason).toBe('finished');
      // The same blocking issue after a rewrite: a third draft would not fix it.
      expect(seen).toHaveLength(2);
      expect(plan.review?.status).toBe('flagged');
      expect(plan.review?.rounds.at(-1)?.action).toBe('stopped');
      expect(plan.review?.next).toEqual(['Add the date you want to open', 'Name a fourth comp']);
      const reply = events.findLast((e) => e.type === 'message');
      expect(reply?.type === 'message' && reply.body).toContain('Some points are still open');
    });

    it('stops at three drafts when each has a different blocking issue', async () => {
      const { handoff, deps } = setup(BRIEF);
      const { reviewer, seen } = reviewerOf([
        { issues: [issue({ type: 'missing' })], next: [] },
        { issues: [issue({ type: 'vague' })], next: [] },
        { issues: [issue({ type: 'off-brief' })], next: [] },
      ]);
      const run = await runFilmBuild(handoff, { ...deps(), reviewer });
      const plan = launchPlanSchema.parse(run.output?.plan);
      expect(seen).toHaveLength(3);
      expect(plan.review?.status).toBe('flagged');
    });

    it('says it was not reviewed when there is no reviewer', async () => {
      const { handoff, deps } = setup(BRIEF);
      const run = await runFilmBuild(handoff, deps());
      expect(launchPlanSchema.parse(run.output?.plan).review?.status).toBe('unchecked');
    });
  });
});
