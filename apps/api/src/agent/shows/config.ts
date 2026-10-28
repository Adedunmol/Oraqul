import { SHOWS_PLAN_RULES, showsPlan } from '@oraqul/packs';
import type {
  CompUsed,
  Finding,
  LaunchLine,
  LaunchSection,
  RuleCheck,
  Signal,
} from '@oraqul/schema';
import { testArtists } from '../launch/audit-verdicts.js';
import type { CheckRules } from '../launch/check.js';
import { rivalsFrom } from '../launch/clash.js';
import type { LaunchConfig } from '../launch/config.js';
import type { DecisionWords } from '../launch/decisions.js';
import { list, releaseDate } from '../launch/text.js';
import { ground } from './findings.js';
import type { ShowsQueryPlan } from './planner.js';
import type { ShowsRead } from './read.js';
import { marketRole, templateSection } from './writer.js';

const {
  SECTION_TITLES,
  KIND_PROFILES,
  DEFAULT_SHOW_TYPE,
  SHOW_TYPE_LABEL,
  SHOWS_QUERIES,
  beatsFor,
  datedBeats,
  isLastMinute,
  onSaleDates,
  onSaleFor,
  pacingFor,
  phasesFor,
  ticketTarget,
} = showsPlan;

export const SHOWS_CHECK_RULES: CheckRules = {
  titles: SECTION_TITLES,
  tasteClaim: showsPlan.TASTE_CLAIM,
  tagOnly: [],
  // Tickets, seats and followers are the team's own numbers, so a line that states one needs a source.
  figureWords: /\b\d[\d,.]*\s?(tickets?|seats?|followers|views|registrations?)\b/i,
};

export const SHOWS_DECISIONS: DecisionWords = {
  titles: SECTION_TITLES,
  opening: (home, others, strongest) =>
    `Open in ${home}${others.length ? `, then bring the show to ${list(others)}, one plan for each city` : ''}.${strongest ? ` Put the most spend and creator work into ${strongest}, where your audience is strongest.` : ''}`,
  openingAsPlanned: (cities) => `Plan ${list(cities)} as you set them.`,
  unranked: (cities) => ` Build ${list(cities)} around the venue, creator and partner moves below.`,
  role: (verdict: Finding['verdict']) => marketRole(verdict),
  unreadCity: 'Build the show here on venues, local creators and the partner moves below.',
  comp: (c) =>
    `Pitch the show to press and promoters in the company of ${c}, an act your audience already knows.`,
};

/** A reading with nothing in it, for an answer about a plan saved before readings. */
const EMPTY_READ: ShowsRead = {
  act: null,
  showType: null,
  genre: null,
  country: null,
  budget: null,
  capacity: null,
  priceBand: null,
  onSaleWeeks: null,
  partners: [],
  supportActs: [],
  rivalDates: [],
  scope: 'full',
  ask: null,
  comps: [],
  places: [],
  window: null,
  ages: [],
  gender: null,
  suggestedComps: [],
};

const codeLine = (id: string, text: string): LaunchLine => ({
  id,
  kind: 'playbook',
  text,
  findingIds: [],
  sourceIds: [],
  names: [],
  group: null,
});

const typeOf = (read: ShowsRead) => read.showType ?? DEFAULT_SHOW_TYPE;
const range = (a: string, b: string) => (a === b ? a : `${a} to ${b}`);
const lower = (text: string) => `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
const money = (read: ShowsRead, n: number) =>
  `${read.budget?.currency ?? ''}${Math.round(n).toLocaleString('en-US')}`;
const DAY = 86_400_000;

/** The on-sale window for this show, and whether the plan is short of it. */
function windowOf(read: ShowsRead, today: string) {
  const onSale = onSaleFor(typeOf(read), read.onSaleWeeks);
  const show = releaseDate(read.window);
  return { onSale, show, lastMinute: isLastMinute(show, today, onSale) };
}

/** On sale and pacing (E1 to E3): worked back from the show date, in code. */
function onsaleSection(read: ShowsRead, today: string, target: Signal['target']): LaunchSection {
  const type = typeOf(read);
  const { onSale, show } = windowOf(read, today);
  const dates = onSaleDates(show, onSale);
  const label = SHOW_TYPE_LABEL[type].toLowerCase();
  const lines: string[] = [];

  if (onSale.source === 'user' && onSale.weeks) {
    const rule = SHOWS_PLAN_RULES.onSale.value[type];
    const against = !rule
      ? 'and the plan has no rule to check it against'
      : onSale.weeks.max >= rule.min && onSale.weeks.max <= rule.max
        ? `and it is inside the ${rule.min} to ${rule.max} weeks a ${label} usually runs`
        : `and it is outside the ${rule.min} to ${rule.max} weeks a ${label} usually runs`;
    lines.push(
      `General on sale opens ${onSale.weeks.max} weeks before the show${dates ? `, on ${dates.general.from}` : ''}. This window is user supplied: you gave it, ${against}.`,
    );
  } else if (onSale.source === 'rule' && onSale.weeks) {
    lines.push(
      `General on sale opens ${onSale.weeks.max} to ${onSale.weeks.min} weeks before a ${label}${dates ? `, between ${range(dates.general.from, dates.general.to)}` : ''}. This is an editable default, not a fact about your show.`,
    );
  } else {
    lines.push(
      `No on-sale window is set for a ${label}: it was not researched, so the window is yours to set. Give the number of weeks general on sale opens before the show, and the plan dates it. This window is user supplied.`,
    );
  }

  const presale = SHOWS_PLAN_RULES.presale.value;
  lines.push(
    `Open a presale ${presale.leadDays.min} to ${presale.leadDays.max} days before general on sale, behind an access code. Keep registration open for ${presale.registrationDays.min} to ${presale.registrationDays.max} days and give the presale an end date: never plan a presale with no end date.`,
    `The first ${presale.criticalHours} hours of general on sale are the most important${dates ? ` (${range(dates.critical.from, dates.critical.to)})` : ''}: post the link, send the email and SMS scripts and read sales every day.`,
    `Venue capacity: ${read.capacity ? read.capacity.toLocaleString('en-US') : 'not available'}. Ticket price band: ${read.priceBand ?? 'not available'}. Qloo holds neither, so the plan never estimates them.`,
  );

  const tickets = ticketTarget(
    read.capacity,
    target ? { value: target.value, unit: target.unit } : null,
  );
  const when: Record<string, string | null> = {
    'first-week': dates ? dates.firstWeekEnds : null,
    'final-week': dates ? dates.finalWeek.from : null,
    show,
  };
  lines.push(
    `Sales are back loaded: most tickets sell in the final week. The shares below are directional defaults from ${SHOWS_PLAN_RULES.pacing.source.label}, not a forecast, and the target is yours.`,
  );
  for (const c of pacingFor(type)) {
    const at = when[c.key];
    const day = at ? ` (${at})` : '';
    lines.push(
      tickets
        ? `${c.label}${day}: about ${c.share} percent of your ${tickets.toLocaleString('en-US')} ticket target sold.`
        : `${c.label}${day}: about ${c.share} percent of your target sold. Give a target and a venue capacity, such as “target 80 percent” and “capacity 500”, and this turns into tickets.`,
    );
  }
  return {
    key: 'onsale',
    title: SECTION_TITLES.onsale,
    lines: lines.map((text, i) => codeLine(`onsale-${i + 1}`, text)),
  };
}

/** The final push by intent (E5), with the budget held back for it (E4). */
function finalpushSection(read: ShowsRead, today: string): LaunchSection {
  const { lastMinute } = windowOf(read, today);
  const phases = phasesFor(typeOf(read), lastMinute);
  const intent = SHOWS_PLAN_RULES.intent.value;
  const reserve = read.budget
    ? ` That is ${money(read, (read.budget.amount * phases.final) / 100)} of ${money(read, read.budget.amount)}.`
    : '';
  const lines = [
    `Hold ${phases.final} percent of the budget back for the final push, the last week before the show.${reserve}`,
    `First, reach the highest intent: ${lower(intent.highest)}`,
    `Second, medium intent: ${lower(intent.medium)}`,
    `Third, the broad audience: ${lower(intent.broad)}`,
    intent.holders,
  ];
  return {
    key: 'finalpush',
    title: SECTION_TITLES.finalpush,
    lines: lines.map((text, i) => codeLine(`finalpush-${i + 1}`, text)),
  };
}

/** The budget by phase (E4): a starting split, with amounts when the team gave a budget. */
function budgetSection(read: ShowsRead): LaunchSection {
  const today = new Date().toISOString().slice(0, 10);
  const { lastMinute } = windowOf(read, today);
  const phases = phasesFor(typeOf(read), lastMinute);
  const budget = read.budget;
  const rows = [
    { line: 'Announce and on sale', share: phases.announce },
    { line: 'Middle maintenance', share: phases.middle },
    { line: 'Final push', share: phases.final },
  ];
  const lean = typeOf(read) === 'comedy' || lastMinute;
  const why =
    typeOf(read) === 'comedy'
      ? 'a comedy night sells late'
      : 'there is less time than the on-sale rule asks for';
  return {
    key: 'budget',
    title: SECTION_TITLES.budget,
    lines: [
      codeLine(
        'budget-1',
        `${budget ? `A starting split of ${money(read, budget.amount)}` : 'A starting split of the marketing budget, as shares'}: adjust it with your promoter or venue. ${lean ? `It uses the lean split of ${phases.announce}, ${phases.middle} and ${phases.final} because ${why}.` : `It uses ${phases.announce}, ${phases.middle} and ${phases.final} by phase.`} The final push is always held back.`,
      ),
      ...rows.map((c, i) =>
        codeLine(
          `budget-${i + 2}`,
          budget
            ? `${c.line}: ${c.share}%, ${money(read, (budget.amount * c.share) / 100)}.`
            : `${c.line}: ${c.share}%.`,
        ),
      ),
    ],
  };
}

function gapsSection(read: ShowsRead, comps: { used: CompUsed[] }): LaunchSection {
  // Only inputs the team could add. What could not be asked goes to the Assumptions tab instead.
  const type = typeOf(read);
  const texts = [
    ...(read.showType
      ? []
      : [
          `Planned as a ${KIND_PROFILES[DEFAULT_SHOW_TYPE].short}. Say if it is a comedy night, a club night, a stage play or a screening, and the on-sale window changes.`,
        ]),
    ...(read.window ? [] : ['Add the show date, and the on-sale plan turns into real dates.']),
    ...(read.capacity ? [] : ['Add the venue capacity, and the pacing turns into tickets.']),
    ...(read.priceBand
      ? []
      : ['Add the ticket price band: Qloo holds none, so the plan shows it as not available.']),
    ...(onSaleFor(type, read.onSaleWeeks).source === 'missing'
      ? [
          `Say how many weeks before the show general on sale opens: a ${SHOW_TYPE_LABEL[type].toLowerCase()} has no researched window.`,
        ]
      : []),
    ...(read.rivalDates.length
      ? []
      : [
          'Add rival shows with their dates, such as “Rivals: Title on 2027-03-12”, and each date is checked against your night and week.',
        ]),
    ...(comps.used.some((c) => c.source === 'added')
      ? [
          'Say what kind of show it is and who is on the bill, and the plan can be built around them.',
        ]
      : []),
    ...(read.ages.length
      ? []
      : ['Say who the show is for (an age range), and the campaign can aim at them.']),
    ...(read.budget ? [] : ['Add a marketing budget, and the split turns into amounts.']),
  ];
  return {
    key: 'gaps',
    title: SECTION_TITLES.gaps,
    lines: texts.map((text, i) => codeLine(`gaps-${i + 1}`, text)),
  };
}

const weeks = (at: number) => (at === 0 ? 'Show week' : `T${at < 0 ? '-' : '+'}${Math.abs(at)}`);

/** The show calendar for the type and window, in code so no beat before today is advised. */
function timelineSection(read: ShowsRead, today: string): LaunchSection {
  const { onSale, show } = windowOf(read, today);
  const beats = datedBeats(beatsFor(typeOf(read), onSale), show, today);
  if (beats.length === 0) {
    return {
      key: 'timeline',
      title: SECTION_TITLES.timeline,
      lines: [
        codeLine(
          'timeline-passed',
          'The show date has passed, so there are no beats left to plan. Send the results and run an audit to see what to change.',
        ),
      ],
    };
  }
  const lines = beats.map((b) => {
    const when = b.until === undefined ? weeks(b.at) : `${weeks(b.at)} to ${weeks(b.until)}`;
    const dates =
      b.from && b.to ? (b.from === b.to ? ` (${b.from})` : ` (${b.from} to ${b.to})`) : '';
    return codeLine(`timeline-${b.key}`, `${when}${dates}: ${b.text}`);
  });
  return { key: 'timeline', title: SECTION_TITLES.timeline, lines };
}

/**
 * The audited plan's own dates and shares set beside the launch rules (E1, E3, E4, E6). Code reads
 * what the plan says; the answer is whether it follows the rule, never whether it will work.
 */
export function ruleChecks(read: ShowsRead, planText: string, today: string): RuleCheck[] {
  const type = typeOf(read);
  const label = SHOW_TYPE_LABEL[type].toLowerCase();
  const checks: RuleCheck[] = [];

  // E1. The on-sale window.
  const window = SHOWS_PLAN_RULES.onSale.value[type];
  const given = read.onSaleWeeks;
  const onSale = ((): Pick<RuleCheck, 'status' | 'why'> => {
    if (given === null) {
      return {
        status: 'not-stated',
        why: 'The plan does not say how many weeks before the show general on sale opens.',
      };
    }
    if (window === null) {
      return {
        status: 'no-rule',
        why: `The plan opens general on sale ${given} weeks before the show. A ${label} was not researched, so there is no rule to check it against.`,
      };
    }
    return given >= window.min && given <= window.max
      ? {
          status: 'follows',
          why: `General on sale opens ${given} weeks before the show, inside the ${window.min} to ${window.max} weeks the rule gives for a ${label}.`,
        }
      : {
          status: 'outside',
          why: `General on sale opens ${given} weeks before the show; the rule gives ${window.min} to ${window.max} weeks for a ${label}. The rule is an editable default.`,
        };
  })();
  checks.push({
    id: 'rule-on-sale',
    ruleId: SHOWS_PLAN_RULES.onSale.id,
    label: 'On-sale window against the rule',
    ...onSale,
  });

  // E3. The presale: 3 to 7 days ahead, behind a code, and never without an end date.
  const days = SHOWS_PLAN_RULES.presale.value.leadDays;
  const presale = planText.match(/[^.\n]*\bpre-?sale\b[^.\n]*/i)?.[0];
  const lead = presale?.match(
    /(\d+)\s*days?\s*(?:before|ahead of|prior to)\s*(?:the\s*)?(?:general|public)/i,
  )?.[1];
  const ends = presale
    ? /\b(closes?|ends?|end date|deadline|until|expires?)\b/i.test(presale)
    : false;
  const presaleCheck = ((): Pick<RuleCheck, 'status' | 'why'> => {
    if (!presale) return { status: 'not-stated', why: 'The plan does not mention a presale.' };
    if (!ends) {
      return {
        status: 'outside',
        why: 'The plan has a presale with no end date. The rule: never plan a presale with no end date.',
      };
    }
    if (lead === undefined) {
      return {
        status: 'not-stated',
        why: `The plan gives the presale an end, but not how many days before general on sale it opens (the rule gives ${days.min} to ${days.max}).`,
      };
    }
    return Number(lead) >= days.min && Number(lead) <= days.max
      ? {
          status: 'follows',
          why: `The presale opens ${lead} days before general on sale and has an end date, as the rule asks (${days.min} to ${days.max} days).`,
        }
      : {
          status: 'outside',
          why: `The presale opens ${lead} days before general on sale; the rule gives ${days.min} to ${days.max} days.`,
        };
  })();
  checks.push({
    id: 'rule-presale',
    ruleId: SHOWS_PLAN_RULES.presale.id,
    label: 'Presale against the rule',
    ...presaleCheck,
  });

  // E4. The final push reserve.
  const need = phasesFor(type, windowOf(read, today).lastMinute).final;
  const share =
    planText.match(
      /(?:final push|final week|last week)[^.\n]{0,60}?(\d{1,3})\s?(?:%|percent)/i,
    )?.[1] ??
    planText.match(
      /(\d{1,3})\s?(?:%|percent)\s+(?:(?:for|on|in|to)\s+)?(?:the\s+)?(?:final push|final week|last week)/i,
    )?.[1] ??
    // "Nothing held for the last week" says there is no reserve, which is a share of zero.
    (/\b(?:nothing|none|no (?:budget|money|reserve))\b[^.\n]{0,40}\b(?:final push|final week|last week)\b/i.test(
      planText,
    )
      ? '0'
      : undefined);
  const reserve = ((): Pick<RuleCheck, 'status' | 'why'> => {
    if (share === undefined) {
      return {
        status: 'not-stated',
        why: `The plan does not say how much budget it holds back for the final push (the default is ${need} percent).`,
      };
    }
    return Number(share) >= need
      ? {
          status: 'follows',
          why: `The plan holds back ${share} percent for the final push, at or above the ${need} percent default.`,
        }
      : {
          status: 'outside',
          why: `The plan holds back ${share} percent for the final push; the default is ${need} percent. The split is editable, but the final push should always have a reserve.`,
        };
  })();
  checks.push({
    id: 'rule-final-push',
    ruleId: SHOWS_PLAN_RULES.phases.id,
    label: 'Final push reserve against the rule',
    ...reserve,
  });

  // E6. Rival dates near the show.
  const show = releaseDate(read.window);
  const rivals = read.rivalDates.length ? read.rivalDates : rivalsFrom(planText);
  const near = show
    ? rivals.filter(
        (r) =>
          Math.abs(Date.parse(`${r.date}T00:00:00Z`) - Date.parse(`${show}T00:00:00Z`)) / DAY <=
          SHOWS_PLAN_RULES.clash.value.sameWeekDays,
      )
    : [];
  const rivalCheck = ((): Pick<RuleCheck, 'status' | 'why'> => {
    if (!show) {
      return {
        status: 'not-stated',
        why: 'The plan gives no show date, so rival dates cannot be compared with it.',
      };
    }
    if (rivals.length === 0) {
      return { status: 'not-stated', why: 'The plan names no rival shows with their dates.' };
    }
    return near.length > 0
      ? {
          status: 'outside',
          why: `${list(near.map((r) => `${r.title} on ${r.date}`))} plays on the same night or in the same week as the show. Run the date check to see how much audience they share.`,
        }
      : {
          status: 'follows',
          why: 'No named rival plays on the same night or in the same week as the show.',
        };
  })();
  checks.push({
    id: 'rule-rivals',
    ruleId: SHOWS_PLAN_RULES.clash.id,
    label: 'Rival dates against the rule',
    ...rivalCheck,
  });
  return checks;
}

export const showsLaunch: LaunchConfig<ShowsRead, ShowsQueryPlan> = {
  category: 'shows',
  catalog: Object.values(SHOWS_QUERIES),
  anchorTypes: ['urn:entity:artist', 'urn:entity:movie', 'urn:entity:person'],
  rivalTypes: ['urn:entity:artist'],
  genreTagPrefix: showsPlan.TAG_SPACES.similar.prefix,
  artistQueries: ['similar'],
  lead: (read) => read.act,
  fixed: (read) => {
    const window = SHOWS_PLAN_RULES.onSale.value[typeOf(read)];
    const given = read.onSaleWeeks;
    return window && given !== null && (given < window.min || given > window.max)
      ? { ...read, onSaleWeeks: null }
      : read;
  },
  words: {
    comps: 'acts',
    entity: 'act',
    rivalExample: '“Rema” on 2026-12-05',
    planExample:
      'For example: “A comedy night in Lagos for 25 to 34 on 2027-03-12, venue capacity 500, with MTN as a partner.”',
    artistPitch: 'a support slot or a co-promotion',
  },
  minimum: {
    id: 'shows.minimum',
    example: 'For example: “A stand-up night in Lagos on 2027-03-12 for 25 to 34.”',
    missing: (read) => (read.places.length ? [] : ['at least one city the show plays']),
  },
  typical: {
    genre: 'comedy',
    country: 'Nigeria',
    label: 'a typical live comedy night',
    described: (read) => read.act !== null || read.showType !== null,
  },
  pickModules: (read) =>
    showsPlan.pickModules({ scope: read.scope, ask: read.ask, hasBudget: read.budget !== null }),
  rules: SHOWS_CHECK_RULES,
  decisions: SHOWS_DECISIONS,
  briefNames: {
    build: (read) => [
      ...read.places,
      ...(read.act ? [read.act] : []),
      ...read.supportActs,
      ...read.partners,
      ...read.rivalDates.map((r) => r.title),
      ...(read.country ? [read.country] : []),
    ],
    answer: (read) => [
      ...read.places,
      ...(read.act ? [read.act] : []),
      ...read.partners,
      ...read.supportActs,
    ],
  },
  codeSections: {
    budget: budgetSection,
    gaps: gapsSection,
    timeline: timelineSection,
    extra: (read, { today, signal }) => [
      onsaleSection(read, today, signal.target),
      finalpushSection(read, today),
    ],
  },
  codeKeys: ['onsale', 'finalpush'],
  clashByProximity: true,
  calendarBeats: (read) => beatsFor(typeOf(read), onSaleFor(typeOf(read), read.onSaleWeeks)),
  ruleChecks,
  measures: (read) => KIND_PROFILES[typeOf(read)].measures,
  templateSection,
  emptyRead: EMPTY_READ,
  ground,
  claims: (read) =>
    read.places.length +
    read.ages.length +
    read.partners.length +
    read.supportActs.length +
    read.comps.length +
    (read.act ? 1 : 0) +
    (read.showType ? 1 : 0) +
    (read.capacity ? 1 : 0) +
    (read.gender ? 1 : 0) +
    (read.window ? 1 : 0),
  beliefs: (read, text, grounded) =>
    testArtists(read.supportActs, ['similar'], grounded, text, 'your act’s audience'),
};
