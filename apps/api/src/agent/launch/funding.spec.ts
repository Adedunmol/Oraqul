import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Output, outputDetailSchema, type ThreadEvent } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import type { FundingResearcher, VerifiedFund } from '../../funding/fund-research.js';
import { compileRules, NO_RULES } from '../../team-rules/compile.js';
import { filmLaunch } from '../film/config.js';
import { runFunding, sponsorCandidates } from './funding.js';

const example = outputDetailSchema.parse(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../test/fixtures/demo-film-output.json', import.meta.url)),
      'utf8',
    ),
  ),
);

// The recorded demo plan names no brand per city, so two Qloo ranked brands are placed in Lagos.
function planWithSponsors(): Output {
  const base = example.output;
  const plan = structuredClone(base.plan);
  if (!plan) throw new Error('example has no plan');
  const place = (id: string, n: number) => {
    const p = plan.partners.find((x) => x.id === id);
    if (p) p.fit = { place: n, of: 10, direction: 'okay', local: null };
  };
  place('partner-night-market-cola', 1);
  place('partner-lagoon-mobile', 2);
  const lagos = plan.territories.find((t) => t.name === 'Lagos');
  if (lagos) lagos.partnerIds = ['partner-night-market-cola', 'partner-lagoon-mobile'];
  return { ...base, plan };
}

const inputs = { read: { places: ['London', 'Houston', 'Atlanta', 'Lagos'], ages: [] } } as never;
const facts = { stage: 'development' as const, nationality: 'Nigerian' };

const fund = (over: Partial<VerifiedFund> = {}): VerifiedFund => ({
  name: 'Lagos Film Development Grant',
  owner: 'Arts Council',
  type: 'grant',
  amount: '£25,000',
  currency: '£',
  deadline: '2027-01-31',
  criteria: [
    { text: 'Feature film projects in development', field: 'stage', value: 'development' },
  ],
  otherConditions: false,
  applicationUrl: null,
  sourceUrl: 'https://funds.example/open',
  sourceTitle: 'Open funds',
  retrievedAt: '2026-10-27',
  ...over,
});

const researcher = (funds: VerifiedFund[], withEvidence = true): FundingResearcher => ({
  enabled: true,
  async funds() {
    return { funds, tokens: 1 };
  },
  async evidence({ brand }) {
    return {
      evidence: withEvidence
        ? {
            url: `https://news.example/${brand.toLowerCase().replace(/\W+/g, '-')}`,
            title: 'News',
            retrievedAt: '2026-10-27',
            quote: `${brand} sponsored the Lagos Film Festival in 2026`,
          }
        : null,
      tokens: 1,
    };
  },
});

const run = (r: FundingResearcher, rules = NO_RULES) => {
  const events: ThreadEvent[] = [];
  const out = runFunding(
    { emit: (e) => events.push(e), config: filmLaunch, researcher: r },
    planWithSponsors(),
    inputs,
    facts,
    rules,
    'Night Ferry',
  );
  return { out, events };
};

describe('runFunding', () => {
  it('finds the brands Qloo ranked for a territory, each citing a finding and a stored page', async () => {
    const result = await run(researcher([fund()])).out;
    const output = result.output;
    expect(output?.kind).toBe('funding');
    const items = output?.funding?.items ?? [];
    expect(items.filter((i) => i.kind === 'sponsor').map((i) => [i.name, i.territory])).toEqual([
      ['Night Market Cola', 'Lagos'],
      ['Lagoon Mobile', 'Lagos'],
    ]);
    const lines = output?.plan?.sections.flatMap((s) => s.lines) ?? [];
    const sponsorLines = lines.filter((l) => l.group === 'Sponsors');
    expect(
      sponsorLines.filter((l) => l.kind === 'grounded').every((l) => l.findingIds.length > 0),
    ).toBe(true);
    expect(
      sponsorLines.filter((l) => l.kind === 'playbook').every((l) => l.sourceIds.length === 1),
    ).toBe(true);
    for (const item of items.filter((i) => i.kind === 'sponsor')) {
      expect(item.data).toMatchObject({
        moneyType: 'in_kind',
        evidence: { retrievedAt: '2026-10-27' },
      });
    }
    expect(output?.plan?.sources.map((s) => s.url)).toContain('https://funds.example/open');
  });

  it('keeps a fund with its source and day read, and an unknown criterion makes it check, never eligible', async () => {
    const result = await run(
      researcher([
        fund(),
        fund({
          name: 'Open Courage Fund',
          sourceUrl: 'https://funds.example/courage',
          criteria: [
            { text: 'A track record of two festival selections', field: 'other', value: null },
          ],
        }),
      ]),
    ).out;
    const funds = (result.output?.funding?.items ?? []).filter((i) => i.kind === 'fund');
    expect(funds.map((f) => f.name)).toEqual(['Lagos Film Development Grant', 'Open Courage Fund']);
    expect(
      funds.map((f) => (f.data as { eligibility: { verdict: string } }).eligibility.verdict),
    ).toEqual(['eligible', 'check']);
    for (const f of funds) {
      expect(f.data).toMatchObject({ retrievedAt: '2026-10-27' });
      expect((f.data as { sourceUrl: string }).sourceUrl).toMatch(/^https:/);
    }
    const text = JSON.stringify(result.output?.plan?.sections);
    expect(text).toContain('It closes 2027-01-31.');
    expect(text).toContain('Confirm the terms on the page before applying.');
    expect(text).not.toMatch(/qualif/i);
  });

  it('never keeps a fund whose line states a fee, loan terms or that the team qualifies', async () => {
    const result = await run(
      researcher([
        fund({ name: 'Sponsorship fee fund', sourceUrl: 'https://funds.example/a' }),
        fund({
          name: 'Slow Money Loan',
          type: 'loan',
          amount: '5% interest',
          sourceUrl: 'https://funds.example/b',
        }),
        fund({ name: 'Kept Grant', sourceUrl: 'https://funds.example/c' }),
      ]),
    ).out;
    const names = (result.output?.funding?.items ?? [])
      .filter((i) => i.kind === 'fund')
      .map((i) => i.name);
    expect(names).toEqual(['Kept Grant']);
    expect(result.output?.plan?.dropped.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps a sponsor but not its sponsorship when the evidence line does not pass', async () => {
    const odd: FundingResearcher = {
      ...researcher([]),
      async evidence({ brand }) {
        return {
          evidence: {
            url: 'https://news.example/x',
            title: 'News',
            retrievedAt: '2026-10-27',
            quote: `${brand} agreed a sponsorship fee for the festival in 2026`,
          },
          tokens: 0,
        };
      },
    };
    const result = await run(odd).out;
    const sponsors = (result.output?.funding?.items ?? []).filter((i) => i.kind === 'sponsor');
    expect(sponsors).toHaveLength(2);
    expect(sponsors.every((s) => (s.data as { evidence: unknown }).evidence === null)).toBe(true);
  });

  it('never offers a sponsor the team has ruled out', () => {
    const plan = planWithSponsors().plan;
    if (!plan) throw new Error('no plan');
    const rules = compileRules([
      {
        id: '00000000-0000-4000-8000-000000000001',
        teamId: '00000000-0000-4000-8000-000000000002',
        scope: 'team',
        projectId: null,
        kind: 'partner_block',
        field: 'partner',
        operator: 'not_in',
        value: { kind: 'partner_block', names: ['Night Market Cola'] },
        enforcement: 'code',
        sourceText: 'x',
        status: 'active',
        rejectionReason: null,
        createdBy: null,
        createdByName: null,
        confirmedBy: null,
        confirmedAt: null,
        version: 1,
        supersedesId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        sentence: '',
        conflicts: [],
      },
    ]);
    expect(sponsorCandidates(plan, rules).map((c) => c.partner.name)).toEqual(['Lagoon Mobile']);
  });

  it('says so, and still lists the Qloo ranked sponsors, when web search is not set up', async () => {
    const none: FundingResearcher = { ...researcher([]), enabled: false };
    const { out, events } = run(none);
    const result = await out;
    const items = result.output?.funding?.items ?? [];
    expect(items.every((i) => i.kind === 'sponsor')).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    expect(JSON.stringify(events)).toContain('Web search is not set up');
  });

  it('saves nothing when nothing can be sourced', async () => {
    const empty = {
      ...researcher([]),
      async evidence() {
        return { evidence: null, tokens: 0 };
      },
    };
    const base = planWithSponsors();
    for (const t of base.plan?.territories ?? []) t.partnerIds = [];
    const events: ThreadEvent[] = [];
    const result = await runFunding(
      { emit: (e) => events.push(e), config: filmLaunch, researcher: empty },
      base,
      inputs,
      facts,
      NO_RULES,
      'Night Ferry',
    );
    expect(result.output).toBeNull();
  });
});
