import { type BooksReading, checkReading } from './read.js';

const empty: BooksReading = {
  book: null,
  author: null,
  launchKind: null,
  route: null,
  readership: null,
  formats: [],
  previousBooks: [],
  screenTitles: [],
  bookshops: [],
  regions: [],
  audienceNote: null,
  genre: null,
  country: null,
  budget: null,
  partners: [],
  scope: 'full',
  ask: null,
  comps: [],
  places: [],
  window: null,
  ages: [],
  gender: null,
};

const input = (text: string) => ({ title: 'The Lagos Ledger', text });

describe('Books reading', () => {
  it('keeps a publisher’s route when a model reads an independent press as self-published', () => {
    const text = 'A debut novel from an independent press.';
    const read = checkReading(
      { ...empty, route: { value: 'indie', quote: 'independent press' } },
      input(text),
    );
    expect(read.route).toBe('traditional');
  });

  it('takes the model’s route only when its own words say it', () => {
    const text = 'I will put it out myself on Kindle.';
    expect(
      checkReading({ ...empty, route: { value: 'indie', quote: 'put it out myself' } }, input(text))
        .route,
    ).toBeNull();
    expect(checkReading(empty, input('I am self-publishing it on KDP.')).route).toBe('indie');
  });

  it('drops a value whose quote is not in the person’s words', () => {
    const read = checkReading(
      {
        ...empty,
        book: { value: 'The Lagos Ledger', quote: 'The Lagos Ledger' },
        author: { value: 'Ada Obi', quote: 'by Ada Obi' },
        launchKind: { value: 'series', quote: 'book three' },
      },
      input('The Lagos Ledger is a literary novel.'),
    );
    expect(read.book).toBe('The Lagos Ledger');
    expect(read.author).toBeNull();
    expect(read.launchKind).toBeNull();
  });

  it('keeps a screen title and an earlier book apart from the comps', () => {
    const read = checkReading(
      {
        ...empty,
        screenTitles: [{ value: 'Normal People', quote: 'Normal People' }],
        previousBooks: [{ value: 'Dust and Ink', quote: 'Dust and Ink' }],
        comps: [{ value: 'Americanah', quote: 'Americanah' }],
      },
      input('Like Normal People, after Dust and Ink, for readers of Americanah.'),
    );
    expect(read.comps).toEqual(['Americanah']);
    expect(read.screenTitles).toEqual(['Normal People']);
    expect(read.previousBooks).toEqual(['Dust and Ink']);
  });
});
