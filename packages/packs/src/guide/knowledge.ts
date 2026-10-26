import { categories } from '@oraqul/schema';
import { books } from '../books/index';
import { film } from '../film/index';
import { games } from '../games/index';
import { music } from '../music/index';
import { podcasts } from '../podcasts/index';
import { CALENDAR_RULES, PARTNER_RULES, rules, SHOWS_PLAN_RULES, TIER_LABEL } from '../rules/index';
import { shows } from '../shows/index';
import { GUIDE_PAGES, type GuidePage, type GuideSection } from './pages';

const packs = { film, music, books, podcasts, games, shows };

function sectionText(s: GuideSection): string {
  const lines: string[] = [];
  if (s.heading) lines.push(`### ${s.heading}`);
  for (const t of s.text ?? []) lines.push(t);
  for (const i of s.items ?? [])
    lines.push(`- ${[i.label, i.text, i.note].filter(Boolean).join(' ')}`);
  for (const c of s.compare ?? [])
    lines.push(`- ${c.label}: too loose "${c.weak}", plans well "${c.strong}"`);
  return lines.join('\n');
}

function pageText(p: GuidePage): string {
  return [`## ${p.title} [page: ${p.slug}]`, ...p.sections.map(sectionText)].join('\n');
}

function categoriesText(): string {
  const lines = ['## By category [page: categories]'];
  for (const c of categories) {
    const lib = rules[c];
    lines.push(
      `- ${packs[c].title}: ${packs[c].blurb} Judged on ${lib.signal.value.primary.toLowerCase()}. Leads on ${lib.channels.value.join(', ')}.`,
    );
  }
  return lines.join('\n');
}

function launchRulesText(): string {
  const lines = ['## The launch rules [page: launch-rules]'];
  lines.push(
    'Each category plans by a versioned set of rules. Every rule carries its source and the date it was set, and each plan records the version it used.',
  );
  for (const c of categories) {
    const lib = rules[c];
    const b = lib.signal.value.benchmark;
    lines.push(`### ${packs[c].title}`);
    for (const t of lib.timeline) lines.push(`- ${t.value}`);
    lines.push(
      `- Judged on ${lib.signal.value.primary.toLowerCase()}. ${b ? `A target of ${b.value.toLocaleString('en-US')} ${b.unit}, with ${b.floor?.toLocaleString('en-US')} as the floor.` : 'Set your own target.'}`,
    );
  }
  lines.push(
    '### Live shows',
    `- A single show or a short run is planned from the show date back. These are editable defaults, not facts.`,
    '- General on sale opens about 4 to 6 weeks out for a comedy night, 6 to 10 for an independent concert and 2 to 4 for a club night. Theatre and screenings were not researched, so you give the window.',
    `- Sales are back loaded: about ${SHOWS_PLAN_RULES.pacing.value.comedyFirstWeek} percent of a comedy night sells in the first week and about ${SHOWS_PLAN_RULES.pacing.value.comedyLastWeek} percent in the last. The target is always yours.`,
    '- A presale opens 3 to 7 days before general on sale behind an access code and always has an end date.',
    '- Budget is 40, 20 and 40 percent across announce, middle and final push; 50, 10 and 40 for comedy and last-minute shows.',
    '### Content calendar',
    '- Every full plan has a content calendar, worked back from the date on each territory’s lead channel.',
    ...CALENDAR_RULES.ads.value.lines.map((l) => `- ${l}`),
    '### Partner tiers',
    ...(['A', 'B', 'C'] as const).map(
      (t) => `- Tier ${t}, ${TIER_LABEL[t].name}: ${TIER_LABEL[t].what}`,
    ),
    `- ${PARTNER_RULES.leadTime.value.why}`,
    `- ${PARTNER_RULES.leadTime.value.independent}`,
    `- ${PARTNER_RULES.leadTime.value.barter}`,
  );
  return lines.join('\n');
}

/**
 * Everything the Guide says, as one text the help bot answers from. Each page starts with a
 * `[page: slug]` tag so an answer can name where it came from.
 */
export function guideKnowledge(): string {
  const page = (slug: string) => {
    const found = GUIDE_PAGES.find((p) => p.slug === slug);
    return found ? pageText(found) : '';
  };
  return [
    page('getting-started'),
    page('write-a-brief'),
    page('read-a-plan'),
    categoriesText(),
    page('after-the-plan'),
    launchRulesText(),
    page('limits'),
  ].join('\n\n');
}
