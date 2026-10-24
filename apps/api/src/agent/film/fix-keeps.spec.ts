import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { auditReportSchema, launchPlanSchema } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import type { Handoff, Reply } from '../category-agents.js';
import { ScriptedResultsReader } from '../launch/results-read.js';
import { runFilmFix } from './fix.js';
import { ScriptedQueryPlanner } from './planner.js';
import { ScriptedFilmReader } from './read.js';
import { TemplateReportWriter } from './report-writer.js';
import { NoResearch } from './research.js';
import { TemplatePlanWriter } from './writer.js';

const PLAN =
  'Night Ferry launch plan. A thriller film for women aged 25 to 34, opening in Lagos and London on 2099-03-12. Comps: "Salt Road", "The Glass Lantern" and "Midnight Harbor". An independent budget. Channels we already use: Instagram and TikTok.\nRivals: Harbor Lights on 2099-03-12';

describe('a fix keeps what the brief set (D3, D6, D10)', { timeout: 20_000 }, () => {
  it('keeps the rival days, the band and the platforms in the plan it writes', async () => {
    const said = { text: PLAN, files: [] };
    const handoff: Handoff = {
      category: 'film',
      mode: 'fix',
      title: 'Night Ferry',
      inputs: said,
      message: said,
      recent: [],
      planId: null,
    };
    const deps = () => ({
      reader: new ScriptedFilmReader(),
      queries: new ScriptedQueryPlanner(),
      research: new NoResearch(),
      writer: new TemplatePlanWriter(),
      results: new ScriptedResultsReader(),
      report: new TemplateReportWriter(),
      tools: {
        qloo: new QlooClient({
          baseUrl: 'https://demo.invalid',
          apiKey: 'demo',
          fetch: demoFetch,
          callBudget: 120,
          retryDelayMs: 0,
        }),
        source: 'demo',
        entities: new Map<string, SeenEntity>(),
      } satisfies ToolContext,
      emit: () => undefined,
    });
    let run = await runFilmFix(handoff, deps());
    const pending = run.state?.pending;
    if (!run.state || !pending) throw new Error('Expected the fix to ask whether it has launched');
    const reply: Reply = { kind: 'options', questionId: pending.id, optionIds: ['pre'] };
    run = await runFilmFix(handoff, deps(), { state: run.state as never, reply });
    expect(run.reason).toBe('finished');
    auditReportSchema.parse(run.earlier?.find((o) => o.kind === 'audit')?.report);
    const plan = launchPlanSchema.parse(run.output?.plan);
    expect(plan.findings.map((f) => f.id)).toContain('f-clash');
    expect(plan.calls.some((c) => c.subject === 'date' && c.name === '2099-03-12')).toBe(true);
    expect(plan.band).toMatchObject({ band: 'independent', source: 'brief' });
    const lagos = plan.territories.find((t) => t.name === 'Lagos');
    expect(lagos?.channels.map((c) => c.name).sort()).toEqual(['Instagram', 'TikTok']);
  });
});
