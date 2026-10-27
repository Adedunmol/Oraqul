import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fundingItems } from '../db/schema.js';
import { CalendarService } from '../projects/calendar.service.js';
import { ScriptedRuleExtractor } from '../team-rules/extract.js';
import { TeamRulesService } from '../team-rules/team-rules.service.js';
import { calendarRow, planWith, seedProject } from '../test-support/seed.js';
import { pipelineEvents } from '../watch/checks.js';
import { FORBIDDEN } from './draft.js';
import { NoFundingResearch } from './fund-research.js';
import { FundingService } from './funding.service.js';

describe('the funding pipeline', () => {
  let seed: Awaited<ReturnType<typeof seedProject>>;
  let service: FundingService;
  let rules: TeamRulesService;
  let planId = '';
  let sponsorId = '';
  let fundId = '';

  beforeAll(async () => {
    seed = await seedProject();
    rules = new TeamRulesService(seed.db, new ScriptedRuleExtractor());
    service = new FundingService(seed.db, rules, new NoFundingResearch());
    planId = await seed.save({
      plan: planWith([calendarRow('launch', 0, '2099-03-12', 'daily post')], {
        sections: [
          {
            key: 'positioning',
            title: 'Positioning',
            lines: [
              {
                id: 'positioning-1',
                kind: 'playbook',
                text: 'A thriller about a ferry that never docks.',
                findingIds: [],
                sourceIds: [],
                names: [],
                group: null,
              },
            ],
          },
          {
            key: 'audience',
            title: 'Audience',
            lines: [
              {
                id: 'audience-1',
                kind: 'grounded',
                text: 'Fans of Salt Road skew 25 to 34.',
                findingIds: ['f1'],
                sourceIds: [],
                names: [],
                group: null,
              },
            ],
          },
        ],
        band: { band: 'independent', source: 'brief' },
      }),
    });
    const [sponsor, fund] = await seed.db
      .insert(fundingItems)
      .values([
        {
          planId,
          projectId: seed.projectId,
          kind: 'sponsor',
          name: 'Night Market Cola',
          territory: 'Lagos',
          data: {
            moneyType: 'in_kind',
            fit: { place: 1, of: 10 },
            findingIds: ['f1'],
            evidence: null,
          },
        },
        {
          planId,
          projectId: seed.projectId,
          kind: 'fund',
          name: 'Lagos Film Development Grant',
          data: {
            owner: 'Arts Council',
            type: 'grant',
            amount: '£25,000',
            currency: '£',
            deadline: '2099-02-10',
            criteria: [],
            applicationUrl: null,
            sourceUrl: 'https://funds.example/open',
            sourceTitle: 'Open funds',
            retrievedAt: '2026-10-27',
            eligibility: {
              verdict: 'check',
              met: [],
              unknown: ['No published criteria were found on the page.'],
              failed: [],
            },
          },
        },
      ])
      .returning();
    sponsorId = sponsor?.id ?? '';
    fundId = fund?.id ?? '';
  });
  afterAll(() => seed.database.close());

  const who = (role: 'owner' | 'editor') => ({
    teamId: seed.teamId,
    projectId: seed.projectId,
    role,
  });

  it('lists the plan’s items with their source and the day read, ready before a run and set after', async () => {
    const state = await service.state(planId);
    expect(state.status).toBe('set');
    expect(state.items.map((i) => [i.kind, i.status])).toEqual([
      ['fund', 'found'],
      ['sponsor', 'found'],
    ]);
    expect(state.items[0]?.fund).toMatchObject({
      sourceUrl: 'https://funds.example/open',
      retrievedAt: '2026-10-27',
    });
    const none = await seed.save({ kind: 'date', plan: null });
    expect((await service.state(none)).status).toBe('none');
  });

  it('cannot reach approved, sent by you or a reply except through the steps that earn them', async () => {
    await expect(service.update(planId, sponsorId, { status: 'replied' })).rejects.toThrow(
      'confirmed sending',
    );
    await expect(service.update(planId, sponsorId, { status: 'won' })).rejects.toThrow(
      'confirmed sending',
    );
    await expect(service.handoff(planId, sponsorId, who('owner'))).rejects.toThrow(
      'Draft it first',
    );
    await expect(service.confirmSent(planId, sponsorId)).rejects.toThrow('Approve the draft');
    expect(
      (await service.update(planId, sponsorId, { status: 'qualified', note: 'Asked on Tuesday' }))
        .status,
    ).toBe('qualified');
  });

  it('writes a pitch from the plan, with no fee, price or promise in it, and moves to drafted', async () => {
    const { item, draft } = await service.draft(planId, sponsorId);
    expect(item.status).toBe('drafted');
    expect(draft.subject).toBe('Night Ferry: working with Night Market Cola');
    expect(draft.parts).toMatchObject({
      logline: 'A thriller about a ferry that never docks.',
      audience: ['Fans of Salt Road skew 25 to 34.'],
      budgetBand: 'Independent budget',
      territories: ['Lagos'],
    });
    expect(draft.text).toContain('product, hospitality or a venue in return for premiere presence');
    expect(FORBIDDEN.test(draft.text)).toBe(false);
  });

  it('writes an application pack for a fund from its published page, saying it will be checked again', async () => {
    const { draft } = await service.draft(planId, fundId);
    expect(draft.subject).toBe('Night Ferry: application to Lagos Film Development Grant');
    expect(draft.text).toContain(
      'https://funds.example/open on 2026-10-27, and will check them again',
    );
    expect(FORBIDDEN.test(draft.text)).toBe(false);
    expect(draft.parts.ask).toBe('We would like to apply to Lagos Film Development Grant.');
  });

  it('lets an editor approve unless the team says an owner must, and then only an owner may', async () => {
    await rules.save(seed.teamId, seed.userId, 'Who must approve: owner', 'owner');
    await expect(service.handoff(planId, sponsorId, who('editor'))).rejects.toThrow(
      'need an owner',
    );
    const approved = await service.handoff(planId, sponsorId, who('owner'));
    expect(approved.item.status).toBe('approved');
    expect(approved.draft.text).toContain('Hello Night Market Cola team');
  });

  it('reaches sent by you only when the person confirms, and plans a follow up a week on', async () => {
    const sent = await service.confirmSent(planId, sponsorId, new Date('2026-11-01T10:00:00Z'));
    expect(sent).toMatchObject({ status: 'sent_by_you', nextFollowUpOn: '2026-11-08' });
    expect((await service.update(planId, sponsorId, { status: 'replied' })).status).toBe('replied');
    expect((await service.update(planId, sponsorId, { status: 'won' })).status).toBe('won');
    await expect(service.update(planId, sponsorId, { status: 'qualified' })).rejects.toThrow();
  });

  it('puts fund deadlines and follow ups in the calendar feed, and raises them as watch events', async () => {
    await service.update(planId, fundId, { nextFollowUpOn: '2099-02-01' });
    const { ics } = await new CalendarService(seed.db).forOutput(planId);
    expect(ics).toContain('SUMMARY:Fund deadline: Lagos Film Development Grant');
    expect(ics).toContain('DTSTART;VALUE=DATE:20990210');
    expect(ics).toContain('SUMMARY:Follow up: Lagos Film Development Grant');
    expect(ics).not.toContain('Night Market Cola');
    const item = (await service.state(planId)).items.find((i) => i.id === fundId);
    const rows = [
      {
        id: fundId,
        kind: 'fund' as const,
        name: item?.name ?? '',
        status: 'qualified',
        nextFollowUpOn: '2099-02-01',
        deadline: item?.fund?.deadline ?? null,
        source: {
          url: 'https://funds.example/open',
          title: 'Open funds',
          retrievedAt: '2026-10-27',
        },
      },
    ];
    expect(pipelineEvents(rows, '2099-01-25')).toEqual([]);
    const soon = pipelineEvents(rows, '2099-02-01');
    expect(soon.map((e) => [e.type, e.severity])).toEqual([['deadline_soon', 'watch']]);
    expect(soon[0]?.evidence[0]).toMatchObject({
      url: 'https://funds.example/open',
      retrievedAt: '2026-10-27',
    });
    // A follow up is for something that has gone out: a fund still being worked raises only its deadline.
    expect(pipelineEvents(rows, '2099-02-08').map((e) => [e.type, e.severity])).toEqual([
      ['deadline_soon', 'act'],
    ]);
    const sentRow = { ...rows[0]!, status: 'sent_by_you' };
    expect(pipelineEvents([sentRow], '2099-02-08').map((e) => [e.type, e.severity])).toEqual([
      ['follow_up_due', 'watch'],
    ]);
    expect(pipelineEvents([{ ...rows[0]!, status: 'lost' }], '2099-02-08')).toEqual([]);
  });
});
