import type { Category } from '@oraqul/schema';
import { teamRule } from './shared';
import type { Rule, RuleSource } from './types';

// The social content calendar. Code writes it from the release date like the launch beats, as
// playbook lines that claim nothing about taste. Counts exist only where a source gave one; a
// category with no researched source holds no rows here and takes its rows from its kind profile
// beats, with no invented numbers.

export const CALENDAR_VERSION = 'calendar@2026-10-23.1';

/** One post or run of posts, in weeks from the release. Negative is before it. */
export interface CalendarRow {
  key: string;
  at: number;
  until?: number;
  /** The kind of asset to post, such as a teaser. Null where the source names none. */
  asset: string | null;
  /** What to do, in playbook wording. */
  post: string;
  /** Posts in the span, as the source states it. Null where the source gives no number. */
  count: number | null;
  per: 'week' | 'day' | 'span' | null;
}

export interface CalendarRule {
  rows: CalendarRow[];
  /** True where the rows come from the category's kind profile beats instead of this rule. */
  fromBeats: boolean;
}

const directional = (label: string, caveat: string): RuleSource => ({
  kind: 'team',
  label,
  date: '2026-10-23',
  grade: 'directional',
  caveat,
});

const NOT_RESEARCHED: RuleSource = {
  kind: 'team',
  label: 'Oraqul team rule',
  date: '2026-10-23',
  grade: 'not-researched',
  caveat: 'Not researched. The rows come from the kind profile beats and carry no post counts.',
};

const FILM_SOURCE = directional(
  'Independent film marketing guidance (blog level, one source per point)',
  'Blog-level advice for independent films, not a measured result. The page behind each point is not recorded here.',
);
const MUSIC_SOURCE = directional(
  'Music release marketing guidance (blog level, one source per point)',
  'Blog-level advice for releases, not a measured result. The page behind each point is not recorded here.',
);

export const CALENDAR: Record<Category, Rule<CalendarRule>> = {
  film: {
    id: 'film.calendar',
    source: FILM_SOURCE,
    value: {
      fromBeats: false,
      rows: [
        {
          key: 'print',
          at: -8,
          asset: 'press pitch',
          post: 'Pitch print outlets about two months before release.',
          count: null,
          per: null,
        },
        {
          key: 'exclusive',
          at: -4,
          asset: 'trailer',
          post: 'Offer the trailer as an exclusive to one big outlet first, then release it everywhere.',
          count: 1,
          per: 'span',
        },
        {
          key: 'weekly',
          at: -4,
          until: -2,
          asset: 'new asset',
          post: 'Put something new out every week: a still, a clip or a cast post.',
          count: 1,
          per: 'week',
        },
        {
          key: 'screener',
          at: -3,
          until: -1,
          asset: 'online screener',
          post: 'Give reviewers an online screener and ask them to hold reviews until a few days before release.',
          count: null,
          per: null,
        },
        {
          key: 'podcasts',
          at: -2,
          until: -1,
          asset: 'guest pitch',
          post: 'Pitch podcasts: they need one to two weeks of lead time.',
          count: null,
          per: null,
        },
        {
          key: 'final-week',
          at: -1,
          until: 0,
          asset: 'daily post',
          post: 'Post something every day in the final week.',
          count: 1,
          per: 'day',
        },
      ],
    },
  },
  music: {
    id: 'music.calendar',
    source: MUSIC_SOURCE,
    value: {
      fromBeats: false,
      rows: [
        {
          key: 'presave',
          at: -3,
          asset: 'pre-save link',
          post: 'Open the pre-save at least three weeks before release and put the link in every post.',
          count: null,
          per: null,
        },
        {
          key: 'teasers',
          at: -3,
          until: -1,
          asset: 'teaser, 10 to 30 seconds',
          post: 'Post short teasers of 10 to 30 seconds, at least three a week.',
          count: 3,
          per: 'week',
        },
        {
          key: 'release-day',
          at: 0,
          asset: null,
          post: 'Post on release day: the song, the link and the story behind it.',
          count: null,
          per: null,
        },
        {
          key: 'after',
          at: 1,
          until: 3,
          asset: null,
          post: 'Keep posting for two to three weeks after release, with a new angle each time.',
          count: null,
          per: null,
        },
      ],
    },
  },
  shows: {
    id: 'shows.calendar',
    source: {
      kind: 'team',
      label: 'Derived from the live show rules (E1 to E5)',
      date: '2026-10-23',
      grade: 'directional',
      caveat:
        'The rows follow the on-sale, presale and final push rules, which rest on a 2019 Eventbrite article and a secondhand ticketing blog figure. No Nigerian live event data was found. They state no post counts.',
    },
    value: { fromBeats: true, rows: [] },
  },
  books: { id: 'books.calendar', source: NOT_RESEARCHED, value: { fromBeats: true, rows: [] } },
  podcasts: {
    id: 'podcasts.calendar',
    source: NOT_RESEARCHED,
    value: { fromBeats: true, rows: [] },
  },
  games: { id: 'games.calendar', source: NOT_RESEARCHED, value: { fromBeats: true, rows: [] } },
};

/** The paid-ads note every calendar carries. Directional: the source is an ad tool vendor. */
export const CALENDAR_ADS = teamRule('calendar.ads', {
  lines: [
    'Put about 80 percent of paid spend behind creative that has already worked, and about 20 percent into testing new creative.',
    'Run three to five ads in each ad group.',
    'Judge a winner by its conversion count, not by how many days it has run.',
  ],
});

export const CALENDAR_RULES = {
  version: CALENDAR_VERSION,
  categories: CALENDAR,
  ads: {
    ...CALENDAR_ADS,
    source: directional(
      'Ad tool vendor guidance',
      'The source sells ad tools, so treat the split and the counts as direction, not a result.',
    ),
  },
};
