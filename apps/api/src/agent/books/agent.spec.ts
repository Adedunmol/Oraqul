import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import type { ThreadEvent } from '@oraqul/schema';
import type { Handoff } from '../category-agents.js';
import { ScriptedFollowUpReader } from '../launch/follow-up.js';
import { ScriptedResultsReader } from '../launch/results-read.js';
import { BooksAgent } from './agent.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedBooksReader } from './read.js';
import { TemplateReportWriter } from './report-writer.js';
import { NoResearch } from './research.js';
import { TemplatePlanWriter } from './writer.js';

const agent = () =>
  new BooksAgent({
    reader: new ScriptedBooksReader(),
    queries: new ScriptedQueryPlanner(),
    writer: new TemplatePlanWriter(),
    results: new ScriptedResultsReader(),
    report: new TemplateReportWriter(),
    research: new NoResearch(),
    followUps: new ScriptedFollowUpReader({ collabs: true }),
    tools: (): ToolContext => ({
      qloo: new QlooClient({
        baseUrl: 'https://demo.invalid',
        apiKey: 'demo',
        fetch: demoFetch,
        callBudget: 120,
        retryDelayMs: 0,
      }),
      source: 'demo',
      entities: new Map<string, SeenEntity>(),
    }),
    plan: async () => null,
    planner: () => {
      throw new Error('No plan, so no planner is needed');
    },
    maxSteps: 4,
  });

const PLAN =
  'The Lagos Ledger launch plan. The book "The Lagos Ledger", a debut literary novel for readers aged 25 to 44, launching in London and Lagos. Comparable books: "Americanah" and "Purple Hibiscus". Compare it with "Normal People".';

describe('Books agent: the job a message does before a chat has a plan', () => {
  const handoff = (text: string, mode: Handoff['mode']): Handoff => ({
    category: 'books',
    mode,
    title: 'The Lagos Ledger',
    inputs: { text: 'I want to work on my new book', files: [] },
    message: {
      text: `${text} An independent budget. Platforms: Instagram, TikTok and YouTube.`,
      files: [],
    },
    recent: [],
    planId: null,
  });

  it('runs an audit when a build project is asked to audit a plan in plain words', async () => {
    const events: ThreadEvent[] = [];
    const run = await agent().run(handoff(`I want to audit this plan\n\n${PLAN}`, 'build'), (e) =>
      events.push(e),
    );
    expect(run.reason).toBe('finished');
    expect(run.output?.kind).toBe('audit');
    expect(run.output?.plan).toBeNull();
    expect(run.output?.report?.items.map((i) => i.id)).toContain('a-screen-normal-people');
  });

  it('still builds when the message asks for nothing else', async () => {
    const run = await agent().run(
      handoff(
        'A literary novel for Lagos. Comparable books: "Americanah" and "Purple Hibiscus".',
        'build',
      ),
      () => undefined,
    );
    expect(run.output?.kind).toBe('build');
  });
});
