import type { LaunchModuleKey } from '@oraqul/schema';
import { type Beat, SECTION_TITLES as SHARED_TITLES } from '../launch';
import { type OnSaleWindow, SHOWS_PLAN_RULES, type ShowType, showTypes } from '../rules/shows';

export { type DatedBeat, datedBeats, TASTE_CLAIM } from '../launch';
export { type OnSaleWindow, type ShowType, showTypes };

/** Section titles for a Live shows plan: the shared ones, reworded where a show says it differently. */
export const SECTION_TITLES = {
  ...SHARED_TITLES,
  markets: 'Cities',
  publicity: 'Press and promoters',
  timeline: 'Show calendar',
  venues: 'Where the audience goes out',
  partnerships: 'Sponsors and partners',
} as const;

export const SHOW_TYPE_LABEL: Record<ShowType, string> = {
  concert: 'Concert',
  comedy: 'Comedy night',
  club: 'Club night',
  theatre: 'Stage play',
  screening: 'Screening or premiere',
};

// The words in a brief that name each kind of show. The first match in this order wins.
const TYPE_WORDS: [ShowType, RegExp][] = [
  ['comedy', /\b(comedy|stand-?up|comedian|open mic|improv)\b/i],
  ['theatre', /\b(stage play|theatre|theater|musical)\b/i],
  ['screening', /\b(screening|premiere|film night|one[- ]night (?:film|cinema))\b/i],
  ['club', /\b(club night|dj set|rave|afterparty|after-party|party night)\b/i],
  ['concert', /\b(concert|gig|live show|live set|headline show)\b/i],
];

/** The kind of show a brief describes and the words that say it, or null when it says nothing. */
export function showTypeMatch(text: string): { type: ShowType; word: string } | null {
  for (const [type, words] of TYPE_WORDS) {
    const word = text.match(words)?.[0];
    if (word) return { type, word };
  }
  return null;
}

/** The kind of show a brief describes, or null when it says nothing. */
export function showTypeFrom(text: string): ShowType | null {
  return showTypeMatch(text)?.type ?? null;
}

/** A show with nothing said: a concert, the common case. The plan says it assumed it. */
export const DEFAULT_SHOW_TYPE: ShowType = 'concert';

const ISO_MS = 86_400_000;
const addDays = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * ISO_MS).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / ISO_MS);

export interface OnSale {
  /** `rule` from E1, `user` when the team gave the weeks, `missing` when nobody did. */
  source: 'rule' | 'user' | 'missing';
  /** Weeks general on sale runs before the show. Null when `missing`. */
  weeks: OnSaleWindow | null;
}

/**
 * The on-sale window for a show: the team's own number when it gave one, else the E1 rule for the
 * type. Theatre and screenings have no researched window, so without the team's it is missing.
 */
export function onSaleFor(type: ShowType, userWeeks: number | null): OnSale {
  if (userWeeks !== null && userWeeks > 0) {
    return { source: 'user', weeks: { min: userWeeks, max: userWeeks } };
  }
  const rule = SHOWS_PLAN_RULES.onSale.value[type];
  return rule ? { source: 'rule', weeks: rule } : { source: 'missing', weeks: null };
}

/** Whole weeks left from `today` to the show, or null without a date. Negative once it is over. */
export function weeksLeft(show: string | null, today: string): number | null {
  return show ? Math.floor(daysBetween(today, show) / 7) : null;
}

/**
 * A last-minute show: fewer weeks are left than the shortest on-sale window for its type, so the
 * campaign has less time than the rule asks for (E4 uses the lean split then).
 */
export function isLastMinute(show: string | null, today: string, onSale: OnSale): boolean {
  const left = weeksLeft(show, today);
  return left !== null && onSale.weeks !== null && left < onSale.weeks.min;
}

export interface Phases {
  announce: number;
  middle: number;
  final: number;
}

/** E4. Comedy and last-minute shows spend 50, 10 and 40; the rest 40, 20 and 40 (percent). */
export function phasesFor(type: ShowType, lastMinute: boolean): Phases {
  const rule = SHOWS_PLAN_RULES.phases.value;
  return type === 'comedy' || lastMinute ? rule.comedyOrLastMinute : rule.default;
}

export interface OnSaleDates {
  /** The earliest and latest day general on sale can open, from the window. */
  general: { from: string; to: string };
  /** The first 48 hours of general on sale, from the earliest opening. */
  critical: { from: string; to: string };
  /** The end of the first week on sale, from the earliest opening. */
  firstWeekEnds: string;
  /** The last week before the show. */
  finalWeek: { from: string; to: string };
}

/** Dates worked back from the show date, in code. Null without both a show date and a window. */
export function onSaleDates(show: string | null, onSale: OnSale): OnSaleDates | null {
  if (!show || !onSale.weeks) return null;
  const from = addDays(show, -onSale.weeks.max * 7);
  return {
    general: { from, to: addDays(show, -onSale.weeks.min * 7) },
    critical: {
      from,
      to: addDays(from, Math.round(SHOWS_PLAN_RULES.presale.value.criticalHours / 24)),
    },
    firstWeekEnds: addDays(from, 7),
    finalWeek: { from: addDays(show, -7), to: show },
  };
}

/** Tickets a target stands for. A percent is of the capacity; a ticket count is taken as given. */
export function ticketTarget(
  capacity: number | null,
  target: { value: number; unit: string | null } | null,
): number | null {
  if (!target) return null;
  const unit = (target.unit ?? '').toLowerCase();
  if (/^(?:%|percent|per cent)/.test(unit)) {
    return capacity ? Math.round((capacity * target.value) / 100) : null;
  }
  if (unit.startsWith('ticket') || unit.startsWith('sale')) return Math.round(target.value);
  return null;
}

export interface Checkpoint {
  key: 'first-week' | 'final-week' | 'show';
  label: string;
  /** Share of the target sold by then, in percent. An editable default, never a forecast. */
  share: number;
}

/**
 * E2. The back-loaded pacing curve: comedy about 6 percent in the first week and about 75 percent
 * in the last, and across events about 57 percent in the final week. Shares are of the team's
 * target, which comes only from the team.
 */
export function pacingFor(type: ShowType): Checkpoint[] {
  const p = SHOWS_PLAN_RULES.pacing.value;
  if (type === 'comedy') {
    return [
      { key: 'first-week', label: 'End of the first week on sale', share: p.comedyFirstWeek },
      {
        key: 'final-week',
        label: 'Start of the final week',
        share: 100 - p.comedyLastWeek,
      },
      { key: 'show', label: 'Show night', share: 100 },
    ];
  }
  return [
    {
      key: 'final-week',
      label: 'Start of the final week',
      share: 100 - p.lastWeekAcrossEvents,
    },
    { key: 'show', label: 'Show night', share: 100 },
  ];
}

/**
 * The calendar for a show type and its on-sale window, in weeks before the show (E1, E3, E4, E5).
 * Without a window only the final week and the night can be placed. Playbook wording: it says what
 * to do, never what an audience likes.
 */
export function beatsFor(type: ShowType, onSale: OnSale): Beat[] {
  const final: Beat = {
    at: -1,
    until: -1,
    key: 'final-push',
    text: 'Run the final push by intent: first people who clicked a purchase link and did not buy, then people who opened or clicked earlier messages, registered for the presale or entered a giveaway, then the core audience. People who already hold tickets get show information, not sales messages.',
  };
  const night: Beat = {
    at: 0,
    key: 'show',
    text: 'Show week: post on the night, read sell-through against the target, and send ticket holders the show information.',
  };
  const w = onSale.weeks;
  if (!w) return [final, night];
  const beats: Beat[] = [
    {
      // The presale runs in the days before general on sale and ends before it opens, so it
      // is one week, not a range that reaches into the on-sale week.
      at: -(w.max + 1),
      key: 'presale',
      text: 'Open the presale registration for 4 to 7 days, behind an access code, with an end date. Send the code 3 to 7 days before general on sale.',
    },
    {
      at: -w.max,
      until: -w.min,
      key: 'on-sale',
      text: 'Open general on sale. The first 48 hours are the most important: post the link, send the email and SMS scripts and read sales every day.',
    },
  ];
  if (w.min >= 3) {
    beats.push({
      at: -(w.min - 1),
      until: -2,
      key: 'maintain',
      text: 'Keep sales moving at a lower spend: new content each week, a reminder to presale registrants and a share of the budget held back for the final week.',
    });
  }
  return [...beats, final, night];
}

/** The modules a Live shows plan can carry, in order. */
export const SHOWS_MODULES = [
  'onsale',
  'partnerships',
  'publicity',
  'venues',
  'finalpush',
  'timeline',
  'budget',
  'measure',
  'risks',
] as const satisfies readonly LaunchModuleKey[];

export interface ModuleInput {
  scope: 'full' | 'narrow';
  /** The module a narrow ask names. Null when it names only core sections, such as cities. */
  ask: LaunchModuleKey | null;
  hasBudget: boolean;
}

export interface ModulePick {
  modules: LaunchModuleKey[];
  /** Modules the brief rules out, and why, for the Gaps section. */
  ruledOut: { key: LaunchModuleKey; why: string }[];
}

/**
 * Modules a plan carries on top of the core (spec §6.1). Budget split is always offered: shares
 * with no budget, amounts with one.
 */
export function pickModules(input: ModuleInput): ModulePick {
  if (input.scope === 'full') return { modules: [...SHOWS_MODULES], ruledOut: [] };
  const asked = input.ask;
  return {
    modules: asked && (SHOWS_MODULES as readonly string[]).includes(asked) ? [asked] : [],
    ruledOut: [],
  };
}

export interface KindProfile {
  label: string;
  /** For a sentence: "Planned as a ___". */
  short: string;
  /** Named, never given a target: the plan does not forecast. */
  measures: readonly string[];
  /** Table cities that stand in for markets when the brief names none. Shown as Worth a look. */
  defaultCities: readonly string[];
}

const measures = [
  'Presale registrations, read the day general on sale opens',
  'Tickets sold in the first 48 hours of general on sale',
];

export const KIND_PROFILES: Record<ShowType, KindProfile> = {
  concert: {
    label: SHOW_TYPE_LABEL.concert,
    short: 'concert',
    measures,
    defaultCities: ['Lagos', 'London', 'New York'],
  },
  comedy: {
    label: SHOW_TYPE_LABEL.comedy,
    short: 'comedy night',
    measures,
    defaultCities: ['Lagos', 'London', 'New York'],
  },
  club: {
    label: SHOW_TYPE_LABEL.club,
    short: 'club night',
    measures,
    defaultCities: ['Lagos', 'London', 'Accra'],
  },
  theatre: {
    label: SHOW_TYPE_LABEL.theatre,
    short: 'stage play',
    measures,
    defaultCities: ['London', 'New York', 'Lagos'],
  },
  screening: {
    label: SHOW_TYPE_LABEL.screening,
    short: 'screening',
    measures,
    defaultCities: ['Lagos', 'London', 'New York'],
  },
};
