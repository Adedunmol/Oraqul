import { demoFetch, QlooClient, type SeenEntity, type ToolContext } from '@oraqul/engine';
import { auditReportSchema, type RuleCheck, type ThreadEvent } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import type { Handoff } from '../category-agents.js';
import { ScriptedResultsReader } from '../launch/results-read.js';
import { ruleChecks, showsLaunch } from './config.js';
import { ScriptedQueryPlanner } from './planner.js';
import { checkReading, ScriptedShowsReader, type ShowsRead } from './read.js';
import { TemplateReportWriter } from './report-writer.js';
import { NoResearch } from './research.js';
import { runShowsAudit, type ShowsAuditDeps } from './runs.js';
import { TemplatePlanWriter } from './writer.js';

const TODAY = '2099-01-01';

const read = (over: Partial<ShowsRead>): ShowsRead => ({
  act: 'Neon Tide',
  showType: 'comedy',
  genre: null,
  country: null,
  budget: null,
  capacity: null,
  priceBand: null,
  onSaleWeeks: null,
  partners: [],
  supportActs: [],
  rivalDates: [],
  scope: 'full',
  ask: null,
  comps: [],
  places: ['Lagos'],
  window: '2099-03-12',
  ages: [],
  gender: null,
  suggestedComps: [],
  ...over,
});

const byId = (checks: RuleCheck[], id: string) => checks.find((c) => c.id === id);

describe('ruleChecks: the plan set beside the live show rules', () => {
  it('checks the on-sale window against E1 for the kind of show', () => {
    expect(byId(ruleChecks(read({ onSaleWeeks: 5 }), '', TODAY), 'rule-on-sale')?.status).toBe(
      'follows',
    );
    expect(byId(ruleChecks(read({ onSaleWeeks: 10 }), '', TODAY), 'rule-on-sale')?.status).toBe(
      'outside',
    );
    expect(byId(ruleChecks(read({}), '', TODAY), 'rule-on-sale')?.status).toBe('not-stated');
  });

  it('has no rule to check a theatre or screening window against, and says so', () => {
    const check = byId(
      ruleChecks(read({ showType: 'theatre', onSaleWeeks: 8 }), '', TODAY),
      'rule-on-sale',
    );
    expect(check?.status).toBe('no-rule');
    expect(check?.why).toContain('no rule to check it against');
  });

  it('checks the presale against E3: 3 to 7 days ahead, and never without an end date', () => {
    const status = (plan: string) => byId(ruleChecks(read({}), plan, TODAY), 'rule-presale');
    expect(
      status('A presale opens 5 days before general on sale and closes on 1 March.')?.status,
    ).toBe('follows');
    expect(
      status('A presale opens 14 days before general on sale and closes on 1 March.')?.status,
    ).toBe('outside');
    const open = status('We run a presale for fans before tickets go on sale.');
    expect(open?.status).toBe('outside');
    expect(open?.why).toContain('no end date');
    expect(status('Tickets go on sale in February.')?.status).toBe('not-stated');
  });

  it('checks the final push reserve against E4', () => {
    const status = (plan: string, over: Partial<ShowsRead> = {}) =>
      byId(ruleChecks(read(over), plan, TODAY), 'rule-final-push');
    expect(status('Budget: 50% announce, 10% middle, 40% final push.')?.status).toBe('follows');
    expect(status('Budget: 90% on sale, 10% for the final week.')?.status).toBe('outside');
    expect(status('Spend it all in the first month.')?.status).toBe('not-stated');
    expect(
      status('Budget: 70% at announce, 30% in the middle, nothing held for the last week.')?.status,
    ).toBe('outside');
  });

  it('puts a window the plan gave outside the rule right in a fix, and leaves one inside', () => {
    expect(showsLaunch.fixed?.(read({ onSaleWeeks: 10 })).onSaleWeeks).toBeNull();
    expect(showsLaunch.fixed?.(read({ onSaleWeeks: 5 })).onSaleWeeks).toBe(5);
    expect(showsLaunch.fixed?.(read({ showType: 'theatre', onSaleWeeks: 9 })).onSaleWeeks).toBe(9);
  });

  it('flags a rival within a week of the show, and not one further away', () => {
    const status = (rivals: { title: string; date: string }[]) =>
      byId(ruleChecks(read({ rivalDates: rivals }), '', TODAY), 'rule-rivals');
    expect(status([{ title: 'Big Night', date: '2099-03-14' }])?.status).toBe('outside');
    expect(status([{ title: 'Big Night', date: '2099-04-20' }])?.status).toBe('follows');
    expect(status([])?.status).toBe('not-stated');
  });

  it('is a check against a rule and not a Qloo verdict: no confidence, a rule id', () => {
    for (const c of ruleChecks(read({ onSaleWeeks: 5 }), '', TODAY)) {
      expect(c.ruleId).toMatch(/^shows\./);
      expect(c).not.toHaveProperty('confidence');
    }
  });
});

describe('Live shows audit on demo data', { timeout: 20_000 }, () => {
  const PLAN =
    'Night Songs Live plan. A concert by artist "Neon Tide" for people aged 25 to 34, playing Lagos and London on 2099-03-12. On sale 8 weeks before the show. A presale opens 5 days before general on sale and closes on 2099-01-10. Budget: 40% on sale, 20% middle, 40% final push.\nRivals: Sade Rhythm on 2099-03-13\nSound-alikes: "Ada Lux" and "Kola Wave".';

  it('saves a report with the rule checks beside the Qloo verdicts', async () => {
    const events: ThreadEvent[] = [];
    const said = { text: PLAN, files: [] };
    const handoff: Handoff = {
      category: 'shows',
      mode: 'audit',
      title: 'Night Songs Live',
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
        callBudget: 80,
        retryDelayMs: 0,
      }),
      source: 'demo',
      entities: new Map<string, SeenEntity>(),
    });
    const deps: ShowsAuditDeps = {
      reader: new ScriptedShowsReader(),
      queries: new ScriptedQueryPlanner(),
      research: new NoResearch(),
      writer: new TemplatePlanWriter(),
      results: new ScriptedResultsReader(),
      report: new TemplateReportWriter(),
      tools: context(),
      emit: (e: ThreadEvent) => events.push(e),
    };
    const run = await runShowsAudit(handoff, deps);
    expect(run.reason).toBe('finished');
    const report = auditReportSchema.parse(run.output?.report);
    expect(run.output?.plan).toBeNull();
    const checks = Object.fromEntries(report.ruleChecks.map((c) => [c.id, c.status]));
    expect(checks).toEqual({
      'rule-on-sale': 'follows',
      'rule-presale': 'follows',
      'rule-final-push': 'follows',
      'rule-rivals': 'outside',
    });
    // The rule checks are not Qloo verdicts: the items are still tested as they were.
    expect(report.items.length).toBeGreaterThan(0);
  });
});

describe('reading the Guide brief for a live show', () => {
  const text = [
    'Launch plan for the show "Night Laughs", a stand-up night, opening in Lagos and London on 2099-03-12.',
    'Show type: Comedy night.',
    'Venue capacity: 1,200.',
    'Ticket price band: Under $30.',
    'On sale: 6 weeks before the show.',
    'Rivals: Big Night on 2099-03-14',
    'Brands to consider: Guinness and Indomie.',
    'Content rating or tone: R, violent crime.',
  ].join('\n');

  it('fills the fields by form, whichever reader ran', async () => {
    const { reading } = await new ScriptedShowsReader().read({ title: 'Night Laughs', text });
    const got = checkReading(reading, { title: 'Night Laughs', text });
    expect(got).toMatchObject({
      showType: 'comedy',
      capacity: 1200,
      priceBand: 'Under $30',
      onSaleWeeks: 6,
      window: '2099-03-12',
    });
    expect(got.rivalDates).toEqual([{ title: 'Big Night', date: '2099-03-14' }]);
  });
});
