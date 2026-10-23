import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import type { ThreadEvent } from '@oraqul/schema';
import type { Handoff } from '../category-agents.js';
import { ScriptedFollowUpReader } from '../launch/follow-up.js';
import { ScriptedResultsReader } from '../launch/results-read.js';
import { PodcastsAgent } from './agent.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedPodcastsReader } from './read.js';
import { TemplateReportWriter } from './report-writer.js';
import { NoResearch } from './research.js';
import { TemplatePlanWriter } from './writer.js';

const agent = () =>
  new PodcastsAgent({
    reader: new ScriptedPodcastsReader(),
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
  'Cold Case Files launch plan. The podcast "Cold Case Files", a weekly true crime interview show on Spotify for people aged 25 to 34, launching in London and Lagos. Comparable shows: "Crime Junkie" and "Serial". Topics: storytelling, money.';

describe('Podcasts agent: the job a message does before a chat has a plan', () => {
  const handoff = (text: string, mode: Handoff['mode']): Handoff => ({
    category: 'podcasts',
    mode,
    title: 'Cold Case Files',
    inputs: { text: 'I want to work on my new podcast', files: [] },
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
    expect(run.output?.report?.items.map((i) => i.id)).toContain('a-topic-storytelling');
  });

  it('still builds when the message asks for nothing else', async () => {
    const run = await agent().run(
      handoff(
        'A true crime show for Spotify. Comparable shows: "Crime Junkie" and "Serial".',
        'build',
      ),
      () => undefined,
    );
    expect(run.output?.kind).toBe('build');
  });
});
