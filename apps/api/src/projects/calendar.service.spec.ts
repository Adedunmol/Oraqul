import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { campaignActions } from '../db/schema.js';
import { calendarRow, planWith, seedProject } from '../test-support/seed.js';
import { CalendarService } from './calendar.service.js';

describe('the plan calendar', () => {
  let seed: Awaited<ReturnType<typeof seedProject>>;
  let service: CalendarService;
  let outputId = '';

  beforeAll(async () => {
    seed = await seedProject();
    service = new CalendarService(seed.db);
    outputId = await seed.save({
      plan: planWith([
        calendarRow('teaser', -2, '2099-02-26', 'teaser'),
        calendarRow('launch', 0, '2099-03-12', 'daily post'),
        calendarRow('undated', -3, null, 'press pitch'),
      ]),
      inputs: { rivals: [{ title: 'Salt Road 2', date: '2099-03-12' }] } as never,
    });
  });
  afterAll(() => seed.database.close());

  it('writes the release, dated rows, readings and rivals with titles and dates only', async () => {
    const { ics } = await service.forOutput(outputId);
    expect(ics).toContain('SUMMARY:Release: Night Ferry');
    expect(ics).toContain('DTSTART;VALUE=DATE:20990312');
    expect(ics).toContain('SUMMARY:Post teaser. (Lagos\\, Instagram)');
    expect(ics).toContain('SUMMARY:Read: tickets sold');
    expect(ics).toContain('DTSTART;VALUE=DATE:20990212');
    expect(ics).toContain('SUMMARY:Rival opens: Salt Road 2');
    expect(ics).not.toContain('Post undated');
    expect(ics).not.toMatch(/DESCRIPTION|finding|receipt/i);
  });

  it('uses the campaign actions instead of the rows once they are set, and skips done ones', async () => {
    const base = { outputId, projectId: seed.projectId, channel: 'TikTok' };
    await seed.db.insert(campaignActions).values([
      { ...base, title: 'Cut the teaser', startsOn: '2099-02-20', position: 1 },
      { ...base, title: 'Old task', startsOn: '2099-02-21', status: 'done', position: 2 },
    ]);
    const { ics } = await service.forOutput(outputId);
    expect(ics).toContain('SUMMARY:Cut the teaser (TikTok)');
    expect(ics).not.toContain('Old task');
    expect(ics).not.toContain('Post teaser');
  });

  it('keeps one live feed: only the hash is stored, a new one revokes the old, a revoked one is a 404', async () => {
    expect(await service.feedState(seed.projectId)).toEqual({ active: false });
    const first = await service.createFeed(seed.projectId, seed.userId);
    expect((await service.byToken(`${first.token}.ics`)).ics).toContain('BEGIN:VCALENDAR');
    const second = await service.createFeed(seed.projectId, seed.userId);
    await expect(service.byToken(first.token)).rejects.toThrow('No such calendar');
    expect((await service.byToken(second.token)).name).toBe('Night Ferry');
    const rows = await seed.db.query.calendarFeeds.findMany();
    expect(JSON.stringify(rows)).not.toContain(second.token);
    await service.revokeFeed(seed.projectId);
    await expect(service.byToken(second.token)).rejects.toThrow('No such calendar');
    expect(await service.feedState(seed.projectId)).toEqual({ active: false });
  });
});
