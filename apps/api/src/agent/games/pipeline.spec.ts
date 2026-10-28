import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { briefSchema, launchPlanSchema, type ThreadEvent } from '@oraqul/schema';
import type { Handoff } from '../category-agents.js';
import { FixtureAnalyst, fixtureAnalysis } from '../launch/fixture-analyst.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedGamesReader } from './read.js';
import { NoResearch } from './research.js';
import { gamesInputsSchema, runGamesBuild } from './runs.js';
import { TemplatePlanWriter } from './writer.js';

function setup(text: string, callBudget = 90) {
  const events: ThreadEvent[] = [];
  // Most specs are not about the budget band card, so the brief states one.
  const said = {
    text: `${text} An independent budget. Platforms: Instagram, TikTok and YouTube.`,
    files: [],
  };
  const handoff: Handoff = {
    category: 'games',
    mode: 'build',
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
  const deps = () => ({
    reader: new ScriptedGamesReader(),
    queries: new ScriptedQueryPlanner(),
    research: new NoResearch(),
    writer: new TemplatePlanWriter(),
    tools: context(),
    emit: (e: ThreadEvent) => events.push(e),
  });
  return { events, handoff, deps };
}

const BRIEF =
  'Launch plan for the game "Ember Keep", a roguelike for Steam and Switch for 18 to 34 year olds, launching in Europe and Southeast Asia on 2099-03-01. Comparable games: "Hollow Hills" and "Crown of Ash". Collab with "Pixel Choir". Store tags: Roguelike, Indie.';

describe('Games build pipeline on demo data', { timeout: 30_000 }, () => {
  it('builds a premium plan with a fan base bridge, regions, platform and tag tests', async () => {
    const { events, handoff, deps } = setup(BRIEF);
    const run = await runGamesBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const output = run.output;
    if (!output?.plan) throw new Error('Expected a launch plan');
    briefSchema.parse(output.brief);
    const plan = launchPlanSchema.parse(output.plan);

    expect(events.some((e) => e.type === 'question')).toBe(false);
    expect(events.filter((e) => e.type === 'trace.step').every((e) => e.agent === 'games')).toBe(
      true,
    );

    const inputs = gamesInputsSchema.parse(output.inputs);
    expect(inputs.read.game).toBe('Ember Keep');
    expect(inputs.read.platforms).toEqual(['pc', 'switch']);
    expect(inputs.read.regions).toEqual(['Europe', 'Southeast Asia']);
    expect(inputs.read.collabs).toEqual(['Pixel Choir']);
    expect(plan.comps.map((c) => c.name).sort()).toEqual(['Crown of Ash', 'Hollow Hills']);

    // A premium plan carries its own sections, in its own order, and code writes the calendar.
    const keys = plan.sections.map((s) => s.key);
    expect(keys.slice(0, 4)).toEqual(['bottom-line', 'positioning', 'audience', 'markets']);
    for (const key of ['store', 'events', 'collabs', 'creators', 'timeline'] as const) {
      expect(keys).toContain(key);
    }
    for (const key of ['liveops', 'earlyaccess', 'softlaunch', 'tour', 'support'] as const) {
      expect(keys).not.toContain(key);
    }
    expect(keys.at(-1)).toBe('gaps');
    const timeline = plan.sections.find((s) => s.key === 'timeline');
    expect(timeline?.lines.length).toBeGreaterThan(0);
    expect(timeline?.lines.every((l) => l.kind === 'playbook')).toBe(true);
    // The release is 2099, so every beat is in the future and carries its dates.
    expect(timeline?.lines.some((l) => l.text.includes('2099-03-01'))).toBe(true);

    // The fan bases: ranked within a medium, the collab scored in the same call as the rest.
    const fan = output.brief.fan ?? [];
    expect(fan.length).toBeGreaterThan(0);
    expect(fan.every((f) => f.before === f.after)).toBe(true);
    const collab = fan.find((f) => f.name === 'Pixel Choir');
    expect(collab).toMatchObject({ medium: 'music', note: 'Your collab' });
    expect(plan.findings.find((f) => f.id === 'f-fan-collab-pixel-choir')).toBeDefined();

    // The platforms and the store tags are tested as assumptions of their own.
    expect(output.brief.assumptions.map((a) => a.id)).toEqual(
      expect.arrayContaining(['a-platform', 'a-store-tags']),
    );

    // Every grounded line cites a finding of this run, and every finding has a receipt.
    const findingIds = new Set(plan.findings.map((f) => f.id));
    const lineIds = new Set(run.receipts.flatMap((r) => (r.lineId ? [r.lineId] : [])));
    for (const f of plan.findings) expect(lineIds.has(f.id)).toBe(true);
    for (const f of fan) expect(lineIds.has(f.id)).toBe(true);
    for (const line of plan.sections.flatMap((s) => s.lines)) {
      if (line.kind === 'grounded') {
        expect(line.findingIds.length).toBeGreaterThan(0);
        for (const id of line.findingIds) expect(findingIds.has(id)).toBe(true);
      } else {
        expect(line.findingIds).toEqual([]);
      }
      expect(line.text).not.toMatch(/receipt|[0-9a-f]{8}-[0-9a-f]{4}/i);
    }
  });

  it('plans with no region named, ranking the usual markets and saying what it assumed', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the game "Ember Keep", a roguelike. Comparable games: "Hollow Hills" and "Crown of Ash".',
    );
    const run = await runGamesBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const output = run.output;
    if (!output?.plan) throw new Error('Expected a launch plan');
    // No question: nothing past the game itself is required.
    expect(output.brief.places.length).toBeGreaterThanOrEqual(2);
    const gaps = output.plan.sections.find((s) => s.key === 'gaps')?.lines.map((l) => l.text) ?? [];
    expect(gaps.some((t) => /Planned as a premium/.test(t))).toBe(true);
    expect(gaps.some((t) => /Name the regions/.test(t))).toBe(true);
  });

  it('plans a mobile launch with a soft launch and seasons, and no festivals', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the game "Ember Keep", a free-to-play mobile roguelike on iOS and Android. Comparable games: "Void Courier" and "Lantern Row".',
    );
    const run = await runGamesBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const keys = run.output?.plan?.sections.map((s) => s.key) ?? [];
    for (const key of ['softlaunch', 'liveops', 'timeline'] as const) expect(keys).toContain(key);
    expect(keys).not.toContain('events');
    const timeline = run.output?.plan?.sections.find((s) => s.key === 'timeline');
    expect(timeline?.lines.some((l) => /soft launch/i.test(l.text))).toBe(true);
  });

  it('stops with no plan when the budget runs out', async () => {
    const { handoff, deps } = setup(BRIEF, 2);
    const run = await runGamesBuild(handoff, deps());
    expect(run.reason).toBe('budget');
    expect(run.output).toBeNull();
  });

  it('plans an early access launch with a roadmap, and no festival-first calendar', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the game "Ember Keep", a roguelike in early access on Steam, launching 2099-06-01. Comparable games: "Hollow Hills" and "Crown of Ash".',
    );
    const run = await runGamesBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const keys = run.output?.plan?.sections.map((s) => s.key) ?? [];
    expect(keys).toContain('earlyaccess');
    expect(keys).not.toContain('liveops');
    const timeline = run.output?.plan?.sections.find((s) => s.key === 'timeline');
    expect(timeline?.lines.some((l) => /roadmap/i.test(l.text))).toBe(true);
    expect(timeline?.lines.some((l) => /1\.0|second launch/i.test(l.text))).toBe(true);
  });

  it('plans no calendar for a release date that has passed, and says so', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the game "Ember Keep", a roguelike for Steam, released 2019-03-01. Comparable games: "Hollow Hills" and "Crown of Ash".',
    );
    const run = await runGamesBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const timeline = run.output?.plan?.sections.find((s) => s.key === 'timeline');
    expect(timeline?.lines.map((l) => l.id)).toEqual(['timeline-passed']);
  });

  it('reruns a what-if that adds a collab, and ranks it with the others', async () => {
    const first = setup(BRIEF);
    const built = await runGamesBuild(first.handoff, first.deps());
    const inputs = built.output?.inputs;
    if (!inputs) throw new Error('Expected inputs');

    const next = setup(BRIEF);
    const run = await runGamesBuild(next.handoff, next.deps(), undefined, {
      inputs: gamesInputsSchema.parse(inputs),
      change: {
        addPlaces: [],
        dropPlaces: [],
        addComps: [],
        dropComps: [],
        addCollabs: ['Kitsune Drift'],
        ages: [],
        gender: null,
      },
    });
    expect(run.reason).toBe('finished');
    expect(run.output?.kind).toBe('scenario');
    expect(run.output?.title).toContain('collab with Kitsune Drift');
    const read = gamesInputsSchema.parse(run.output?.inputs).read;
    expect(read.collabs).toEqual(['Pixel Choir', 'Kitsune Drift']);
    const names = (run.output?.brief.fan ?? [])
      .filter((f) => f.note === 'Your collab')
      .map((f) => f.name);
    expect(names.sort()).toEqual(['Kitsune Drift', 'Pixel Choir']);
  });

  it('says so when a region has no cities in the table, and ranks the rest', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the game "Ember Keep", a roguelike for Steam, launching in Europe and Atlantis. Comparable games: "Hollow Hills" and "Crown of Ash".',
    );
    const reader = deps().reader;
    const read = await reader.read({ title: 'Ember Keep', text: handoff.message.text });
    // The scripted reader only reads regions the table knows, so a model's unknown region is
    // checked here by adding it to the reading.
    const run = await runGamesBuild(handoff, {
      ...deps(),
      reader: {
        read: async () => ({
          reading: {
            ...read.reading,
            regions: [...read.reading.regions, { value: 'Atlantis', quote: 'Atlantis' }],
          },
          tokens: 0,
        }),
      },
    });
    expect(run.reason).toBe('finished');
    expect(run.output?.brief.cannot.map((c) => c.item)).toEqual(
      expect.arrayContaining(['Region: Atlantis']),
    );
  });

  it('plans from a one-line brief, with no comps named and none asked for', async () => {
    const { events, handoff, deps } = setup(
      'A Nigerian mobile video game that involves shooting, built for Nigerians.',
    );
    const chosen = ['Call of Duty Mobile', 'PUBG MOBILE', 'Garena Free Fire', 'Brawl Stars'];
    const run = await runGamesBuild(handoff, {
      ...deps(),
      analyst: new FixtureAnalyst(
        fixtureAnalysis(chosen, 'Mobile players in Nigeria who like shooters'),
      ),
    });
    expect(run.reason).toBe('finished');
    expect(events.some((e) => e.type === 'question')).toBe(false);
    const output = run.output;
    if (!output?.plan) throw new Error('Expected a launch plan from a one-line brief');
    // The comps are games Oraqul chose from the description, labelled so, never the team's.
    expect(output.plan.comps.length).toBeGreaterThanOrEqual(3);
    expect(output.plan.comps.every((c) => c.source === 'added' && c.why)).toBe(true);
    // A mobile game, and the audience is Nigeria: Lagos and Abuja are ranked.
    const read = gamesInputsSchema.parse(output.inputs).read;
    expect(read.launchKind).toBe('mobile');
    expect(read.regions).toEqual(['Nigeria']);
    expect(output.brief.places.map((p) => p.name).sort()).toEqual(['Abuja', 'Lagos']);
    const keys = output.plan.sections.map((s) => s.key);
    expect(keys).toContain('softlaunch');
    // The language and culture Qloo cannot measure reach the plan as playbook, never as taste.
    expect(read.audienceNote).toBe('Nigerians');
    const audience = output.plan.sections
      .find((s) => s.key === 'positioning')
      ?.lines.find((l) => l.group === 'Audience');
    expect(audience?.kind).toBe('playbook');
    expect(audience?.text).toContain('Nigerians');
    const gaps = output.plan.sections.find((s) => s.key === 'gaps')?.lines.map((l) => l.text) ?? [];
    expect(gaps.some((t) => /I chose the comparable games/.test(t))).toBe(true);
  });

  it('remembers what the person said earlier in the chat when they ask again', async () => {
    const { handoff, deps } = setup('try again bro');
    const withChat: Handoff = {
      ...handoff,
      inputs: { text: 'I want to work on my new game', files: [] },
      recent: [
        { from: 'person', text: 'I want to work on my new game' },
        { from: 'oraqul', text: 'To plan this I need what the game is.' },
        {
          from: 'person',
          text: 'it is a mobile video game that involves shooting, built for Nigerians',
        },
        { from: 'oraqul', text: 'I could not find comps.' },
      ],
    };
    const run = await runGamesBuild(withChat, deps());
    // No question, and a plan: the earlier description was read, not lost.
    expect(run.reason).toBe('finished');
    expect(run.output?.plan).not.toBeNull();
    const read = gamesInputsSchema.parse(run.output?.inputs).read;
    expect(read.launchKind).toBe('mobile');
    expect(read.regions).toEqual(['Nigeria']);
  });

  it('asks what it is and where to launch, once, when a brief says neither', async () => {
    const { events, handoff, deps } = setup('I want to work on my new game');
    const first = await runGamesBuild(handoff, deps());
    expect(first.output).toBeNull();
    expect(events.find((e) => e.type === 'question')).toMatchObject({
      id: 'games.describe',
      card: 'text',
    });
  });

  it('ranks a country the pack has no entry for, from the cities the table has in it', async () => {
    const { handoff, deps } = setup('A Ghanaian mobile shooter, built for Ghanaians.');
    const run = await runGamesBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const read = gamesInputsSchema.parse(run.output?.inputs).read;
    expect(read.regions).toEqual(['Ghana']);
    expect(run.output?.brief.places.map((p) => p.name)).toEqual(['Accra']);
  });
});
