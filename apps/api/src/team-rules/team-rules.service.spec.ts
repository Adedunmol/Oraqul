import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { projects } from '../db/schema.js';
import { seedProject } from '../test-support/seed.js';
import { ScriptedRuleExtractor } from './extract.js';
import { OWNER_ONLY, TeamRulesService } from './team-rules.service.js';

describe('TeamRulesService', () => {
  let seed: Awaited<ReturnType<typeof seedProject>>;
  let service: TeamRulesService;

  beforeAll(async () => {
    seed = await seedProject();
    service = new TeamRulesService(seed.db, new ScriptedRuleExtractor());
  });
  afterAll(() => seed.database.close());

  const save = (text: string, role: 'owner' | 'editor' = 'owner') =>
    service.extract(seed.teamId, seed.userId, { text, scope: 'team', projectId: null }, role);

  it('makes each readable line a rule at once, and keeps a rejection, with its reason, for the rest', async () => {
    const out = await save(
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
      ['partner_block', 'active'],
      ['topic_block', 'active'],
      ['topic_block', 'rejected'],
      ['topic_block', 'rejected'],
      ['topic_block', 'rejected'],
    ]);
    const rejected = out.rules.filter((r) => r.status === 'rejected');
    expect(rejected.every((r) => (r.rejectionReason ?? '').length > 40)).toBe(true);
    expect(out.unparsed).toEqual(['We love Lagos']);
    const block = out.rules.find((r) => r.kind === 'partner_block');
    expect(block).toMatchObject({
      enforcement: 'code',
      sentence: 'Never propose Guinness as a partner.',
      confirmedBy: seed.userId,
    });
    expect(out.rules.find((r) => r.sourceText.includes('homophobic'))).toMatchObject({
      enforcement: 'prompt',
      status: 'active',
    });
  });

  it('is followed by the next run with no further step, and a rejected rule never is', async () => {
    const run = await service.forRun(seed.teamId, null);
    expect(run.blockedPartners).toEqual(['Guinness']);
    expect(run.guidance).toEqual([
      'Keep plans away from this: We don’t welcome homophobic suggestions',
    ]);
    expect(run.applied).toHaveLength(2);
  });

  it('makes a replacement a new version of a single valued rule, and archives the old one', async () => {
    const first = (await save('Budget ceiling: £50k')).rules[0];
    const second = (await save('Budget ceiling: £30k')).rules[0];
    const budget = (await service.list(seed.teamId)).filter((r) => r.kind === 'budget_max');
    expect(budget.map((r) => [r.version, r.status]).sort()).toEqual([
      [1, 'archived'],
      [2, 'active'],
    ]);
    expect(budget.find((r) => r.version === 2)?.supersedesId).toBe(first?.id);
    const run = await service.forRun(seed.teamId, null);
    expect(run.budgetMax).toEqual({ amount: 30_000, currency: 'GBP' });
    expect(run.applied.some((a) => a.id === second?.id && a.version === 2)).toBe(true);
  });

  it('shows what a rule clashes with: another rule, and a project the team has', async () => {
    await seed.db.update(projects).set({ places: ['Lagos', 'Atlanta'] });
    const first = (await save('Never cover: Atlanta')).rules[0];
    expect((await service.list(seed.teamId)).find((r) => r.id === first?.id)?.conflicts).toEqual([
      'The project “Night Ferry” names Atlanta.',
    ]);
    await save('Markets: Atlanta, Lagos');
    const again = (await service.list(seed.teamId)).find((r) => r.id === first?.id);
    expect(
      again?.conflicts.some((c) =>
        c.includes('Atlanta is blocked here and allowed by another rule'),
      ),
    ).toBe(true);
  });

  it('lets an owner or an editor remove a rule, and it stops applying', async () => {
    const [active] = (await service.list(seed.teamId)).filter(
      (r) => r.kind === 'partner_block' && r.status === 'active',
    );
    await service.archive(seed.teamId, active?.id ?? '', 'editor');
    expect((await service.forRun(seed.teamId, null)).blockedPartners).toEqual([]);
    await expect(service.archive(seed.teamId, active?.id ?? '', 'editor')).rejects.toThrow(
      'Only an active rule',
    );
  });

  it('lets only an owner set or remove who must approve what leaves Oraqul', async () => {
    const byEditor = (await save('Who must approve: owner', 'editor')).rules[0];
    expect(byEditor).toMatchObject({ status: 'rejected', rejectionReason: OWNER_ONLY });
    expect((await service.forRun(seed.teamId, null)).approvalRole).toBeNull();
    const byOwner = (await save('Who must approve: owner', 'owner')).rules[0];
    expect(byOwner?.status).toBe('active');
    await expect(service.archive(seed.teamId, byOwner?.id ?? '', 'editor')).rejects.toThrow(
      OWNER_ONLY,
    );
    await service.archive(seed.teamId, byOwner?.id ?? '', 'owner');
    expect((await service.forRun(seed.teamId, null)).approvalRole).toBeNull();
  });

  it('logs an override against the rule and its version', async () => {
    const applied = [{ id: (await service.list(seed.teamId))[0]?.id ?? '', version: 1 }];
    await service.logOverride(seed.threadId, seed.userId, applied);
    expect(await service.overrides(seed.teamId)).toEqual([
      { ruleId: applied[0]?.id, threadId: seed.threadId, at: expect.any(String) },
    ]);
  });
});
