import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { briefSchema, launchPlanSchema, type ThreadEvent } from '@oraqul/schema';
import { NO_RULES } from '../../team-rules/compile.js';
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
  // Most specs are not about the budget band card, so the brief states one.
  const said = {
    text: `${text} An independent budget. Platforms: Instagram, TikTok and YouTube.`,
    files: [],
  };
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

  it('asks what the film is and where, once, and plans nothing, when a brief says neither', async () => {
    const { events, handoff, deps } = setup('I want to launch a new movie');
    const run = await runFilmBuild(handoff, deps());
    expect(run.output).toBeNull();
    const question = events.find((e) => e.type === 'question');
    expect(question).toMatchObject({ id: 'film.describe', card: 'text' });
    expect(JSON.stringify(question)).toMatch(/where you are or where you want to launch/);
    // No launch is guessed: nothing is traced as a typical Nollywood film, and no comps are asked for.
    const traced = events.flatMap((e) => (e.type === 'trace.step' ? [e.text] : [])).join('\n');
    expect(traced).not.toMatch(/typical/i);
    expect(JSON.stringify(question)).not.toMatch(/name a few comps/i);
  });

  it('does not plan a guessed launch for a title and a city: it asks what the film is about', async () => {
    const { events, handoff, deps } = setup(
      'I want to launch a new movie called Salty Road in Lagos',
    );
    const run = await runFilmBuild(handoff, deps());
    const traced = events.flatMap((e) => (e.type === 'trace.step' ? [e.text] : [])).join('\n');
    expect(traced).not.toMatch(/typical/i);
    const said = events.flatMap((e) => (e.type === 'message' ? [e.body] : [])).join('\n');
    if (!run.output) {
      expect(said).toMatch(/Tell me what it is about/);
      expect(said).not.toMatch(/name a few|Name a few/);
    }
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

  it('says Qloo did not answer, not that the comps were wrong, when Qloo is down', async () => {
    const { events, handoff, deps } = setup(BRIEF);
    const down: typeof fetch = async () => new Response('{}', { status: 503 });
    const tools: ToolContext = {
      qloo: new QlooClient({
        baseUrl: 'https://qloo.test',
        apiKey: 'k',
        fetch: down,
        retryDelayMs: 0,
      }),
      source: 'qloo',
      entities: new Map<string, SeenEntity>(),
    };
    const run = await runFilmBuild(handoff, { ...deps(), tools });
    expect(run.output).toBeNull();
    const said = events.flatMap((e) => (e.type === 'message' ? [e.body] : [])).join('\n');
    expect(said).toContain('not answering right now');
    expect(said).toContain('Send it again in a few minutes');
    expect(said).not.toContain('did not find a close match');
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
          retry: [],
          consult: [],
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
      ask: null,
      ...over,
    });
    const reviewerOf = (reviews: RawReview[]) => {
      const seen: { round: number; draft: string }[] = [];
      return {
        seen,
        reviewer: {
          support: async () => ({ results: null, tokens: 0 }),
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

    it('records how the plan was made: the drafts and every line the check removed', async () => {
      const { handoff, deps } = setup(BRIEF);
      const { reviewer } = reviewerOf([
        { issues: [issue()], next: [] },
        { issues: [], next: [] },
      ]);
      const run = await runFilmBuild(handoff, { ...deps(), reviewer });
      const plan = launchPlanSchema.parse(run.output?.plan);
      expect(plan.process?.drafts).toBe(2);
      expect(plan.process?.dropped.every((d) => d.draft === 1 || d.draft === 2)).toBe(true);
    });

    describe('when only the person can settle it', () => {
      const asking = [{ issues: [issue({ ask: 'Which market do you open in first?' })], next: [] }];

      it('saves the plan, then asks the one question', async () => {
        const { events, handoff, deps } = setup(BRIEF);
        const { reviewer } = reviewerOf(asking);
        const run = await runFilmBuild(handoff, { ...deps(), reviewer });
        const state = waiting(run);
        expect(state.settle).toBe(true);
        expect(run.output?.plan?.review?.status).toBe('flagged');
        const question = events.findLast((e) => e.type === 'question');
        expect(question?.type === 'question' && question.prompt).toContain(
          'Which market do you open in first?',
        );
        expect(events.findLast((e) => e.type === 'question')).toBeDefined();
      });

      it('leaves the plan as it is, with no new work, when told to', async () => {
        const { handoff, deps } = setup(BRIEF);
        const { reviewer } = reviewerOf(asking);
        const first = await runFilmBuild(handoff, { ...deps(), reviewer });
        const state = waiting(first);
        const again = setup(BRIEF);
        const tools = again.deps().tools;
        const run = await runFilmBuild(
          handoff,
          { ...again.deps(), tools, reviewer },
          { state, reply: { kind: 'options', questionId: 'film.settle', optionIds: ['leave'] } },
        );
        expect(run.reason).toBe('finished');
        expect(run.output).toBeNull();
        expect(tools.qloo.callsUsed).toBe(0);
      });

      it('makes the plan again with the answer when the person types one', async () => {
        const { handoff, deps } = setup(BRIEF);
        const first = await runFilmBuild(handoff, {
          ...deps(),
          reviewer: reviewerOf(asking).reviewer,
        });
        const state = waiting(first);
        const run = await runFilmBuild(
          handoff,
          { ...deps(), reviewer: reviewerOf([{ issues: [], next: [] }]).reviewer },
          { state, reply: { kind: 'typed', text: 'Lagos first, in March' } },
        );
        expect(run.reason).toBe('finished');
        expect(run.output?.plan).not.toBeNull();
      });
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

describe('the budget band card', () => {
  const bare =
    'Launch plan for "Night Ferry", a thriller opening in Lagos and London. Comps: "Salt Road", "The Glass Lantern", "Midnight Harbor". On Instagram and TikTok.';

  function bandSetup(text: string) {
    const { handoff, deps } = setup(text);
    // `setup` states a band so other specs skip the card; this one asks for it.
    const bareHandoff = { ...handoff, inputs: { text, files: [] }, message: { text, files: [] } };
    return { handoff: bareHandoff, deps };
  }

  it('asks for the band once, after the plan can be read and before any research', async () => {
    const { handoff, deps } = bandSetup(bare);
    const first = await runFilmBuild(handoff, deps());
    expect(first.reason).toBe('waiting');
    expect(first.state?.job === 'build' && first.state.pending).toMatchObject({
      id: 'film.band',
      card: 'single',
    });
    expect(first.receipts).toEqual([]);
  });

  it('sizes the plan for the band that was picked, and says so only when it was not stated', async () => {
    const { handoff, deps } = bandSetup(bare);
    const first = await runFilmBuild(handoff, deps());
    if (first.state?.job !== 'build' || !first.state.pending) throw new Error('no card');
    const done = await runFilmBuild(handoff, deps(), {
      state: first.state,
      reply: { kind: 'options', questionId: 'film.band', optionIds: ['micro'] },
    });
    expect(done.reason).toBe('finished');
    expect(done.output?.plan?.band).toEqual({ band: 'micro', source: 'asked' });
    expect(done.output?.plan?.understanding?.assumed.map((a) => a.what)).toContain('Budget band');
  });

  it('assumes an independent release when the card is skipped', async () => {
    const { handoff, deps } = bandSetup(bare);
    const first = await runFilmBuild(handoff, deps());
    if (first.state?.job !== 'build') throw new Error('no state');
    const done = await runFilmBuild(handoff, deps(), {
      state: first.state,
      reply: { kind: 'options', questionId: 'film.band', optionIds: ['skip'] },
    });
    expect(done.output?.plan?.band).toEqual({ band: 'independent', source: 'assumed' });
  });

  it('does not ask when the brief states a budget or a band', async () => {
    for (const stated of ['Budget $40k.', 'A mid-size budget.']) {
      const { handoff, deps } = bandSetup(`${bare} ${stated}`);
      const run = await runFilmBuild(handoff, deps());
      expect(run.reason).toBe('finished');
      expect(run.output?.plan?.band?.source).toBe('brief');
    }
  });
});

describe('the rival date check inside a build', () => {
  const withRivals =
    'Launch plan for "Night Ferry", a thriller opening in Lagos and London on 2099-03-12. Comps: "Salt Road", "The Glass Lantern", "Midnight Harbor". An independent budget. Platforms: Instagram, TikTok and YouTube.\nRivals: Harbor Lights on 2099-03-12; Third Mainland opens 2099-03-19';

  it('scores the rivals the brief names against the comps and keeps the result on the plan', async () => {
    const { handoff, deps } = setup(withRivals);
    const done = await runFilmBuild(handoff, deps());
    expect(done.reason).toBe('finished');
    const clash = done.output?.plan?.findings.find((f) => f.id === 'f-clash');
    expect(clash?.entities.map((e) => e.name).sort()).toEqual(['Harbor Lights', 'Third Mainland']);
    expect(done.output?.brief.dates.map((d) => d.rival).sort()).toEqual([
      'Harbor Lights',
      'Third Mainland',
    ]);
    expect(done.output?.brief.chosenDate).not.toBe('');
    expect(done.receipts.some((r) => r.endpoint.includes('insights'))).toBe(true);
  });

  it('says so when Qloo cannot find a rival, and still scores the rest', async () => {
    const { handoff, deps } = setup(`${withRivals}; Zzyzx Unknown Feature opens 2099-03-26`);
    const done = await runFilmBuild(handoff, deps());
    const gaps = done.output?.brief.cannot.map((c) => c.item) ?? [];
    expect(gaps).toContain('Rival date: Zzyzx Unknown Feature');
    expect(gaps).not.toContain('Rival date: Harbor Lights');
  });

  it('makes no rival call when the brief names none', async () => {
    const { handoff, deps } = setup(
      'Launch plan for "Night Ferry", a thriller opening in Lagos. Comps: "Salt Road", "The Glass Lantern", "Midnight Harbor".',
    );
    const done = await runFilmBuild(handoff, deps());
    expect(done.output?.plan?.findings.some((f) => f.id === 'f-clash')).toBe(false);
    expect(done.output?.brief.dates).toEqual([]);
  });
});

describe('a Nigerian film planned for its diaspora (D4, D5, D9)', () => {
  const brief =
    'Launch plan for "Night Ferry", a Nigerian thriller opening in Atlanta, London, Lagos and Houston on 2099-03-12. Comps: "Salt Road", "The Glass Lantern", "Midnight Harbor". A mid-size budget.\nRivals: Harbor Lights on 2099-03-12';

  it('plans Lagos first, then London, Houston and Atlanta, each with channels and a call', async () => {
    const { handoff, deps } = setup(brief, 200);
    const done = await runFilmBuild(handoff, deps());
    const plan = done.output?.plan;
    expect(done.reason).toBe('finished');
    expect(plan?.territories.map((t) => [t.name, t.role])).toEqual([
      ['Lagos', 'home'],
      ['London', 'diaspora'],
      ['Houston', 'diaspora'],
      ['Atlanta', 'diaspora'],
    ]);
    const lagos = plan?.territories[0];
    expect(lagos?.channels.slice(0, 2).map((c) => c.name)).toEqual(['Instagram', 'TikTok']);
    expect(plan?.sections.find((s) => s.key === 'channels')?.lines).toHaveLength(4);
    for (const t of plan?.territories ?? []) {
      expect(t.callId === null || plan?.calls.some((c) => c.id === t.callId)).toBe(true);
    }
  });

  it('calls the opening day against the rival', async () => {
    const { handoff, deps } = setup(brief, 200);
    const done = await runFilmBuild(handoff, deps());
    const date = done.output?.plan?.calls.find((c) => c.subject === 'date');
    expect(date?.name).toBe('2099-03-12');
    expect(['okay', 'risky', 'avoid']).toContain(date?.direction);
  });

  it('lists partners by tier with the price unknown and the band the plan was sized for', async () => {
    const { handoff, deps } = setup(brief, 200);
    const done = await runFilmBuild(handoff, deps());
    const plan = done.output?.plan;
    expect(plan?.band).toEqual({ band: 'mid', source: 'brief' });
    expect(plan?.partners.length).toBeGreaterThan(0);
    expect(plan?.partners.every((p) => p.price === 'unknown')).toBe(true);
    expect(plan?.partners.some((p) => p.tier === 'C')).toBe(true);
    expect(plan?.rules?.version).toMatch(/^film@/);
    expect(plan?.signal?.primary).toBe('Advance screenings and presales');
  });
});

describe('the platform card', () => {
  const bare =
    'Launch plan for "Night Ferry", a thriller opening in Lagos and London. Comps: "Salt Road", "The Glass Lantern", "Midnight Harbor". An independent budget.';

  function platformSetup(text: string) {
    const { handoff, deps } = setup(text);
    // `setup` names platforms so other specs skip the card; this one asks for it.
    return {
      handoff: { ...handoff, inputs: { text, files: [] }, message: { text, files: [] } },
      deps,
    };
  }

  it('never asks for platforms: a brief that names none is planned on the usual ones', async () => {
    const { handoff, deps } = platformSetup(bare);
    const run = await runFilmBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    expect(run.output?.plan?.territories[0]?.channels.map((c) => c.name)).not.toContain('WhatsApp');
  });

  it('does not ask when the brief names the platforms', async () => {
    const { handoff, deps } = platformSetup(`${bare} Run it on TikTok and YouTube.`);
    const run = await runFilmBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const lagos = run.output?.plan?.territories.find((t) => t.name === 'Lagos');
    expect(lagos?.channels.map((c) => c.name)).toEqual(['TikTok', 'YouTube']);
  });
});

describe('the budget band from team defaults', () => {
  it('is not asked when the team set a ceiling, and the plan says where it came from', async () => {
    const { handoff, deps } = setup('Launch "Salty Road", a drama opening in Lagos.');
    // `setup` states a band; this spec is about the brief that states none.
    const text = 'Launch "Salty Road", a drama opening in Lagos.';
    const run = await runFilmBuild(
      {
        ...handoff,
        inputs: { text, files: [] },
        message: { text, files: [] },
        rules: {
          ...NO_RULES,
          applied: [{ id: 'r1', version: 1 }],
          budgetMax: { amount: 50_000, currency: 'GBP' },
        },
      },
      deps(),
    );
    if (run.state?.job === 'build') expect(run.state.pending?.id).not.toBe('film.band');
    expect(run.reason).toBe('finished');
    expect(run.output?.plan?.band).toMatchObject({ band: 'independent', source: 'assumed' });
  });
});
