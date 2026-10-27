import type { Finding, Question } from '@oraqul/schema';
import {
  type ActiveRules,
  type Conflict,
  currencyCode,
  NO_RULES,
  same,
  territoryBlocked,
} from '../../team-rules/compile.js';
import type { LaunchRead } from './read-core.js';

// Where the team's hard defaults meet a brief (spec §5.21). A brief that asks for what a rule rules
// out gets one question; whatever the answer, code applies the rules that stand.

/** The id of the card that asks about a clash with the team's defaults. */
export const rulesQuestionId = (category: string) => `${category}.rules`;

export function rulesQuestion(category: string, conflicts: Conflict[]): Question {
  return {
    id: rulesQuestionId(category),
    card: 'single',
    prompt: `This brief asks for something your team’s defaults rule out: ${conflicts.map((c) => c.message).join('; ')}. Keep the team’s limit, or go ahead against it for this run?`,
    options: [
      { id: 'keep', label: 'Keep the team’s limit' },
      { id: 'override', label: 'Go ahead for this run' },
    ],
    hint: 'Going ahead is logged against the rule.',
  };
}

/** The rules without the ones a person chose to go ahead against, for this run only. */
export function effectiveRules(rules: ActiveRules, conflicts: Conflict[]): ActiveRules {
  const kinds = new Set(conflicts.map((c) => c.kind));
  return {
    ...rules,
    budgetMax: kinds.has('budget_max') ? null : rules.budgetMax,
    blockedPartners: kinds.has('partner_block') ? [] : rules.blockedPartners,
    blockedChannels: kinds.has('channel_block') ? [] : rules.blockedChannels,
    blockedTerritories: kinds.has('territory_block') ? [] : rules.blockedTerritories,
    allowedTerritories: kinds.has('territory_block') ? null : rules.allowedTerritories,
  };
}

/** The findings and the brands to consider with every partner the team never proposes taken out. */
export function withoutBlockedPartners<
  A extends { grounded: { findings: Finding[] }; brands: string[] },
>(asked: A, rules: ActiveRules): A {
  if (rules.blockedPartners.length === 0) return asked;
  const blocked = (name: string) => rules.blockedPartners.some((b) => same(b, name));
  return {
    ...asked,
    grounded: {
      ...asked.grounded,
      findings: asked.grounded.findings.map((f) => ({
        ...f,
        entities: f.entities.filter((e) => !blocked(e.name)),
      })),
    },
    brands: asked.brands.filter((b) => !blocked(b)),
  };
}

/** What the brief asked for with the rules applied: places ruled out dropped, the budget at the ceiling. */
export function enforceRead<R extends LaunchRead>(
  read: R,
  rules: ActiveRules,
): { read: R; dropped: string[]; clamped: boolean } {
  if (rules === NO_RULES || rules.applied.length === 0)
    return { read, dropped: [], clamped: false };
  const places = read.places.filter((p) => !territoryBlocked(rules, p));
  const dropped = read.places.filter((p) => !places.some((x) => same(x, p)));
  const partners = read.partners.filter((p) => !rules.blockedPartners.some((b) => same(b, p)));
  let budget = read.budget;
  let clamped = false;
  if (
    rules.budgetMax &&
    budget &&
    currencyCode(budget.currency) === rules.budgetMax.currency.toUpperCase() &&
    budget.amount > rules.budgetMax.amount
  ) {
    budget = { ...budget, amount: rules.budgetMax.amount };
    clamped = true;
  }
  return { read: { ...read, places, partners, budget }, dropped, clamped };
}
