import { describe, expect, it } from 'vitest';
import { parseActuals, parseDay, parseValue } from './actuals-parse.js';

describe('parseDay', () => {
  it.each([
    ['2027-03-12', '2027-03-12'],
    ['2027/3/2', '2027-03-02'],
    ['12 Mar 2027', '2027-03-12'],
    ['12th March 2027', '2027-03-12'],
    ['March 12, 2027', '2027-03-12'],
  ])('reads %s', (raw, iso) => expect(parseDay(raw)).toBe(iso));

  it.each(['03/04/2027', '2027-02-30', 'next week', '', '12 Foo 2027'])('refuses %s', (raw) =>
    expect(parseDay(raw)).toBeNull(),
  );
});

describe('parseValue', () => {
  it('reads plain, grouped and percent figures, and refuses the rest', () => {
    expect(parseValue('1,200')).toBe(1200);
    expect(parseValue('₦ 3 000.5')).toBe(3000.5);
    expect(parseValue('42%')).toBe(42);
    expect(parseValue('-3')).toBeNull();
    expect(parseValue('lots')).toBeNull();
  });
});

describe('parseActuals', () => {
  it('reads pasted lines with a comma, a space or a tab, and optional city and channel', () => {
    const out = parseActuals(
      '2027-03-01, 120\n2027-03-02 150\n2027-03-03\t90\n2027-03-04, 80, Lagos, Instagram',
    );
    expect(out.columns).toBeNull();
    expect(out.errors).toEqual([]);
    expect(out.rows).toEqual([
      { onDate: '2027-03-01', value: 120, city: '', channel: '' },
      { onDate: '2027-03-02', value: 150, city: '', channel: '' },
      { onDate: '2027-03-03', value: 90, city: '', channel: '' },
      { onDate: '2027-03-04', value: 80, city: 'Lagos', channel: 'Instagram' },
    ]);
  });

  it('guesses a mapping from a header and drops every unmapped column', () => {
    const csv =
      'Date,Customer email,Tickets,City\n2027-03-01,a@b.co,120,Lagos\n2027-03-02,c@d.co,"1,150",Accra';
    const out = parseActuals(csv);
    expect(out.columns).toEqual(['Date', 'Customer email', 'Tickets', 'City']);
    expect(out.mapping).toMatchObject({
      date: 'Date',
      value: 'Tickets',
      city: 'City',
      channel: null,
    });
    expect(out.rows).toEqual([
      { onDate: '2027-03-01', value: 120, city: 'Lagos', channel: '' },
      { onDate: '2027-03-02', value: 1150, city: 'Accra', channel: '' },
    ]);
    expect(JSON.stringify(out.rows)).not.toContain('@');
  });

  it('uses the mapping the person chose', () => {
    const csv = 'when,a,b\n2027-03-01,5,500';
    const out = parseActuals(csv, { date: 'when', value: 'b', city: null, channel: null });
    expect(out.rows[0]?.value).toBe(500);
  });

  it('reports a bad line with its number and keeps the good ones', () => {
    const out = parseActuals('2027-03-01, 10\nfriday, 12\n2027-03-03, many\n2027-03-04, 9');
    expect(out.rows.map((r) => r.onDate)).toEqual(['2027-03-01', '2027-03-04']);
    expect(out.errors.map((e) => e.line)).toEqual([2, 3]);
  });
});
