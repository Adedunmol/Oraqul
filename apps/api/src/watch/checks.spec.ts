import { describe, expect, it } from 'vitest';
import {
  isoWeek,
  milestoneEvents,
  paceEvent,
  rivalEvents,
  rivalSeverity,
  staleEvent,
} from './checks.js';

const evidence = {
  url: 'https://x.example',
  title: 'X',
  retrievedAt: '2026-10-27',
  quote: '12 March 2027',
};

describe('rivalSeverity', () => {
  it('is act the same weekend, watch inside the window and info beyond it', () => {
    expect([0, 2, -2].map(rivalSeverity)).toEqual(['act', 'act', 'act']);
    expect([3, -7].map(rivalSeverity)).toEqual(['watch', 'watch']);
    expect([8, -20].map(rivalSeverity)).toEqual(['info', 'info']);
  });
});

describe('rivalEvents', () => {
  const rivals = [
    { title: 'Salt Road 2', date: '2027-03-12', evidence },
    { title: 'Named Rival', date: '2027-03-15', evidence },
  ];
  it('says the date is from the web with the day it was read, and skips a rival the team named', () => {
    const events = rivalEvents(rivals, '2027-03-15', ['named rival']);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'rival_date',
      severity: 'watch',
      evidence: [evidence],
    });
    expect(events[0]?.reason).toContain('3 days before your release on 2027-03-15');
    expect(events[0]?.reason).toContain('from the web, read on 2026-10-27, not from Qloo');
  });
});

describe('milestoneEvents', () => {
  const row = (over = {}) => ({
    id: 'a',
    title: 'Cut teaser',
    startsOn: '2027-02-01',
    endsOn: null,
    status: 'todo' as const,
    ...over,
  });
  it('raises an undone action after its date, and act three days on', () => {
    expect(milestoneEvents([row()], '2027-02-01')).toEqual([]);
    expect(milestoneEvents([row()], '2027-02-02')[0]).toMatchObject({
      severity: 'watch',
      dedupeKey: 'milestone:a:watch',
    });
    expect(milestoneEvents([row()], '2027-02-04')[0]).toMatchObject({
      severity: 'act',
      dedupeKey: 'milestone:a:act',
    });
  });
  it('ignores done and undated actions and prefers the end date', () => {
    expect(
      milestoneEvents([row({ status: 'done' }), row({ startsOn: null })], '2027-03-01'),
    ).toEqual([]);
    expect(milestoneEvents([row({ endsOn: '2027-02-10' })], '2027-02-05')).toEqual([]);
  });
});

describe('staleEvent', () => {
  it('is raised from 14 days, not before, and not when a newer refresh exists', () => {
    expect(staleEvent('2027-01-01', false, '2027-01-14')).toBeNull();
    expect(staleEvent('2027-01-01', false, '2027-01-15')).toMatchObject({
      severity: 'act',
      title: 'This plan is 14 days old',
    });
    expect(staleEvent('2027-01-01', true, '2027-03-01')).toBeNull();
  });
  it('is keyed by week so it is raised once a week', () => {
    expect(staleEvent('2027-01-01', false, '2027-02-01')?.dedupeKey).toBe(
      `stale:${isoWeek('2027-02-01')}`,
    );
    expect(isoWeek('2027-02-01')).toBe(isoWeek('2027-02-03'));
    expect(isoWeek('2027-02-01')).not.toBe(isoWeek('2027-02-08'));
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
    expect(isoWeek('2027-01-04')).toBe('2027-W01');
  });
});

describe('paceEvent', () => {
  const result = {
    verdict: 'behind',
    reason: null,
    target: 1000,
    unit: 'tickets',
    actual: 300,
    expected: 400,
    gap: -100,
    gapPoints: -10,
    entries: 3,
    days: 2,
    asOf: '2027-03-01',
    daysToRelease: 14,
    note: '',
  } as const;
  it('is raised only when behind, with the gap in the signal’s unit', () => {
    expect(paceEvent({ ...result, verdict: 'on-pace' })).toBeNull();
    expect(paceEvent(null)).toBeNull();
    const event = paceEvent(result);
    expect(event?.severity).toBe('act');
    expect(event?.reason).toContain('100 tickets (10 points of the target) behind');
    expect(event?.dedupeKey).toBe('pace:2027-03-01');
  });
});
