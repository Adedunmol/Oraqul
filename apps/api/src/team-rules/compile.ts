import {
  type AppliedRule,
  RULE_ENFORCEMENT,
  ruleSentence,
  type TeamRule,
  type TeamRuleKind,
} from '@oraqul/schema';

// The team's confirmed rules, ready for one run. Code applies the hard ones (a budget ceiling,
// territories, partners, channels, who approves); the rest are words the writer and the red team
// are given. Nothing here changes a refusal, a verdict or a number Qloo returned.

export interface ActiveRules {
  applied: AppliedRule[];
  /** The lowest ceiling any rule sets. */
  budgetMax: { amount: number; currency: string } | null;
  blockedPartners: string[];
  blockedChannels: string[];
  blockedTerritories: string[];
  /** Only these places. Several rules narrow it: a place must be in every list. Null when none. */
  allowedTerritories: string[] | null;
  /** The lowest role that may approve something leaving Oraqul. The stricter rule wins. */
  approvalRole: 'owner' | 'editor' | null;
  /** Words for the writer and the red team, one sentence each. */
  guidance: string[];
  /** The rules of each kind, so an override can be logged against the ones it set aside. */
  byKind: Partial<Record<TeamRuleKind, AppliedRule[]>>;
}

export const NO_RULES: ActiveRules = {
  applied: [],
  budgetMax: null,
  blockedPartners: [],
  blockedChannels: [],
  blockedTerritories: [],
  allowedTerritories: null,
  approvalRole: null,
  guidance: [],
  byKind: {},
};

export const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const has = (list: string[], name: string) => list.some((x) => same(x, name));
const dedupe = (names: string[]) =>
  names.filter((n, i) => names.findIndex((x) => same(x, n)) === i);

export function compileRules(rules: TeamRule[]): ActiveRules {
  const active = rules.filter((r) => r.status === 'active');
  // Fresh lists: a copy of NO_RULES would share its arrays and push into them.
  const out: ActiveRules = { ...NO_RULES, byKind: {}, applied: [], guidance: [] };
  const blockedPartners: string[] = [];
  const blockedChannels: string[] = [];
  const blockedTerritories: string[] = [];
  for (const rule of active) {
    const ref = { id: rule.id, version: rule.version };
    out.applied.push(ref);
    out.byKind[rule.kind] = [...(out.byKind[rule.kind] ?? []), ref];
    const v = rule.value;
    switch (v.kind) {
      case 'budget_max':
        if (!out.budgetMax || v.amount < out.budgetMax.amount) {
          out.budgetMax = { amount: v.amount, currency: v.currency };
        }
        break;
      case 'territory_allow':
        out.allowedTerritories = out.allowedTerritories
          ? out.allowedTerritories.filter((t) => has(v.names, t))
          : [...v.names];
        break;
      case 'territory_block':
        blockedTerritories.push(...v.names);
        break;
      case 'partner_block':
        blockedPartners.push(...v.names);
        break;
      case 'channel_block':
        blockedChannels.push(...v.names);
        break;
      case 'approval':
        out.approvalRole = out.approvalRole === 'owner' || v.role === 'owner' ? 'owner' : 'editor';
        break;
      default:
        out.guidance.push(ruleSentence(v));
    }
  }
  out.blockedPartners = dedupe(blockedPartners);
  out.blockedChannels = dedupe(blockedChannels);
  out.blockedTerritories = dedupe(blockedTerritories);
  return out;
}

const SYMBOL: Record<string, string> = { $: 'USD', '£': 'GBP', '€': 'EUR', '₦': 'NGN' };
export const currencyCode = (c: string) => SYMBOL[c] ?? c.toUpperCase();

/** Whether a place is ruled out: blocked, or outside the only places allowed. */
export function territoryBlocked(rules: ActiveRules, place: string): boolean {
  if (has(rules.blockedTerritories, place)) return true;
  return rules.allowedTerritories !== null && !has(rules.allowedTerritories, place);
}

export interface Conflict {
  kind: TeamRuleKind;
  /** Plain words for the question card. */
  message: string;
}

/** Where the brief asks for something a hard rule rules out. One card asks about all of them. */
export function conflictsOf(
  rules: ActiveRules,
  ask: {
    places: string[];
    budget: { amount: number; currency: string } | null;
    brands: string[];
    platforms: string[] | null;
  },
): Conflict[] {
  const out: Conflict[] = [];
  const places = ask.places.filter((p) => territoryBlocked(rules, p));
  if (places.length) {
    out.push({
      kind: 'territory_block',
      message: `the team’s defaults rule out ${places.join(', ')}`,
    });
  }
  if (
    rules.budgetMax &&
    ask.budget &&
    currencyCode(ask.budget.currency) === rules.budgetMax.currency.toUpperCase() &&
    ask.budget.amount > rules.budgetMax.amount
  ) {
    out.push({
      kind: 'budget_max',
      message: `the team’s ceiling is ${rules.budgetMax.currency} ${rules.budgetMax.amount.toLocaleString('en-US')}, below the ${ask.budget.amount.toLocaleString('en-US')} in the brief`,
    });
  }
  const brands = ask.brands.filter((b) => has(rules.blockedPartners, b));
  if (brands.length) {
    out.push({ kind: 'partner_block', message: `the team never proposes ${brands.join(', ')}` });
  }
  const channels = (ask.platforms ?? []).filter((p) => has(rules.blockedChannels, p));
  if (channels.length) {
    out.push({ kind: 'channel_block', message: `the team never plans on ${channels.join(', ')}` });
  }
  return out;
}

/** The platforms with the ones the team never uses taken out. */
export function withoutBlockedChannels(
  platforms: string[] | null,
  rules: ActiveRules,
): string[] | null {
  if (!platforms) return platforms;
  return platforms.filter((p) => !has(rules.blockedChannels, p));
}

const MULTIPLIER: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6 };

/** Whether a line states more money than the ceiling, in the ceiling's currency. */
export function statesMoreThan(text: string, max: { amount: number; currency: string }): boolean {
  const pattern =
    /([$£€₦]|\b[A-Za-z]{3}\b)?\s*(\d[\d,]*(?:\.\d+)?)\s*(million|thousand|k|m)?\b\s*([A-Za-z]{3}\b)?/g;
  for (const m of text.matchAll(pattern)) {
    const lead = m[1] ? currencyCode(m[1]) : undefined;
    const trail = m[4] ? m[4].toUpperCase() : undefined;
    const code = [lead, trail].find((c) => c && c === max.currency.toUpperCase());
    if (!code) continue;
    const amount =
      Number((m[2] ?? '0').replaceAll(',', '')) * (MULTIPLIER[(m[3] ?? '').toLowerCase()] ?? 1);
    if (amount > max.amount) return true;
  }
  return false;
}

/** Whether a line names a partner the team never proposes. */
export function namesBlocked(text: string, names: string[]): string | null {
  const lower = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  return (
    names.find((n) => {
      const bare = n
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
      return bare.length > 0 && lower.includes(` ${bare} `);
    }) ?? null
  );
}

/** The rule words a writer and the red team are given, labelled as the team's own. */
export function guidanceText(rules: ActiveRules): string {
  if (rules.guidance.length === 0) return '';
  return `The team's defaults (follow them; they are not evidence):\n${rules.guidance.map((g) => `- ${g}`).join('\n')}`;
}

export { RULE_ENFORCEMENT };
