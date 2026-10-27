import { describe, expect, it } from 'vitest';
import { buildIcs, fold, isIsoDay } from './ics.js';

const now = new Date('2026-10-27T10:00:00Z');

describe('buildIcs', () => {
  it('writes all-day events with an exclusive end, a stable uid and escaped text', () => {
    const ics = buildIcs({
      name: 'Night Ferry, launch',
      now,
      events: [
        { uid: 'a', date: '2027-03-01', endDate: '2027-03-03', title: 'Trailer; teaser, "drop"' },
        { uid: 'b', date: '2027-03-12', title: 'Release' },
      ],
    });
    expect(ics).toContain('X-WR-CALNAME:Night Ferry\\, launch');
    expect(ics).toContain('UID:a@oraqul');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270301');
    expect(ics).toContain('DTEND;VALUE=DATE:20270304');
    expect(ics).toContain('DTEND;VALUE=DATE:20270313');
    expect(ics).toContain('SUMMARY:Trailer; teaser\\, "drop"');
    expect(ics).toContain('DTSTAMP:20261027T100000Z');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });

  it('skips a bad date and a repeated uid', () => {
    const ics = buildIcs({
      name: 'x',
      now,
      events: [
        { uid: 'a', date: 'next week', title: 'Bad' },
        { uid: 'b', date: '2027-02-30', title: 'Impossible' },
        { uid: 'c', date: '2027-03-01', title: 'One' },
        { uid: 'c', date: '2027-03-02', title: 'Again' },
      ],
    });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).not.toContain('Bad');
  });

  it('folds long lines on character boundaries', () => {
    const long = `SUMMARY:${'é'.repeat(80)}`;
    const folded = fold(long);
    expect(folded.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
    expect(folded.replaceAll('\r\n ', '')).toBe(long);
  });

  it('checks ISO days', () => {
    expect(isIsoDay('2027-03-01')).toBe(true);
    expect(isIsoDay('2027-3-1')).toBe(false);
    expect(isIsoDay(null)).toBe(false);
  });
});
