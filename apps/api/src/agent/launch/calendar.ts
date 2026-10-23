import {
  type Beat,
  CALENDAR_RULES,
  type DatedBeat,
  datedBeats,
  leadChannels,
  type RuleSource,
} from '@oraqul/packs';
import type { CalendarRow, Category, LaunchSection, Territory } from '@oraqul/schema';
import { slug } from './brief.js';
import { codeLine, weeks } from './signal.js';

// The social content calendar. Code writes it from the release date and today, like the launch
// beats, so no row already over is advised. Every line is a playbook line that claims nothing
// about taste. It is a guide for what to post: Oraqul makes none of it.

interface Meta {
  asset: string | null;
  count: number | null;
  per: CalendarRow['per'];
}

const NO_META: Meta = { asset: null, count: null, per: null };

/** What a row says about how many posts, in the source's own terms and no more. */
function postsText(row: Pick<CalendarRow, 'count' | 'per' | 'grade'>): string {
  if (row.count === null || row.per === null) {
    return row.grade === 'not-researched'
      ? 'Posts: not researched.'
      : 'Posts: the source gives no number.';
  }
  if (row.per === 'span') return `Posts: ${row.count}.`;
  if (row.per === 'day') return `Posts: ${row.count} a day.`;
  return `Posts: at least ${row.count} a week.`;
}

const GRADE_NOTE: Record<RuleSource['grade'], string | null> = {
  team: null,
  directional:
    'This calendar follows blog-level guidance, one source for each point. Treat it as direction, not a measured result.',
  'not-researched':
    'Not researched for this category. The rows follow the launch beats, and no post counts are stated.',
};

/**
 * The calendar rows for a category: its calendar rule, or its kind profile beats where the rule
 * holds none. One set of rows per territory, each on that territory's lead channel.
 */
export function calendarRows(input: {
  category: Exclude<Category, 'shows'>;
  release: string | null;
  today: string;
  territories: Territory[];
  beats: readonly Beat[];
}): CalendarRow[] {
  const { category, release, today, territories } = input;
  const rule = CALENDAR_RULES.categories[category];
  const meta = new Map<string, Meta>();
  const beats: Beat[] = rule.value.fromBeats
    ? [...input.beats]
    : rule.value.rows.map((r) => {
        meta.set(r.key, { asset: r.asset, count: r.count, per: r.per });
        return { at: r.at, until: r.until, key: r.key, text: r.post };
      });
  const dated: DatedBeat[] = datedBeats(beats, release, today);
  const fallback = leadChannels(category, null)[0] ?? 'the lead channel';
  const targets: { name: string | null; channel: string }[] = territories.length
    ? territories.map((t) => ({
        name: t.name,
        channel: t.channels.find((c) => c.lead)?.name ?? t.channels[0]?.name ?? fallback,
      }))
    : [{ name: null, channel: fallback }];
  return targets.flatMap((target) =>
    dated.map((b): CalendarRow => {
      const m = meta.get(b.key) ?? NO_META;
      return {
        id: `calendar-${target.name ? `${slug(target.name)}-` : ''}${b.key}`,
        territory: target.name,
        key: b.key,
        at: b.at,
        ...(b.until === undefined ? {} : { until: b.until }),
        from: b.from,
        to: b.to,
        asset: m.asset,
        post: b.text,
        channel: target.channel,
        count: m.count,
        per: m.per,
        ruleId: rule.id,
        grade: rule.source.grade,
      };
    }),
  );
}

function when(row: CalendarRow): string {
  const span = row.until === undefined ? weeks(row.at) : `${weeks(row.at)} to ${weeks(row.until)}`;
  const days =
    row.from && row.to
      ? row.from === row.to
        ? ` (${row.from})`
        : ` (${row.from} to ${row.to})`
      : '';
  return `${span}${days}`;
}

/** The section the plan carries, one group per territory and the paid ads note last. */
export function calendarSection(
  title: string,
  rows: CalendarRow[],
  category: Exclude<Category, 'shows'>,
): LaunchSection {
  if (rows.length === 0) {
    return {
      key: 'calendar',
      title,
      lines: [
        codeLine(
          'calendar-passed',
          'The release date has passed, so there is no content calendar left to plan. Send the results and run an audit to see what to change.',
        ),
      ],
    };
  }
  const note = GRADE_NOTE[CALENDAR_RULES.categories[category].source.grade];
  const lines = [
    ...(note ? [codeLine('calendar-source', note)] : []),
    ...rows.map((r) =>
      codeLine(
        r.id,
        `${when(r)}: ${r.post}${r.asset ? ` Asset: ${r.asset}.` : ''} Lead on ${r.channel}. ${postsText(r)}`,
        r.territory,
      ),
    ),
    ...CALENDAR_RULES.ads.value.lines.map((text, i) =>
      codeLine(`calendar-ads-${i + 1}`, text, 'Paid ads'),
    ),
  ];
  return { key: 'calendar', title, lines };
}
