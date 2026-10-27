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
    service.save(seed.teamId, seed.userId, text, role);

  it('saves the words as written and makes each rule they hold live, in plain sentences', async () => {
    const out = await save(
      [
        'Banned partners: Guinness',
        'We don’t welcome homophobic suggestions',
        'Tone: warm, plain',
      ].join('\n'),
    );
    expect(out.text).toBe(
      'Banned partners: Guinness\nWe don’t welcome homophobic suggestions\nTone: warm, plain',
    );
    expect(out.rules.map((r) => r.sentence).sort()).toEqual([
      'Keep plans away from this: We don’t welcome homophobic suggestions',
      'Never propose Guinness as a partner.',
      'Write in this tone: warm, plain',
    ]);
    expect(out.notAccepted).toEqual([]);
    expect((await service.current(seed.teamId)).text).toBe(out.text);
  });

  it('is followed by the next run with no further step', async () => {
    const run = await service.forRun(seed.teamId, null);
    expect(run.blockedPartners).toEqual(['Guinness']);
    expect(run.guidance).toHaveLength(2);
    expect(run.applied).toHaveLength(3);
  });

  it('keeps a rule the text still says as it is, with the same version and id', async () => {
    const before = (await service.current(seed.teamId)).rules.find(
      (r) => r.kind === 'partner_block',
    );
    await save(
      'Banned partners: Guinness\nTone: warm, plain\nWe don’t welcome homophobic suggestions\nBudget ceiling: £50k',
    );
    const after = (await service.current(seed.teamId)).rules.find(
      (r) => r.kind === 'partner_block',
    );
    expect(after?.id).toBe(before?.id);
    expect(after?.version).toBe(1);
  });

  it('removes a rule when its words are taken out, and replaces a ceiling as a new version', async () => {
    const out = await save('Tone: warm, plain\nBudget ceiling: £30k');
    expect(out.rules.map((r) => r.kind).sort()).toEqual(['budget_max', 'tone']);
    const run = await service.forRun(seed.teamId, null);
    expect(run.blockedPartners).toEqual([]);
    expect(run.budgetMax).toEqual({ amount: 30_000, currency: 'GBP' });
    expect(out.rules.find((r) => r.kind === 'budget_max')?.version).toBe(2);
  });

  it('turns every default off when the box is saved empty', async () => {
    const out = await save('   ');
    expect(out.rules).toEqual([]);
    expect(out.text).toBe('');
    expect((await service.forRun(seed.teamId, null)).applied).toEqual([]);
  });

  it('leaves out, with a plain reason, a line that is not allowed or cannot be read, and keeps the rest', async () => {
    const out = await save(
      [
        'Banned partners: MTN',
        'Never say unknown',
        'Only market to men',
        'Send it automatically',
        'We love Lagos',
      ].join('\n'),
    );
    expect(out.rules.map((r) => r.kind)).toEqual(['partner_block']);
    expect(out.notAccepted.map((n) => n.text).sort()).toEqual([
      'Never say unknown',
      'Only market to men',
      'Send it automatically',
    ]);
    expect(out.notAccepted.every((n) => n.reason.length > 40)).toBe(true);
    expect(out.unparsed).toEqual(['We love Lagos']);
    expect(out.text).toContain('We love Lagos');
  });

  it('shows what a rule clashes with: another rule, and a project the team has', async () => {
    await seed.db.update(projects).set({ places: ['Lagos', 'Atlanta'] });
    const out = await save('Never cover: Atlanta');
    expect(out.rules[0]?.conflicts).toEqual(['The project “Night Ferry” names Atlanta.']);
    const both = await save('Never cover: Atlanta\nMarkets: Atlanta, Lagos');
    expect(
      both.rules
        .find((r) => r.kind === 'territory_block')
        ?.conflicts.some((c) => c.includes('Atlanta is blocked here and allowed by another rule')),
    ).toBe(true);
  });

  it('lets only an owner set or remove who must approve what leaves Oraqul', async () => {
    const byEditor = await save('Who must approve: owner', 'editor');
    expect(byEditor.rules.find((r) => r.kind === 'approval')).toBeUndefined();
    expect(byEditor.notAccepted).toEqual([{ text: 'Who must approve: owner', reason: OWNER_ONLY }]);
    const byOwner = await save('Who must approve: owner', 'owner');
    expect(byOwner.rules.find((r) => r.kind === 'approval')?.value).toEqual({
      kind: 'approval',
      role: 'owner',
    });
    // An editor saving words without the line cannot take the approver away.
    const editorAgain = await save('Banned partners: MTN', 'editor');
    expect(editorAgain.rules.some((r) => r.kind === 'approval')).toBe(true);
    // An owner can.
    const ownerClears = await save('Banned partners: MTN', 'owner');
    expect(ownerClears.rules.some((r) => r.kind === 'approval')).toBe(false);
  });

  it('logs an override against the rule and its version', async () => {
    await save('Banned partners: MTN');
    const applied = [{ id: (await service.current(seed.teamId)).rules[0]?.id ?? '', version: 1 }];
    await service.logOverride(seed.threadId, seed.userId, applied);
    expect(await service.overrides(seed.teamId)).toEqual([
      { ruleId: applied[0]?.id, threadId: seed.threadId, at: expect.any(String) },
    ]);
  });
});
