import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import type { Output, ThreadEvent } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import type { receipts as receiptsTable } from '../../db/schema.js';
import { presentOutput } from '../../outputs/present.js';
import type { Handoff } from '../category-agents.js';
import { ScriptedResultsReader } from '../launch/results-read.js';
import { FilmAgent } from './agent.js';
import { ScriptedFollowUpReader } from './follow-up.js';
import { runFilmBuild } from './pipeline.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedFilmReader } from './read.js';
import { TemplateReportWriter } from './report-writer.js';
import { NoResearch } from './research.js';
import { TemplatePlanWriter } from './writer.js';

// A partner brief on a recorded plan, with the pitch kit. `UPDATE_GOLDEN=1` records it again.
const file = fileURLToPath(
  new URL('../../../../../packages/eval/golden/partners/film-partner-brief.json', import.meta.url),
);
const WHEN = '2099-01-01T10:00:00.000Z';
const BRIEF =
  'Launch plan for "Night Ferry", a thriller film for 18 to 34 year olds, opening in Lagos and London on 2099-03-12. Comps: "Salt Road", "The Glass Lantern" and "Midnight Harbor". An independent budget. Platforms: Instagram, TikTok and YouTube.';

const tools = (): ToolContext => ({
  qloo: new QlooClient({
    baseUrl: 'https://demo.invalid',
    apiKey: 'demo',
    fetch: demoFetch,
    callBudget: 200,
    retryDelayMs: 0,
  }),
  source: 'demo',
  entities: new Map<string, SeenEntity>(),
});

describe('a partner brief with its pitch kit', { timeout: 60_000 }, () => {
  it('scores the partner, drafts the pitch and builds the kit from the plan', async () => {
    const said = { text: BRIEF, files: [] };
    const handoff: Handoff = {
      category: 'film',
      mode: 'build',
      title: 'Night Ferry',
      inputs: said,
      message: said,
      recent: [],
      planId: null,
    };
    const built = await runFilmBuild(handoff, {
      tools: tools(),
      emit: (_: ThreadEvent) => undefined,
      reader: new ScriptedFilmReader(),
      queries: new ScriptedQueryPlanner(),
      research: new NoResearch(),
      writer: new TemplatePlanWriter(),
    });
    const made = built.output;
    if (!made?.plan) throw new Error('Expected a launch plan');
    const id = '00000000-0000-4000-8000-000000000001';
    const rows = built.receipts.map((r, i): typeof receiptsTable.$inferSelect => ({
      id: `00000000-0000-4000-8000-${String(900 + i).padStart(12, '0')}`,
      runId: id,
      threadId: id,
      outputId: id,
      lineId: r.lineId ?? null,
      endpoint: r.endpoint,
      input: r.input,
      returned: {},
      rule: r.rule,
      confidence: r.confidence,
      source: r.source,
      calledAt: new Date(WHEN),
      callId: r.callId,
      createdAt: new Date(WHEN),
    }));
    const output: Output = presentOutput({
      row: {
        id,
        threadId: id,
        projectId: id,
        kind: made.kind,
        parentId: null,
        title: made.title,
        brief: made.brief,
        plan: made.plan,
        report: null,
        inputs: null,
        versions: null,
        changedIds: [],
        headline: made.headline,
        moves: made.moves,
        confidence: made.confidence,
        dataAsOf: new Date(WHEN),
        createdAt: new Date(WHEN),
      },
      receipts: rows,
      category: 'film',
      createdBy: 'Golden',
      version: 1,
      parentBrief: null,
    });

    const agent = new FilmAgent({
      reader: new ScriptedFilmReader(),
      queries: new ScriptedQueryPlanner(),
      writer: new TemplatePlanWriter(),
      results: new ScriptedResultsReader(),
      report: new TemplateReportWriter(),
      research: new NoResearch(),
      followUps: new ScriptedFollowUpReader(),
      tools,
      plan: async () => ({ output, inputs: made.inputs }),
      planner: () => {
        throw new Error('A partner brief needs no planner');
      },
      maxSteps: 4,
    });
    const asked = { text: 'Draft a partner brief for "Fizz Cola"', files: [] };
    const run = await agent.run(
      { ...handoff, message: asked, recent: [], planId: id },
      () => undefined,
    );
    expect(run.reason).toBe('finished');
    const partner = run.output?.brief.partners[0];
    if (!partner?.kit) throw new Error('Expected a partner brief with a kit');

    const got = {
      name: partner.name,
      type: partner.type,
      kit: {
        whyCitesFinding: partner.kit.why.findingIds.length > 0,
        gets: partner.kit.gets.length,
        ideas: partner.kit.ideas.length,
        timeline: partner.kit.timeline.map((t) => t.replace(/\d{4}-\d{2}-\d{2}/, 'DATE')),
        ask: partner.kit.ask,
        room: partner.kit.room,
        scriptIsDraft: partner.kit.script === partner.draft,
      },
    };
    if (process.env.UPDATE_GOLDEN === '1') {
      writeFileSync(file, `${JSON.stringify(got, null, 2)}\n`);
      return;
    }
    expect(got).toEqual(JSON.parse(readFileSync(file, 'utf8')));
  });
});
