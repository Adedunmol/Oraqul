import { BAND_LABEL } from '@oraqul/packs';
import type { Draft, FundingItem, LaunchPlan, MoneyType } from '@oraqul/schema';

// A pitch or an application pack, written by code from the plan's own checked lines. It carries no
// fee, price or loan terms and no promise, and Oraqul sends none of it: a person opens it in their
// own WhatsApp or email and sends it themselves. The words below are fixed so they can be checked.

const ASK: Record<MoneyType, string> = {
  cash: 'a conversation about backing the launch',
  in_kind:
    'product, hospitality or a venue in return for premiere presence, stills, clip rights and access to the audience',
  placement:
    'placement where your audience already is, in return for credit and access to the audience',
  media: 'ad space or airtime in return for credit and access to the audience',
  bulk_tickets: 'block ticket purchases or a group screening for your people',
};

const first = (plan: LaunchPlan, key: string, n: number, grounded = false) =>
  (plan.sections.find((s) => s.key === key)?.lines ?? [])
    .filter((l) => !grounded || l.kind === 'grounded')
    .slice(0, n)
    .map((l) => l.text);

/** The fixed words that must never appear in a draft. Checked in the spec, and by code before one is returned. */
export const FORBIDDEN =
  /\b(?:fee|fees|price|pricing|loan|loans|interest rate|qualif(?:y|ies|ied)|guarantee[sd]?)\b/i;

export function buildDraft(plan: LaunchPlan, project: string, item: FundingItem): Draft {
  const logline = first(plan, 'positioning', 1)[0] ?? `${project} is a launch we are planning.`;
  const audience = first(plan, 'audience', 3, true);
  const budgetBand = plan.band ? `${BAND_LABEL[plan.band.band]} budget` : null;
  const territories = plan.territories.map((t) => t.name);
  const sponsor = item.kind === 'sponsor';
  const ask = sponsor
    ? `We would like to talk about ${ASK[item.sponsor?.moneyType ?? 'in_kind']}.`
    : `We would like to apply to ${item.name}.`;
  const subject = sponsor
    ? `${project}: working with ${item.name}`
    : `${project}: application to ${item.name}`;
  const why = sponsor
    ? `Why ${item.name}: our audience data ranks it among the brands this audience likes${item.territory ? ` in ${item.territory}` : ''}.`
    : `About the fund: ${item.name}${item.fund?.owner ? `, run by ${item.fund.owner}` : ''}. We read its published terms at ${item.fund?.sourceUrl ?? 'its page'} on ${item.fund?.retrievedAt ?? 'the day we looked'}, and will check them again before we send this.`;
  const text = [
    sponsor ? `Hello ${item.name} team,` : 'Hello,',
    '',
    logline,
    '',
    why,
    ...(audience.length ? ['', 'The audience:', ...audience.map((a) => `- ${a}`)] : []),
    '',
    `Where: ${territories.length ? territories.join(', ') : 'to be agreed'}.`,
    ...(budgetBand ? [`Sized for a ${budgetBand.toLowerCase()}.`] : []),
    '',
    ask,
    '',
    'Thank you for your time.',
  ].join('\n');
  if (FORBIDDEN.test(text.replace(logline, '').replace(audience.join(' '), ''))) {
    throw new Error('A draft held words Oraqul never writes');
  }
  return { subject, text, parts: { logline, audience, budgetBand, territories, ask } };
}
