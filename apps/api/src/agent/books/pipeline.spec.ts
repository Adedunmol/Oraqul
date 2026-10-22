import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { briefSchema, launchPlanSchema, type ThreadEvent } from '@oraqul/schema';
import type { Handoff } from '../category-agents.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedBooksReader } from './read.js';
import { NoResearch } from './research.js';
import { booksInputsSchema, runBooksBuild } from './runs.js';
import { TemplatePlanWriter } from './writer.js';

function setup(text: string, callBudget = 120) {
  const events: ThreadEvent[] = [];
  // Most specs are not about the budget band card, so the brief states one.
  const said = { text: `${text} An independent budget.`, files: [] };
  const handoff: Handoff = {
    category: 'books',
    mode: 'build',
    title: 'The Lagos Ledger',
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
    reader: new ScriptedBooksReader(),
    queries: new ScriptedQueryPlanner(),
    research: new NoResearch(),
    writer: new TemplatePlanWriter(),
    tools: context(),
    emit: (e: ThreadEvent) => events.push(e),
  });
  return { events, handoff, deps };
}

const BRIEF =
  'Launch plan for the book "The Lagos Ledger", a debut literary novel by Ada Obi, published by an independent press with a hardcover, an ebook and an audiobook, for readers aged 25 to 44, launching in Lagos and London on 2099-03-01. Comparable books: "Americanah" and "Purple Hibiscus". Compare it with "Normal People". Bookshop "Terra Kulture".';

describe('Books build pipeline on demo data', { timeout: 30_000 }, () => {
  it('builds a debut plan with a comp shelf, a screen bridge and a recency test', async () => {
    const { events, handoff, deps } = setup(BRIEF);
    const run = await runBooksBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const output = run.output;
    if (!output?.plan) throw new Error('Expected a launch plan');
    briefSchema.parse(output.brief);
    const plan = launchPlanSchema.parse(output.plan);

    expect(events.some((e) => e.type === 'question')).toBe(false);
    expect(events.filter((e) => e.type === 'trace.step').every((e) => e.agent === 'books')).toBe(
      true,
    );

    const inputs = booksInputsSchema.parse(output.inputs);
    expect(inputs.read.book).toBe('The Lagos Ledger');
    expect(inputs.read.author).toBe('Ada Obi');
    expect(inputs.read.launchKind).toBe('debut');
    expect(inputs.read.route).toBe('traditional');
    expect(inputs.read.formats).toEqual(['print', 'ebook', 'audio']);
    expect(inputs.read.screenTitles).toEqual(['Normal People']);
    expect(inputs.read.bookshops).toEqual(['Terra Kulture']);
    expect(
      plan.comps
        .filter((c) => c.source === 'you')
        .map((c) => c.name)
        .sort(),
    ).toEqual(['Americanah', 'Purple Hibiscus']);
    // A screen title the team named is never added as a comp.
    expect(plan.comps.some((c) => c.name === 'Normal People')).toBe(false);

    const keys = plan.sections.map((s) => s.key);
    expect(keys.slice(0, 4)).toEqual(['bottom-line', 'positioning', 'audience', 'markets']);
    for (const key of ['comps', 'adaptation', 'retail', 'audio', 'events', 'timeline'] as const) {
      expect(keys).toContain(key);
    }
    for (const key of ['schools', 'crosspromo', 'tour', 'store'] as const) {
      expect(keys).not.toContain(key);
    }
    expect(keys.at(-1)).toBe('gaps');
    const timeline = plan.sections.find((s) => s.key === 'timeline');
    expect(timeline?.lines.every((l) => l.kind === 'playbook')).toBe(true);
    // The publication is 2099, so every beat is in the future and carries its dates.
    expect(timeline?.lines.some((l) => l.text.includes('2099-03-01'))).toBe(true);

    // The shelf lists recent books, never the author's own series, and fills the Comp shelf tab.
    const shelf = output.brief.shelf ?? [];
    expect(shelf.length).toBeGreaterThan(0);
    expect(shelf.some((s) => s.name === 'Nervous Conditions')).toBe(false);
    expect(plan.findings.find((f) => f.id === 'f-shelf')).toBeDefined();

    // Each comp the team named is tested for how recent it is.
    expect(output.brief.assumptions.map((a) => a.id)).toEqual(
      expect.arrayContaining(['a-comp-age-americanah', 'a-comp-age-purple-hibiscus']),
    );

    // Series, films and podcasts fill the bridge, each ranked within its own medium.
    const bridge = output.brief.bridge ?? [];
    expect(new Set(bridge.map((b) => b.medium))).toEqual(new Set(['Series', 'Film', 'Podcast']));
    expect(bridge.find((b) => b.name === 'Normal People')).toMatchObject({ note: 'Your pick' });
    expect(plan.findings.find((f) => f.id === 'f-screen-normal-people')).toBeDefined();

    // Qloo's bookshops for the readers come from a place category, per city.
    expect(plan.findings.some((f) => f.query === 'bookshops')).toBe(true);

    // Every grounded line cites a finding of this run, and every finding has a receipt.
    const findingIds = new Set(plan.findings.map((f) => f.id));
    const lineIds = new Set(run.receipts.flatMap((r) => (r.lineId ? [r.lineId] : [])));
    for (const f of plan.findings) expect(lineIds.has(f.id)).toBe(true);
    for (const s of shelf) expect(lineIds.has(s.id)).toBe(true);
    for (const b of bridge) expect(lineIds.has(b.id)).toBe(true);
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

  it('plans a self-published romance with no retail sell-in and an upload beat', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the book "Salt and Ink", a self-published contemporary romance on Kindle, launching 2099-06-01. Comparable books: "Beach Read" and "Book Lovers".',
    );
    const run = await runBooksBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const read = booksInputsSchema.parse(run.output?.inputs).read;
    expect(read.route).toBe('indie');
    expect(read.formats).toEqual(['ebook']);
    const keys = run.output?.plan?.sections.map((s) => s.key) ?? [];
    expect(keys).not.toContain('retail');
    expect(keys).not.toContain('audio');
    const timeline = run.output?.plan?.sections.find((s) => s.key === 'timeline');
    expect(timeline?.lines.some((l) => /Upload the files/.test(l.text))).toBe(true);
    expect(timeline?.lines.some((l) => /Sell in to the retail buyers/.test(l.text))).toBe(false);
  });

  it('plans a children’s book with schools and libraries', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the book "Kofi and the River", a middle grade adventure published by a children’s imprint, launching 2099-09-01 in London. Comparable books: "Wonder".',
    );
    const run = await runBooksBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const read = booksInputsSchema.parse(run.output?.inputs).read;
    expect(read.readership).toBe('children');
    const keys = run.output?.plan?.sections.map((s) => s.key) ?? [];
    expect(keys).toContain('schools');
  });

  it('opens a next book in a series with the readers of the earlier books', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the book "Ash Crown", book two of a romantasy trilogy, launching 2099-04-01. Earlier books: after "Fourth Wing". Comparable books: "A Court of Thorns and Roses".',
    );
    const run = await runBooksBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const read = booksInputsSchema.parse(run.output?.inputs).read;
    expect(read.launchKind).toBe('series');
    const keys = run.output?.plan?.sections.map((s) => s.key) ?? [];
    expect(keys).toContain('cadence');
    // The author's own series never fills the shelf.
    const shelf = run.output?.brief.shelf ?? [];
    expect(shelf.some((s) => /\(The Empyrean, #\d\)/.test(s.name))).toBe(false);
  });

  it('plans with no market named, ranking the usual markets and saying what it assumed', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the book "Quiet Rooms", a literary novel. Comparable books: "Americanah" and "Normal People".',
    );
    const run = await runBooksBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const output = run.output;
    if (!output?.plan) throw new Error('Expected a launch plan');
    expect(output.brief.places.length).toBeGreaterThanOrEqual(2);
    const gaps = output.plan.sections.find((s) => s.key === 'gaps')?.lines.map((l) => l.text) ?? [];
    expect(gaps.some((t) => /Planned as a debut launch/.test(t))).toBe(true);
    expect(gaps.some((t) => /Name the markets/.test(t))).toBe(true);
    expect(gaps.some((t) => /series or a film/.test(t))).toBe(true);
  });

  it('plans no calendar for a publication date that has passed, and says so', async () => {
    const { handoff, deps } = setup(
      'Launch plan for the book "Quiet Rooms", a literary novel, published 2019-03-01. Comparable books: "Americanah" and "Normal People".',
    );
    const run = await runBooksBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    const timeline = run.output?.plan?.sections.find((s) => s.key === 'timeline');
    expect(timeline?.lines.map((l) => l.id)).toEqual(['timeline-passed']);
  });

  it('stops with no plan when the budget runs out', async () => {
    const { handoff, deps } = setup(BRIEF, 2);
    const run = await runBooksBuild(handoff, deps());
    expect(run.reason).toBe('budget');
    expect(run.output).toBeNull();
  });

  it('reruns a what-if that adds a screen comparison, and ranks it with the others', async () => {
    const first = setup(BRIEF);
    const built = await runBooksBuild(first.handoff, first.deps());
    const inputs = built.output?.inputs;
    if (!inputs) throw new Error('Expected inputs');

    const next = setup(BRIEF);
    const run = await runBooksBuild(next.handoff, next.deps(), undefined, {
      inputs: booksInputsSchema.parse(inputs),
      change: {
        addPlaces: [],
        dropPlaces: [],
        addComps: [],
        dropComps: [],
        addCollabs: ['Bridgerton'],
        ages: [],
        gender: null,
      },
    });
    expect(run.reason).toBe('finished');
    expect(run.output?.kind).toBe('scenario');
    const read = booksInputsSchema.parse(run.output?.inputs).read;
    expect(read.screenTitles).toEqual(['Normal People', 'Bridgerton']);
    const picks = (run.output?.brief.bridge ?? [])
      .filter((b) => b.note === 'Your pick')
      .map((b) => b.name);
    expect(picks.sort()).toEqual(['Bridgerton', 'Normal People']);
  });

  it('plans from a one-line brief, with no comps named and none asked for', async () => {
    const { events, handoff, deps } = setup(
      'A Nigerian literary fiction debut, made for Nigerians.',
    );
    const run = await runBooksBuild(handoff, deps());
    expect(run.reason).toBe('finished');
    expect(events.some((e) => e.type === 'question')).toBe(false);
    const output = run.output;
    if (!output?.plan) throw new Error('Expected a launch plan from a one-line brief');
    // The comps are books like it that Oraqul chose, labelled so, never presented as the team's.
    expect(output.plan.comps.length).toBeGreaterThanOrEqual(3);
    expect(output.plan.comps.every((c) => c.source === 'added')).toBe(true);
    const read = booksInputsSchema.parse(output.inputs).read;
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
    const { handoff, deps } = setup('I want to work on my new book');
    const first = await runBooksBuild(handoff, deps());
    expect(first.reason).toBe('waiting');
    if (first.state?.job !== 'build') throw new Error('Expected a paused build');
    expect(first.state.pending?.id).toBe('books.minimum');

    const again = await runBooksBuild(handoff, deps(), {
      state: first.state,
      reply: { kind: 'typed', text: 'try again bro' },
    });
    expect(again.reason).toBe('waiting');
    expect(again.output).toBeNull();

    if (again.state?.job !== 'build') throw new Error('Expected a paused build');
    const done = await runBooksBuild(handoff, deps(), {
      state: again.state,
      reply: { kind: 'typed', text: 'a thriller for Nigerians' },
    });
    expect(done.reason).toBe('finished');
    const read = booksInputsSchema.parse(done.output?.inputs).read;
    expect(read.genre).toBe('thriller');
    expect(read.regions).toEqual(['Nigeria']);
  });
});
