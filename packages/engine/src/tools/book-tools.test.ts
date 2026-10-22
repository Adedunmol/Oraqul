import { describe, expect, it } from 'vitest';
import { demoFetch, QlooClient } from '../qloo';
import { bookProfilesOutputSchema, seriesOf } from './book-profiles';
import { findTasteOutputSchema, resolveBundleOutputSchema, tools } from './index';
import { normalizeTitle, sameTitle } from './resolve-bundle';

function demoContext() {
  const qloo = new QlooClient({
    baseUrl: 'https://demo.invalid',
    apiKey: 'demo',
    fetch: demoFetch,
  });
  return { qloo, source: 'demo' as const, entities: new Map() };
}

describe('seriesOf', () => {
  it('reads the series from the mark Qloo adds to a title', () => {
    expect(seriesOf('Fourth Wing (The Empyrean, #1)')).toBe('The Empyrean');
    expect(seriesOf('Iron Flame (The Empyrean, #2)')).toBe('The Empyrean');
    expect(seriesOf('Dune (Dune #1)')).toBe('Dune');
  });

  it('has no series for a title without the mark', () => {
    expect(seriesOf('Wonder')).toBeNull();
    expect(seriesOf('Half of a Yellow Sun')).toBeNull();
  });
});

describe('normalizeTitle for books', () => {
  it('ignores the series mark and the HTML ampersand Qloo adds', () => {
    expect(sameTitle('Fourth Wing', 'Fourth Wing (The Empyrean, #1)')).toBe(true);
    expect(normalizeTitle('Atomic Habits: Build &amp; Break')).toBe('atomic habits: build & break');
  });

  it('keeps a title that only looks like a series mark', () => {
    expect(sameTitle('Catch-22 (Heller)', 'Catch-22')).toBe(false);
  });
});

describe('resolveBundle on books', () => {
  it('finds a book written without its series by its exact name', async () => {
    const { data } = await tools.resolveBundle.run(demoContext(), {
      names: ['Things Fall Apart', 'Zanzibar Quill Orchard'],
      types: ['urn:entity:book'],
    });
    const [found, missing] = resolveBundleOutputSchema.parse(data).anchors;
    expect(found).toMatchObject({ status: 'found', entityId: 'DEMO-BOOK-0204' });
    expect(missing?.status).toBe('not_found');
  });
});

describe('findTaste on books', () => {
  it('lists the books a book audience reads, filtered by genre and publication year', async () => {
    const ctx = demoContext();
    const { data: anchors } = await tools.resolveBundle.run(ctx, {
      names: ['Americanah', 'Purple Hibiscus'],
      types: ['urn:entity:book'],
    });
    const entityIds = resolveBundleOutputSchema.parse(anchors).entityIds;
    const { data } = await tools.findTaste.run(ctx, {
      entityIds,
      type: 'urn:entity:book',
      tags: ['urn:tag:genre:media:literary_fiction'],
      yearFrom: 2020,
      exclude: [],
    });
    const names = findTasteOutputSchema.parse(data).candidates.map((c) => c.name);
    expect(names).toContain('Salt Season');
    expect(names).not.toContain('Nervous Conditions');
    expect(names).not.toContain('Iron Flame (The Empyrean, #2)');
  });

  it('keeps the books of one signal out of another category’s lists', async () => {
    const ctx = demoContext();
    const { data } = await tools.findTaste.run(ctx, {
      entityIds: ['DEMO-FILM-0001'],
      type: 'urn:entity:movie',
      tags: [],
      city: 'Lagos',
      exclude: [],
    });
    expect(findTasteOutputSchema.parse(data).candidates.map((c) => c.name)).not.toContain(
      'Where the Crawdads Sing',
    );
  });
});

describe('bookProfiles', () => {
  it('returns each book’s publication year and series from one lookup', async () => {
    const result = await tools.bookProfiles.run(demoContext(), {
      entityIds: ['DEMO-BOOK-0210', 'DEMO-BOOK-0202'],
    });
    const books = bookProfilesOutputSchema.parse(result.data).books;
    expect(books.map((b) => [b.name, b.publicationYear, b.series])).toEqual([
      ['Half of a Yellow Sun', 2006, null],
      ['Fourth Wing (The Empyrean, #1)', 2023, 'The Empyrean'],
    ]);
    expect(result.receipts).toHaveLength(1);
  });
});

describe('scoreRivals on books', () => {
  it('scores books as rivals in one call', async () => {
    const result = await tools.scoreRivals.run(demoContext(), {
      entityIds: ['DEMO-BOOK-0201'],
      type: 'urn:entity:book',
      rivals: ['DEMO-BOOK-0301', 'DEMO-BOOK-0302', 'DEMO-BOOK-0303'],
      leaveOneOut: false,
    });
    expect(result.receipts).toHaveLength(1);
  });
});
