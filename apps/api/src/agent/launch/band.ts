import { BAND_LABEL, BAND_OPTIONS, type BudgetBand, bandOf, budgetBands } from '@oraqul/packs';
import type { PlanBand, Question } from '@oraqul/schema';
import { normalise } from '../router/decide.js';
import type { Budget, LaunchRead } from './read-core.js';

/** The id of the one extra question a full build may ask, before any research. */
export const bandQuestionId = (category: string) => `${category}.band`;

const SKIP = 'skip';

const CURRENCY: Record<string, string> = { $: 'USD', '£': 'GBP', '€': 'EUR', '₦': 'NGN' };

/** A budget as written becomes a band; a symbol stands for its main currency. */
export function bandOfBudget(budget: Budget): BudgetBand {
  const code = CURRENCY[budget.currency] ?? (budget.currency || 'USD');
  return bandOf(budget.amount, code);
}

// A band named in words: "an independent budget", "micro release".
const BAND_WORDS =
  /\b(micro|independent|indie|mid[- ]?size[d]?|major)\s+(?:budget|release|launch)\b/i;

function bandNamed(text: string): BudgetBand | null {
  const word = text.match(BAND_WORDS)?.[1]?.toLowerCase();
  if (!word) return null;
  if (word === 'micro') return 'micro';
  if (word === 'major') return 'major';
  if (word.startsWith('mid')) return 'mid';
  return 'independent';
}

/** The band the brief itself states: a budget amount, or a band in words. Null when it says none. */
export function bandFromBrief(read: Pick<LaunchRead, 'budget'>, text: string): PlanBand | null {
  if (read.budget) return { band: bandOfBudget(read.budget), source: 'brief' };
  const named = bandNamed(text);
  return named ? { band: named, source: 'brief' } : null;
}

/** Asked once, after the minimum question, when a full plan has no budget to size its moves by. */
export function bandQuestion(category: string): Question {
  return {
    id: bandQuestionId(category),
    card: 'single',
    prompt: 'What is the budget band? I will only propose what it can carry.',
    options: [
      ...budgetBands.map((band) => ({ id: band, label: BAND_OPTIONS[band] })),
      { id: SKIP, label: 'Skip, assume independent' },
    ],
    hint: 'Or type a figure, such as $40k.',
  };
}

/** The band a card answer or a typed figure gives. Skipping, or a figure with no number, assumes independent. */
export function bandFromAnswer(
  optionIds: readonly string[] | null,
  typed: string | null,
): PlanBand {
  const picked = optionIds?.find((id): id is BudgetBand =>
    (budgetBands as readonly string[]).includes(id),
  );
  if (picked) return { band: picked, source: 'asked' };
  if (typed) {
    const named = bandNamed(`${typed} budget`) ?? bandNamed(typed);
    if (named) return { band: named, source: 'asked' };
    const word = (budgetBands as readonly string[]).find((b) => normalise(typed).includes(b));
    if (word) return { band: word as BudgetBand, source: 'asked' };
    const amount = typed.match(
      /([$£€₦]|usd|gbp|eur|ngn)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|million|thousand)?/i,
    );
    if (amount?.[2]) {
      const mult =
        { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6 }[amount[3]?.toLowerCase() ?? ''] ?? 1;
      const currency = amount[1] ? (CURRENCY[amount[1]] ?? amount[1].toUpperCase()) : 'USD';
      return {
        band: bandOf(Number(amount[2].replaceAll(',', '')) * mult, currency),
        source: 'asked',
      };
    }
  }
  return { band: 'independent', source: 'assumed' };
}

/** Said in the plan, under the bottom line, so a reader knows what the moves were sized for. */
export function bandNote(band: PlanBand): string {
  const label = BAND_LABEL[band.band].toLowerCase();
  return band.source === 'brief'
    ? `Sized for a ${label} budget.`
    : band.source === 'asked'
      ? `Sized for a ${label} budget, as you said.`
      : `Sized for a ${label} budget, which I assumed. Say a different band and I will replan.`;
}
