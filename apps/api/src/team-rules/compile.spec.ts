import type { TeamRule, TeamRuleValue } from '@oraqul/schema';
import { RULE_ENFORCEMENT, RULE_FIELD } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import {
  compileRules,
  conflictsOf,
  guidanceText,
  NO_RULES,
  namesBlocked,
  statesMoreThan,
  territoryBlocked,
  withoutBlockedChannels,
} from './compile.js';

let n = 0;
const rule = (value: TeamRuleValue, over: Partial<TeamRule> = {}): TeamRule => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  teamId: '00000000-0000-4000-8000-000000000999',
  scope: 'team',
  projectId: null,
  kind: value.kind,
  ...RULE_FIELD[value.kind],
  value,
  enforcement: RULE_ENFORCEMENT[value.kind],
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
  ...over,
});

describe('compileRules', () => {
  it('ignores a rule that is not active', () => {
    const out = compileRules([
      rule({ kind: 'partner_block', names: ['MTN'] }, { status: 'proposed' }),
      rule({ kind: 'partner_block', names: ['Guinness'] }, { status: 'rejected' }),
    ]);
    expect(out).toEqual(NO_RULES);
  });

  it('takes the lowest ceiling, the strictest approver, and narrows allowed places', () => {
    const out = compileRules([
      rule({ kind: 'budget_max', amount: 50_000, currency: 'GBP' }),
      rule({ kind: 'budget_max', amount: 30_000, currency: 'GBP' }),
      rule({ kind: 'approval', role: 'editor' }),
      rule({ kind: 'approval', role: 'owner' }),
      rule({ kind: 'territory_allow', names: ['Lagos', 'London'] }),
      rule({ kind: 'territory_allow', names: ['london', 'Accra'] }),
    ]);
    expect(out.budgetMax).toEqual({ amount: 30_000, currency: 'GBP' });
    expect(out.approvalRole).toBe('owner');
    expect(out.allowedTerritories).toEqual(['London']);
    expect(out.applied).toHaveLength(6);
  });

  it('puts the prompt rules in the guidance, labelled as the team’s and not evidence', () => {
    const out = compileRules([
      rule({ kind: 'tone', text: 'warm and plain' }),
      rule({ kind: 'topic_block', text: 'politics' }),
      rule({ kind: 'partner_block', names: ['MTN'] }),
    ]);
    expect(out.guidance).toEqual([
      'Write in this tone: warm and plain',
      'Keep plans away from this: politics',
    ]);
    expect(guidanceText(out)).toContain('they are not evidence');
    expect(guidanceText(NO_RULES)).toBe('');
  });
});

describe('what a rule rules out', () => {
  const rules = compileRules([
    rule({ kind: 'territory_block', names: ['Atlanta'] }),
    rule({ kind: 'partner_block', names: ['Guinness'] }),
    rule({ kind: 'channel_block', names: ['Facebook'] }),
    rule({ kind: 'budget_max', amount: 50_000, currency: 'GBP' }),
  ]);

  it('blocks a place, and anything outside the only places allowed', () => {
    expect(territoryBlocked(rules, 'atlanta')).toBe(true);
    expect(territoryBlocked(rules, 'Lagos')).toBe(false);
    const only = compileRules([rule({ kind: 'territory_allow', names: ['Lagos'] })]);
    expect(territoryBlocked(only, 'London')).toBe(true);
    expect(territoryBlocked(only, 'LAGOS')).toBe(false);
  });

  it('lists each place the brief asks for that a rule rules out', () => {
    const out = conflictsOf(rules, {
      places: ['Lagos', 'Atlanta'],
      budget: { amount: 80_000, currency: '£' },
      brands: ['Guinness', 'Bolt'],
      platforms: ['Facebook', 'TikTok'],
    });
    expect(out.map((c) => c.kind)).toEqual([
      'territory_block',
      'budget_max',
      'partner_block',
      'channel_block',
    ]);
    expect(out[1]?.message).toContain('below the 80,000');
    expect(
      conflictsOf(rules, {
        places: ['Lagos'],
        budget: { amount: 40_000, currency: 'GBP' },
        brands: [],
        platforms: null,
      }),
    ).toEqual([]);
    // A budget in another currency is not compared: there is no rate to compare with.
    expect(
      conflictsOf(rules, {
        places: [],
        budget: { amount: 9e6, currency: 'NGN' },
        brands: [],
        platforms: null,
      }),
    ).toEqual([]);
  });

  it('takes a blocked channel out of the platforms', () => {
    expect(withoutBlockedChannels(['Facebook', 'TikTok'], rules)).toEqual(['TikTok']);
    expect(withoutBlockedChannels(null, rules)).toBeNull();
  });

  it('finds a line that states more than the ceiling in its currency', () => {
    const max = { amount: 50_000, currency: 'GBP' };
    expect(statesMoreThan('Spend £60k on creators.', max)).toBe(true);
    expect(statesMoreThan('Spend £50,000 on creators.', max)).toBe(false);
    expect(statesMoreThan('Hold back GBP 1.2 million for the push.', max)).toBe(true);
    expect(statesMoreThan('Spend $900,000 on ads.', max)).toBe(false);
    expect(statesMoreThan('Post 60 times in week 3.', max)).toBe(false);
  });

  it('finds a banned partner by whole name', () => {
    expect(namesBlocked('Approach Guinness Nigeria for a premiere.', ['Guinness'])).toBe(
      'Guinness',
    );
    expect(namesBlocked('Approach the Guinnesses.', ['Guinness'])).toBeNull();
    expect(namesBlocked('Nothing here.', [])).toBeNull();
  });
});
