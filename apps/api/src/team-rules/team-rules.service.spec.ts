import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { projects } from '../db/schema.js';
import { seedProject } from '../test-support/seed.js';
import { ScriptedRuleExtractor } from './extract.js';
import { TeamRulesService } from './team-rules.service.js';

describe('TeamRulesService', () => {
  let seed: Awaited<ReturnType<typeof seedProject>>;
  let service: TeamRulesService;

  beforeAll(async () => {
    seed = await seedProject();
    service = new TeamRulesService(seed.db, new ScriptedRuleExtractor());
  });
  afterAll(() => seed.database.close());

  const extract = (text: string) =>
    service.extract(seed.teamId, seed.userId, { text, scope: 'team', projectId: null });

  it('saves a proposal for each readable line and a rejection, with its reason, for the rest', async () => {
    const out = await extract(
      [
        'Banned partners: Guinness',
        'We don’t welcome homophobic suggestions',
        'Never say unknown',
        'Only market to men',
        'Send it to partners automatically',
        'We love Lagos',
      ].join('\n'),
    );
    expect(out.rules.map((r) => [r.kind, r.status]).sort()).toEqual([
      ['partner_block', 'proposed'],
      ['topic_block', 'proposed'],
      ['topic_block', 'rejected'],
      ['topic_block', 'rejected'],
      ['topic_block', 'rejected'],
    ]);
    const rejected = out.rules.filter((r) => r.status === 'rejected');
    expect(rejected.map((r) => r.rejectionReason).every((r) => (r ?? '').length > 40)).toBe(true);
    expect(out.unparsed).toEqual(['We love Lagos']);
    const block = out.rules.find((r) => r.kind === 'partner_block');
    expect(block).toMatchObject({
      enforcement: 'code',
      sentence: 'Never propose Guinness as a partner.',
    });
    expect(out.rules.find((r) => r.sourceText.includes('homophobic'))).toMatchObject({
      enforcement: 'prompt',
      status: 'proposed',
    });
  });

  it('is not active until an owner confirms it, then a run follows it', async () => {
    expect((await service.forRun(seed.teamId, null)).blockedPartners).toEqual([]);
    const [block] = (await service.list(seed.teamId)).filter((r) => r.kind === 'partner_block');
    await service.confirm(seed.teamId, block?.id ?? '', seed.userId);
    const rules = await service.forRun(seed.teamId, null);
    expect(rules.blockedPartners).toEqual(['Guinness']);
    expect(rules.applied).toHaveLength(1);
    await expect(service.confirm(seed.teamId, block?.id ?? '', seed.userId)).rejects.toThrow(
      'not waiting',
    );
  });

  it('makes a replacement a new version of a single valued rule, and archives the old one', async () => {
    const first = (await extract('Budget ceiling: £50k')).rules[0];
    await service.confirm(seed.teamId, first?.id ?? '', seed.userId);
    const second = (await extract('Budget ceiling: £30k')).rules[0];
    const rules = await service.confirm(seed.teamId, second?.id ?? '', seed.userId);
    const budget = rules.filter((r) => r.kind === 'budget_max');
    expect(budget.map((r) => [r.version, r.status]).sort()).toEqual([
      [1, 'archived'],
      [2, 'active'],
    ]);
    expect(budget.find((r) => r.version === 2)?.supersedesId).toBe(first?.id);
    const run = await service.forRun(seed.teamId, null);
    expect(run.budgetMax).toEqual({ amount: 30_000, currency: 'GBP' });
    expect(run.applied.some((a) => a.id === second?.id && a.version === 2)).toBe(true);
  });

  it('shows what a proposed rule clashes with: another rule, and a project the team has', async () => {
    await seed.db.update(projects).set({ places: ['Lagos', 'Atlanta'] });
    const proposal = (await extract('Never cover: Atlanta')).rules[0];
    const listed = (await service.list(seed.teamId)).find((r) => r.id === proposal?.id);
    expect(listed?.conflicts).toEqual(['The project “Night Ferry” names Atlanta.']);
    const other = (await extract('Markets: Atlanta, Lagos')).rules[0];
    await service.confirm(seed.teamId, other?.id ?? '', seed.userId);
    const again = (await service.list(seed.teamId)).find((r) => r.id === proposal?.id);
    expect(
      again?.conflicts.some((c) =>
        c.includes('Atlanta is blocked here and allowed by another rule'),
      ),
    ).toBe(true);
  });

  it('lets an owner reject or archive, and keeps a rejected rule out of runs', async () => {
    const p = (await extract('Banned partners: MTN')).rules[0];
    await service.reject(seed.teamId, p?.id ?? '', 'Not for this launch');
    expect((await service.forRun(seed.teamId, null)).blockedPartners).toEqual(['Guinness']);
    const [active] = (await service.list(seed.teamId)).filter(
      (r) => r.kind === 'partner_block' && r.status === 'active',
    );
    await service.archive(seed.teamId, active?.id ?? '');
    expect((await service.forRun(seed.teamId, null)).blockedPartners).toEqual([]);
  });

  it('logs an override against the rule and its version', async () => {
    const applied = [{ id: (await service.list(seed.teamId))[0]?.id ?? '', version: 1 }];
    await service.logOverride(seed.threadId, seed.userId, applied);
    expect(await service.overrides(seed.teamId)).toEqual([
      { ruleId: applied[0]?.id, threadId: seed.threadId, at: expect.any(String) },
    ]);
  });
});
