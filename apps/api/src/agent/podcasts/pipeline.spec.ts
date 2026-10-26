import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { briefSchema, launchPlanSchema, type ThreadEvent } from '@oraqul/schema';
import type { Handoff } from '../category-agents.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedPodcastsReader } from './read.js';
import { NoResearch } from './research.js';
import { podcastsInputsSchema, runPodcastsBuild } from './runs.js';
import { TemplatePlanWriter } from './writer.js';

function setup(
  text: string,
  callBudget = 90,
  platforms = ' Platforms: Instagram, TikTok and YouTube.',
) {
  const events: ThreadEvent[] = [];
  // Most specs are not about the budget band card, so the brief states one.
  const said = {
    text: `${text} An independent budget.${platforms}`,
    files: [],
  };
  const handoff: Handoff = {
    category: 'podcasts',
    mode: 'build',
    title: 'Cold Case Lagos',
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
    reader: new ScriptedPodcastsReader(),
    queries: new ScriptedQueryPlanner(),
    research: new NoResearch(),
    writer: new TemplatePlanWriter(),
    tools: context(),
    emit: (e: ThreadEvent) => events.push(e),
  });
  return { events, handoff, deps };
}

const BRIEF =
  'Launch plan for the podcast "Cold Case Lagos", a weekly true crime interview show on Spotify and YouTube for 25 to 34 year olds, launching in Lagos and London on 2099-03-01. Comparable shows: "Crime Junkie" and "Serial". Swap with "Casefile". Rival "The Long Con". Topics: storytelling, money.';

describe('Podcasts build pipeline on demo data', { timeout: 30_000 }, () => {
  it('builds a new show plan with a topic map, swap ranking and topic tests', async () => {
    const { events, handoff, deps } = setup(BRIEF);
    const run = await runPodcastsBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const output = run.output;
    if (!output?.plan) throw new Error('Expected a launch plan');
    briefSchema.parse(output.brief);
    const plan = launchPlanSchema.parse(output.plan);

    expect(events.some((e) => e.type === 'question')).toBe(false);
    expect(events.filter((e) => e.type === 'trace.step').every((e) => e.agent === 'podcasts')).toBe(
      true,
    );

    const inputs = podcastsInputsSchema.parse(output.inputs);
    expect(inputs.read.show).toBe('Cold Case Lagos');
    expect(inputs.read.format).toBe('both');
    expect(inputs.read.platforms).toEqual(['spotify', 'youtube']);
    expect(inputs.read.crossPromo).toEqual(['Casefile']);
    expect(inputs.read.rivals).toEqual(['The Long Con']);
    expect(inputs.read.topics).toEqual(['storytelling', 'money']);
    expect(
      plan.comps
        .filter((c) => c.source === 'you')
        .map((c) => c.name)
        .sort(),
    ).toEqual(['Crime Junkie', 'Serial']);
    // A swap partner the team named is never added as a comp.
    expect(plan.comps.some((c) => c.name === 'Casefile')).toBe(false);

    const keys = plan.sections.map((s) => s.key);
    expect(keys.slice(0, 4)).toEqual(['bottom-line', 'positioning', 'audience', 'markets']);
    for (const key of ['crosspromo', 'video', 'live', 'cadence', 'timeline'] as const) {
      expect(keys).toContain(key);
    }
    for (const key of ['softlaunch', 'tour', 'support', 'store'] as const) {
      expect(keys).not.toContain(key);
    }
    expect(keys.at(-1)).toBe('gaps');
    const timeline = plan.sections.find((s) => s.key === 'timeline');
    expect(timeline?.lines.every((l) => l.kind === 'playbook')).toBe(true);
    // The release is 2099, so every beat is in the future and carries its dates.
    expect(timeline?.lines.some((l) => l.text.includes('2099-03-01'))).toBe(true);

    // The topic map comes from one comparison call and fills the Topic map tab.
    const topics = output.brief.topics ?? [];
    expect(topics.length).toBeGreaterThan(0);
    expect(plan.findings.find((f) => f.id === 'f-topics')).toBeDefined();
    expect(topics.every((t) => t.ownership === 'distinct' || t.weight === 1)).toBe(true);
    // Each topic the team wants to own is tested as an assumption of its own.
    expect(output.brief.assumptions.map((a) => a.id)).toEqual(
      expect.arrayContaining(['a-topic-storytelling', 'a-topic-money']),
    );

    // The swap partner is scored in the same call as the shows the audience hears.
    const fan = output.brief.fan ?? [];
    expect(fan.length).toBeGreaterThan(0);
    expect(fan.every((f) => f.medium === 'podcast' && f.before === f.after)).toBe(true);
    expect(fan.find((f) => f.name === 'Casefile')).toMatchObject({ note: 'Your pick' });
    expect(plan.findings.find((f) => f.id === 'f-promo-casefile')).toBeDefined();

    // Every grounded line cites a finding of this run, and every finding has a receipt.
    const findingIds = new Set(plan.findings.map((f) => f.id));
    const lineIds = new Set(run.receipts.flatMap((r) => (r.lineId ? [r.lineId] : [])));
    for (const f of plan.findings) expect(lineIds.has(f.id)).toBe(true);
    for (const f of fan) expect(lineIds.has(f.id)).toBe(true);
    for (const t of topics) expect(lineIds.has(t.id)).toBe(true);
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

  it('plans a new season with its own beats, and no video section for an audio show', async () => {
    const { handoff, deps } = setup(
      'Launch plan for season 2 of the podcast "Cold Case Lagos", an audio only true crime show on Apple Podcasts, launching 2099-06-01. Comparable shows: "Crime Junkie" and "Serial".',
    );
    const run = await runPodcastsBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const read = podcastsInputsSchema.parse(run.output?.inputs).read;
    expect(read.launchKind).toBe('season');
    expect(read.format).toBe('audio');
    const keys = run.output?.plan?.sections.map((s) => s.key) ?? [];
    expect(keys).not.toContain('video');
    const timeline = run.output?.plan?.sections.find((s) => s.key === 'timeline');
    expect(timeline?.lines.some((l) => /back-catalogue|earlier seasons/i.test(l.text))).toBe(true);
  });

  it('anchors on an earlier show but never lists it or reruns with it as a comp', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the podcast "Cold Case Lagos", a true crime show from the makers of "Casefile", launching 2099-03-01. Comparable shows: "Crime Junkie" and "Serial".',
    );
    const run = await runPodcastsBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const earlier = run.output?.plan?.comps.find((c) => /casefile/i.test(c.name));
    expect(earlier?.anchor).toBe(true);
    const named = run.output?.plan?.comps.filter((c) => !c.anchor).map((c) => c.name) ?? [];
    expect(named).toEqual(expect.arrayContaining(['Crime Junkie', 'Serial']));
    expect(named.some((n) => /casefile/i.test(n))).toBe(false);
    const inputs = podcastsInputsSchema.parse(run.output?.inputs);
    expect(inputs.comps.some((n) => /casefile/i.test(n))).toBe(false);
  });

  it('plans with no market named, ranking the usual markets and saying what it assumed', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the podcast "Cold Case Files", a true crime show. Comparable shows: "Crime Junkie" and "Serial".',
    );
    const run = await runPodcastsBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const output = run.output;
    if (!output?.plan) throw new Error('Expected a launch plan');
    expect(output.brief.places.length).toBeGreaterThanOrEqual(2);
    const gaps = output.plan.sections.find((s) => s.key === 'gaps')?.lines.map((l) => l.text) ?? [];
    expect(gaps.some((t) => /Planned as a new show/.test(t))).toBe(true);
    expect(gaps.some((t) => /Name the markets/.test(t))).toBe(true);
    expect(gaps.some((t) => /Name the topics/.test(t))).toBe(true);
  });

  it('plans no calendar for a release date that has passed, and says so', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the podcast "Cold Case Lagos", a true crime show, released 2019-03-01. Comparable shows: "Crime Junkie" and "Serial".',
    );
    const run = await runPodcastsBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const timeline = run.output?.plan?.sections.find((s) => s.key === 'timeline');
    expect(timeline?.lines.map((l) => l.id)).toEqual(['timeline-passed']);
  });

  it('stops with no plan when the budget runs out', async () => {
    const { handoff, deps } = setup(BRIEF, 2);
    const run = await runPodcastsBuild(handoff, deps());
    expect(run.reason).toBe('budget');
    expect(run.output).toBeNull();
  });

  it('reruns a what-if that adds a swap, and ranks it with the others', async () => {
    const first = setup(BRIEF);
    const built = await runPodcastsBuild(first.handoff, first.deps());
    const inputs = built.output?.inputs;
    if (!inputs) throw new Error('Expected inputs');

    const next = setup(BRIEF);
    const run = await runPodcastsBuild(next.handoff, next.deps(), undefined, {
      inputs: podcastsInputsSchema.parse(inputs),
      change: {
        addPlaces: [],
        dropPlaces: [],
        addComps: [],
        dropComps: [],
        addCollabs: ['SmartLess'],
        ages: [],
        gender: null,
      },
    });
    expect(run.reason).toBe('finished');
    expect(run.output?.kind).toBe('scenario');
    const read = podcastsInputsSchema.parse(run.output?.inputs).read;
    expect(read.crossPromo).toEqual(['Casefile', 'SmartLess']);
    const names = (run.output?.brief.fan ?? [])
      .filter((f) => f.note === 'Your pick')
      .map((f) => f.name);
    expect(names.sort()).toEqual(['Casefile', 'SmartLess']);
  });

  it('plans from a one-line brief, with no comps named and none asked for', async () => {
    const { events, handoff, deps } = setup(
      'A Nigerian true crime podcast on YouTube, made for Nigerians.',
    );
    const run = await runPodcastsBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    expect(events.some((e) => e.type === 'question')).toBe(false);
    const output = run.output;
    if (!output?.plan) throw new Error('Expected a launch plan from a one-line brief');
    // The comps are shows like it that Oraqul chose, labelled so, never presented as the team's.
    expect(output.plan.comps.length).toBeGreaterThanOrEqual(3);
    expect(output.plan.comps.every((c) => c.source === 'added')).toBe(true);
    const read = podcastsInputsSchema.parse(output.inputs).read;
    expect(read.format).toBe('video');
    expect(read.regions).toEqual(['Nigeria']);
    expect(output.brief.places.map((p) => p.name).sort()).toEqual(['Abuja', 'Lagos']);
    // The language and culture Qloo cannot measure reach the plan as playbook, never as taste.
    expect(read.audienceNote).toBe('Nigerians');
    const audience = output.plan.sections
      .find((s) => s.key === 'positioning')
      ?.lines.find((l) => l.group === 'Audience');
    expect(audience?.kind).toBe('playbook');
  });

  it('asks again, and plans nothing, when the answer to the one question says nothing', async () => {
    const { handoff, deps } = setup('I want to work on my new podcast', 90, '');
    const first = await runPodcastsBuild(handoff, deps());
    expect(first.reason).toBe('waiting');
    if (first.state?.job !== 'build') throw new Error('Expected a paused build');
    expect(first.state.pending?.id).toBe('podcasts.minimum');

    const again = await runPodcastsBuild(handoff, deps(), {
      state: first.state,
      reply: { kind: 'typed', text: 'try again bro' },
    });
    expect(again.reason).toBe('waiting');
    expect(again.output).toBeNull();

    if (again.state?.job !== 'build') throw new Error('Expected a paused build');
    const done = await runPodcastsBuild(handoff, deps(), {
      state: again.state,
      reply: {
        kind: 'typed',
        text: 'a weekly football chat show for Nigerians, on Instagram and TikTok',
      },
    });
    expect(done.reason).toBe('finished');
    const read = podcastsInputsSchema.parse(done.output?.inputs).read;
    expect(read.genre).toBe('football');
    expect(read.regions).toEqual(['Nigeria']);
  });
});
