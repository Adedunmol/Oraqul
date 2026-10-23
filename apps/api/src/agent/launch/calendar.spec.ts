import { CALENDAR_RULES, filmPlan } from '@oraqul/packs';
import type { Territory } from '@oraqul/schema';
import { describe, expect, it } from 'vitest';
import { calendarRows, calendarSection } from './calendar.js';

const territory = (name: string, channels: string[]): Territory => ({
  id: `territory-${name.toLowerCase()}`,
  name,
  role: 'home',
  order: 0,
  callId: null,
  channels: channels.map((c, i) => ({ name: c, lead: i < 2 })),
  partnerIds: [],
  lineIds: [],
});

const lagos = territory('Lagos', ['Instagram', 'TikTok']);
const london = territory('London', ['YouTube', 'Instagram']);

describe('calendarRows', () => {
  it('works film back from the release date, per territory, on each lead channel', () => {
    const rows = calendarRows({
      category: 'film',
      release: '2099-03-12',
      today: '2099-01-01',
      territories: [lagos, london],
      beats: [],
    });
    const lagosRows = rows.filter((r) => r.territory === 'Lagos');
    expect(lagosRows.length).toBeGreaterThan(0);
    expect(lagosRows.every((r) => r.channel === 'Instagram')).toBe(true);
    expect(rows.filter((r) => r.territory === 'London').every((r) => r.channel === 'YouTube')).toBe(
      true,
    );
    const exclusive = lagosRows.find((r) => r.key === 'exclusive');
    expect(exclusive).toMatchObject({
      from: '2099-02-12',
      count: 1,
      per: 'span',
      grade: 'directional',
    });
  });

  it('drops rows that are already over, and keeps weeks when there is no date', () => {
    const late = calendarRows({
      category: 'film',
      release: '2099-03-12',
      today: '2099-03-05',
      territories: [lagos],
      beats: [],
    });
    expect(late.some((r) => r.key === 'print')).toBe(false);
    expect(late.some((r) => r.key === 'final-week')).toBe(true);
    const undated = calendarRows({
      category: 'music',
      release: null,
      today: '2099-01-01',
      territories: [],
      beats: [],
    });
    expect(undated.length).toBeGreaterThan(0);
    expect(undated.every((r) => r.from === null && r.territory === null)).toBe(true);
  });

  it('reads music teasers as at least three a week', () => {
    const rows = calendarRows({
      category: 'music',
      release: '2099-05-01',
      today: '2099-01-01',
      territories: [lagos],
      beats: [],
    });
    expect(rows.find((r) => r.key === 'teasers')).toMatchObject({ count: 3, per: 'week' });
  });

  it('builds games, books and podcasts from their kind beats, with no counts', () => {
    const beats = [
      { at: -16, key: 'store-page', text: 'Open the store page.' },
      { at: 0, key: 'launch', text: 'Launch.' },
    ];
    const rows = calendarRows({
      category: 'games',
      release: '2099-06-01',
      today: '2099-01-01',
      territories: [lagos],
      beats,
    });
    expect(rows.map((r) => r.key)).toEqual(['store-page', 'launch']);
    expect(rows.every((r) => r.count === null && r.grade === 'not-researched')).toBe(true);
    expect(rows.every((r) => r.ruleId === 'games.calendar')).toBe(true);
  });
});

describe('calendarSection', () => {
  const rowsFor = (category: 'film' | 'games') =>
    calendarRows({
      category,
      release: '2099-03-12',
      today: '2099-01-01',
      territories: [lagos],
      beats: [{ at: -4, key: 'trailer', text: 'Publish the trailer.' }],
    });

  it('writes playbook lines that claim nothing about taste, and ends on the paid ads note', () => {
    const section = calendarSection('Content calendar', rowsFor('film'), 'film');
    expect(section.key).toBe('calendar');
    expect(section.lines.every((l) => l.kind === 'playbook' && l.findingIds.length === 0)).toBe(
      true,
    );
    for (const l of section.lines) expect(filmPlan.TASTE_CLAIM.test(l.text), l.text).toBe(false);
    expect(section.lines.at(-1)?.group).toBe('Paid ads');
    expect(section.lines.map((l) => l.text).join(' ')).toContain('80 percent');
  });

  it('says where the guidance is directional or not researched', () => {
    const film = calendarSection('Content calendar', rowsFor('film'), 'film');
    expect(film.lines[0]?.text).toContain('blog-level guidance');
    const games = calendarSection('Content calendar', rowsFor('games'), 'games');
    expect(games.lines[0]?.text).toContain('Not researched');
    expect(games.lines.some((l) => l.text.includes('Posts: not researched.'))).toBe(true);
  });

  it('says plainly when the release date has passed', () => {
    const section = calendarSection('Content calendar', [], 'film');
    expect(section.lines).toHaveLength(1);
    expect(section.lines[0]?.id).toBe('calendar-passed');
  });

  it('keeps the paid ads rule directional', () => {
    expect(CALENDAR_RULES.ads.source.grade).toBe('directional');
  });
});
