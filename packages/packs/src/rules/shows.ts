import type { Rule, RuleLibrary, RuleSource } from './types';

// Live shows: a single show or a short run (a concert, a comedy night, a club night, a stage play,
// a one night premiere or screening). The rules below work back from the show date. Every figure
// is a default the team can edit, not a fact and not a forecast. No Nigerian live event data was
// found, so nothing here is specific to Nigeria. Email and SMS are playbook lines, not platforms.

export const SHOWS_VERSION = 'shows@2026-10-23.1';

export const showTypes = ['concert', 'comedy', 'club', 'theatre', 'screening'] as const;
export type ShowType = (typeof showTypes)[number];

const NO_NIGERIA =
  'No Nigerian live event data was found, so none of these numbers is specific to Nigeria.';
const EVENTBRITE =
  'The comedy figures come from a 2019 Eventbrite article, not found again online, so no link is recorded.';
const TICKPICK =
  'The 57 percent figure is secondhand: the ticketing blog behind it attributes it to Eventbrite, where the brief said Pollstar, and it links no original study.';

const base = { kind: 'team' as const, date: '2026-10-23' };

const OWN: RuleSource = { ...base, label: 'Oraqul team rule', grade: 'team', caveat: NO_NIGERIA };

const COMEDY_SOURCE: RuleSource = {
  ...base,
  label: 'Eventbrite article on selling comedy tickets (2019)',
  grade: 'directional',
  caveat: `${EVENTBRITE} ${NO_NIGERIA}`,
};

const PACING_SOURCE: RuleSource = {
  kind: 'url',
  label: 'TickPick, The Last-Minute Ticket Sales Playbook',
  url: 'https://www.tickpick.com/blog/organizer/last-minute-ticket-sales-playbook',
  date: '2026-10-23',
  grade: 'directional',
  caveat: `${TICKPICK} ${EVENTBRITE} ${NO_NIGERIA}`,
};

const NOT_RESEARCHED: RuleSource = {
  ...base,
  label: 'Oraqul team rule',
  grade: 'not-researched',
  caveat: `Not researched, so the team supplies the window and the plan marks it as user supplied. ${NO_NIGERIA}`,
};

const rule = <T>(id: string, value: T, source: RuleSource): Rule<T> => ({ id, value, source });

/** Weeks the general on sale runs before the show, by type. Null where nobody researched it (E1). */
export interface OnSaleWindow {
  min: number;
  max: number;
}

export const SHOWS_PLAN_RULES = {
  version: SHOWS_VERSION,
  /** E1. Work backwards from the show date. Theatre and screenings are the team's to supply. */
  onSale: rule<Record<ShowType, OnSaleWindow | null>>(
    'shows.on-sale',
    {
      comedy: { min: 4, max: 6 },
      concert: { min: 6, max: 10 },
      club: { min: 2, max: 4 },
      theatre: null,
      screening: null,
    },
    COMEDY_SOURCE,
  ),
  /** E2. The one primary signal and the default pacing curve. A default, never the team's target. */
  pacing: rule(
    'shows.pacing',
    {
      /** Share of tickets sold, in percent, by the end of the first week on sale. */
      comedyFirstWeek: 6,
      /** Share sold in the last week, in percent, for comedy. */
      comedyLastWeek: 75,
      /** Share sold in the last week, in percent, across events. */
      lastWeekAcrossEvents: 57,
    },
    PACING_SOURCE,
  ),
  /** E3. A presale needs an access code and an end date. */
  presale: rule(
    'shows.presale',
    {
      /** Days before general on sale that a presale opens. */
      leadDays: { min: 3, max: 7 },
      /** Days registration for the presale stays open. */
      registrationDays: { min: 4, max: 7 },
      /** Hours of general on sale that matter most. */
      criticalHours: 48,
    },
    OWN,
  ),
  /** E4. The budget by phase, in percent. The final push is always held back. */
  phases: rule(
    'shows.phases',
    {
      default: { announce: 40, middle: 20, final: 40 },
      comedyOrLastMinute: { announce: 50, middle: 10, final: 40 },
    },
    COMEDY_SOURCE,
  ),
  /** E5. The final push by intent. Ticket holders get information, not sales messages. */
  intent: rule(
    'shows.intent',
    {
      highest: 'People who clicked a purchase link but did not buy.',
      medium:
        'People who opened or clicked earlier messages, registered for the presale or entered a giveaway.',
      broad: 'The core target audience.',
      holders: 'People who already hold tickets get show information, not sales messages.',
    },
    OWN,
  ),
  /** E6. A rival counts as the same night or the same week by its distance from the show. */
  clash: rule('shows.clash', { sameNightDays: 0, sameWeekDays: 7 }, OWN),
  /** E7. One plan per city, home city first, and the budget band is asked first. */
  cities: rule('shows.cities', { onePlanPerCity: true, askBandFirst: true }, OWN),
  /** E8. Guides and scripts only. */
  guides: rule(
    'shows.guides',
    {
      makes: [
        'announcement copy',
        'presale email and SMS scripts',
        'ad hook options',
        'a promo calendar',
        'shot lists for promo clips',
      ],
    },
    OWN,
  ),
  /** Theatre and screenings: no researched window, so the plan says the team supplied it. */
  userSupplied: rule('shows.user-supplied', { types: ['theatre', 'screening'] }, NOT_RESEARCHED),
};

const stage = (id: string, text: string) => rule(id, text, OWN);

export const SHOWS_RULES: RuleLibrary = {
  category: 'shows',
  version: SHOWS_VERSION,
  timeline: [
    rule(
      'shows.timeline',
      'Work back from the show date. General on sale opens about 4 to 6 weeks out for a comedy night, 6 to 10 for an independent concert and 2 to 4 for a club night; a presale opens 3 to 7 days before it. For theatre and screenings the team gives the window.',
      COMEDY_SOURCE,
    ),
    stage(
      'shows.final-push',
      'Hold budget back for the final push: more tickets sell in the last week than in any other.',
    ),
  ],
  // The calendar depends on the show type and the on-sale window, so it is built in code
  // (`shows/modules.ts`), as the Games, Books and Podcasts calendars are.
  beats: [],
  signal: rule(
    'shows.signal',
    {
      key: 'sell-through',
      primary: 'Tickets sold against capacity (sell-through)',
      secondary: ['Presale registrations', 'Followers', 'Views'],
      // The end of the first week on sale is set in code from the on-sale date.
      checkpoints: [-7, -1],
      benchmark: null,
    },
    PACING_SOURCE,
  ),
  channels: rule('shows.channels', ['Instagram', 'TikTok', 'X'], OWN),
};
