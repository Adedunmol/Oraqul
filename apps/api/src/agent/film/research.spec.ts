import { numbered, toSources } from './research.js';

const pages = [
  { title: 'Cinema report', url: 'https://example.com/report' },
  { title: 'Release slate', url: 'https://example.com/slate' },
];

describe('toSources', () => {
  it('ties each fact to its page and drops one whose page number is not in the list', () => {
    const out = toSources(
      [
        { fact: 'December is the busiest month for cinema releases.', source: 1 },
        { fact: 'A comparable film opens on the 16th.', source: 2 },
        { fact: 'Invented page.', source: 9 },
        { fact: 'Zero is not a page.', source: 0 },
      ],
      pages,
    );
    expect(out.map((s) => [s.fact, s.url])).toEqual([
      ['December is the busiest month for cinema releases.', 'https://example.com/report'],
      ['A comparable film opens on the 16th.', 'https://example.com/slate'],
    ]);
  });

  it('keeps a repeated fact once', () => {
    const out = toSources(
      [
        { fact: 'Same fact.', source: 1 },
        { fact: 'same fact.', source: 2 },
      ],
      pages,
    );
    expect(out).toHaveLength(1);
  });

  it('drops an announced event whose day has passed, and keeps one still to come', () => {
    const out = toSources(
      [
        { fact: 'The Davido festival runs on 14 August.', source: 1, eventDate: '2026-08-14' },
        { fact: 'A rival opens on 18 December.', source: 2, eventDate: '2026-12-18' },
        { fact: 'A comparable film opened in 2018.', source: 1, eventDate: null },
        { fact: 'A malformed day is ignored, not trusted.', source: 2, eventDate: 'August' },
      ],
      pages,
      '2026-10-28',
    );
    expect(out.map((s) => [s.fact, s.eventDate])).toEqual([
      ['A rival opens on 18 December.', '2026-12-18'],
      ['A comparable film opened in 2018.', null],
      ['A malformed day is ignored, not trusted.', null],
    ]);
  });

  it('numbers the kept sources w1, w2 in order', () => {
    const out = numbered(
      toSources(
        [
          { fact: 'a', source: 1 },
          { fact: 'b', source: 2 },
        ],
        pages,
      ),
    );
    expect(out.map((s) => s.id)).toEqual(['w1', 'w2']);
  });
});
