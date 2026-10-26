import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import {
  type Category,
  type OutputDetail,
  outputDetailSchema,
  type ThreadEvent,
} from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import type { receipts as receiptsTable } from '../db/schema.js';
import { presentOutput } from '../outputs/present.js';
import type { Handoff, NewOutput } from './category-agents.js';
import { runFilmBuild } from './film/pipeline.js';
import { ScriptedQueryPlanner as FilmPlanner } from './film/planner.js';
import { ScriptedFilmReader } from './film/read.js';
import { NoResearch as FilmResearch } from './film/research.js';
import { TemplatePlanWriter as FilmWriter } from './film/writer.js';
import type { PlanRun } from './launch/pipeline.js';
import { ScriptedQueryPlanner as MusicPlanner } from './music/planner.js';
import { ScriptedMusicReader } from './music/read.js';
import { NoResearch as MusicResearch } from './music/research.js';
import { runMusicBuild } from './music/runs.js';
import { TemplatePlanWriter as MusicWriter } from './music/writer.js';
import { ScriptedQueryPlanner as PodcastsPlanner } from './podcasts/planner.js';
import { ScriptedPodcastsReader } from './podcasts/read.js';
import { NoResearch as PodcastsResearch } from './podcasts/research.js';
import { runPodcastsBuild } from './podcasts/runs.js';
import { TemplatePlanWriter as PodcastsWriter } from './podcasts/writer.js';

// The three examples on the marketing site are real runs on the demo data, so they show the plan
// the product writes today. `UPDATE_EXAMPLES=1` records them again; otherwise this spec fails when
// the committed examples no longer match what the pipeline produces.

const dir = fileURLToPath(new URL('../../../web/src/lib/examples/', import.meta.url));
const WHEN = '2026-10-01T10:00:00.000Z';

const briefs = {
  film: {
    title: 'Night Ferry',
    text: 'Launch plan for "Night Ferry", a Nigerian thriller film for 18 to 34 year olds, opening in Atlanta, London, Lagos and Houston on 2099-03-12. Comps: "Salt Road", "The Glass Lantern" and "Midnight Harbor". An independent budget. Platforms: Instagram, TikTok and YouTube.\nRivals: Harbor Lights on 2099-03-12; Third Mainland opens 2099-03-19',
  },
  music: {
    title: 'Night Songs',
    text: 'Launch plan for "Night Songs", an afrobeats album from artist "Neon Tide" for 18 to 34 year olds, touring Lagos, London and Houston, releasing on 2099-05-01. Sound-alikes: "Ada Lux" and "Kola Wave". An independent budget. Platforms: Instagram, TikTok and YouTube.',
  },
  podcasts: {
    title: 'Cold Case Lagos',
    text: 'Launch plan for the podcast "Cold Case Lagos", a weekly true crime interview show on Spotify and YouTube for 25 to 34 year olds, launching in Lagos and London on 2099-03-01. Comparable shows: "Crime Junkie" and "Serial". Swap with "Casefile". Rival "The Long Con". Topics: storytelling, money. A micro budget.',
  },
} as const;

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

async function run(category: 'film' | 'music' | 'podcasts', handoff: Handoff): Promise<PlanRun> {
  const common = { tools: tools(), emit: (_: ThreadEvent) => undefined };
  if (category === 'film') {
    return runFilmBuild(handoff, {
      ...common,
      reader: new ScriptedFilmReader(),
      queries: new FilmPlanner(),
      research: new FilmResearch(),
      writer: new FilmWriter(),
    });
  }
  if (category === 'music') {
    return runMusicBuild(handoff, {
      ...common,
      reader: new ScriptedMusicReader(),
      queries: new MusicPlanner(),
      research: new MusicResearch(),
      writer: new MusicWriter(),
    });
  }
  return runPodcastsBuild(handoff, {
    ...common,
    reader: new ScriptedPodcastsReader(),
    queries: new PodcastsPlanner(),
    research: new PodcastsResearch(),
    writer: new PodcastsWriter(),
  });
}

// A fixed id per example, so the committed files do not change from run to run.
const ids = (category: Category) => {
  const n = ['film', 'music', 'books', 'podcasts', 'games'].indexOf(category) + 1;
  const uuid = (k: number) => `00000000-0000-4000-8000-${String(n * 100 + k).padStart(12, '0')}`;
  return { output: uuid(1), project: uuid(2), thread: uuid(3), run: uuid(4) };
};

function detailOf(category: 'film' | 'music' | 'podcasts', out: NewOutput, made: PlanRun) {
  const id = ids(category);
  const rows = made.receipts.map((r, i): typeof receiptsTable.$inferSelect => ({
    id: `00000000-0000-4000-8000-${String(900 + i).padStart(12, '0')}`,
    runId: id.run,
    threadId: id.thread,
    outputId: id.output,
    lineId: r.lineId ?? null,
    endpoint: r.endpoint,
    input: r.input,
    // The examples never show what Qloo returned, so it is not shipped with them.
    returned: {},
    rule: r.rule,
    confidence: r.confidence,
    source: r.source,
    calledAt: new Date(WHEN),
    callId: r.callId,
    createdAt: new Date(WHEN),
  }));
  const output = presentOutput({
    row: {
      id: id.output,
      threadId: id.thread,
      projectId: id.project,
      kind: out.kind,
      parentId: null,
      title: out.title,
      brief: out.brief,
      plan: out.plan,
      report: null,
      refresh: null,
      inputs: null,
      versions: null,
      changedIds: [],
      headline: out.headline,
      moves: out.moves,
      confidence: out.confidence,
      dataAsOf: new Date(WHEN),
      createdAt: new Date(WHEN),
    },
    receipts: rows,
    category,
    createdBy: 'Example',
    version: 1,
    parentBrief: null,
  });
  return outputDetailSchema.parse({
    output,
    project: {
      id: id.project,
      category,
      name: out.title,
      kind: '',
      genre: '',
      places: out.brief.places.map((p) => p.name),
      window: '',
      lead: '',
      comps: [],
      status: 'active',
      updatedAt: WHEN,
      qlooMatch: null,
      extra: {},
    },
    thread: {
      id: id.thread,
      projectId: id.project,
      name: out.title,
      createdBy: 'Example',
      createdAt: WHEN,
      baseOutputId: id.output,
      fromOutputId: null,
      fresh: false,
    },
    builtOn: null,
    share: null,
    reaction: null,
  });
}

describe('the marketing examples', { timeout: 60_000 }, () => {
  it.each(['film', 'music', 'podcasts'] as const)(
    '%s is the plan the pipeline writes today',
    async (category) => {
      const { title, text } = briefs[category];
      const said = { text, files: [] };
      const handoff: Handoff = {
        category,
        mode: 'build',
        title,
        inputs: said,
        message: said,
        recent: [],
        planId: null,
      };
      const made = await run(category, handoff);
      expect(made.reason).toBe('finished');
      const out = made.output;
      if (!out?.plan) throw new Error('Expected a launch plan');

      const detail: OutputDetail = detailOf(category, out, made);
      // The page names these on screen, so each is a plan with the parts the product now writes.
      expect(detail.output.plan?.territories.length).toBeGreaterThan(0);
      expect(detail.output.plan?.signal).not.toBeNull();
      expect(detail.output.plan?.rules?.category).toBe(category);

      // Each call gets a random id, so the committed files use numbered ones instead.
      let json = JSON.stringify(detail, null, 2);
      made.receipts.forEach((r, i) => {
        const stable = `00000000-0000-4000-8000-${String(5000 + i).padStart(12, '0')}`;
        json = json.replaceAll(r.callId, stable);
      });
      const file = `${dir}${category}.json`;
      const next = `${json}
`;
      if (process.env.UPDATE_EXAMPLES === '1') {
        writeFileSync(file, next);
        return;
      }
      expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(JSON.parse(next));
    },
  );
});
