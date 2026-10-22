import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import type { ThreadEvent } from '@oraqul/schema';
import type { Handoff } from '../category-agents.js';
import { ScriptedFollowUpReader } from '../launch/follow-up.js';
import { ScriptedResultsReader } from '../launch/results-read.js';
import { GamesAgent } from './agent.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedGamesReader } from './read.js';
import { TemplateReportWriter } from './report-writer.js';
import { NoResearch } from './research.js';
import { TemplatePlanWriter } from './writer.js';

const agent = () =>
  new GamesAgent({
    reader: new ScriptedGamesReader(),
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
        callBudget: 90,
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
  'Ember Keep launch plan. The game "Ember Keep", a roguelike for Steam and Xbox for people aged 25 to 34, launching in London and Berlin. Comparable games: "Hollow Hills" and "Crown of Ash".';

describe('Games agent: the job a message does before a chat has a plan', () => {
  const handoff = (text: string, mode: Handoff['mode']): Handoff => ({
    category: 'games',
    mode,
    title: 'Ember Keep',
    inputs: { text: 'I want to work on my new game', files: [] },
    message: { text: `${text} An independent budget.`, files: [] },
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
    expect(run.output?.report?.items.map((i) => i.id)).toContain('a-platform');
  });

  it('still builds when the message asks for nothing else', async () => {
    const run = await agent().run(
      handoff(
        `A roguelike for Steam. Comparable games: "Hollow Hills" and "Crown of Ash".`,
        'build',
      ),
      () => undefined,
    );
    expect(run.output?.kind).toBe('build');
  });
});
