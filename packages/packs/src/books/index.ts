import { sharedQlooCoverage } from '../qloo';
import type { CategoryPack } from '../types';

export const books: CategoryPack = {
  category: 'books',
  title: 'Books',
  blurb: 'Comp titles, screen angles and bookshops, planned around the reader.',
  covers:
    'novels, non fiction, memoirs, poetry, comics and graphic novels, children’s and young adult books, audiobooks, debuts, new books in a series, reissues and self-published books',
  systemPrompt:
    'You are the books agent. Read the lead as a book, and the launch as a debut, a new book by an author with earlier books, the next book in a series, or a reissue, through a publisher or on the author’s own. Treat the book as the strongest signal when Qloo knows it, and its comparable books as the comps when it does not. The author is never a signal. The kind, the route and the readership shape the calendar: say which you assumed when the brief does not say. Call the people who read the book readers. A screen or audio angle is only as strong as the titles Qloo scored for those readers.',
  assumptionChecklist: [
    "The book's readers skew the way the plan assumes",
    'The comparable books describe one readership',
    'The comparable books are recent enough to pitch against',
    'The screen titles you compare it with share its readers',
  ],
  planSections: [
    { key: 's1', title: 'Comp titles', one: 'Comp' },
    { key: 's2', title: 'Screen and audio angles', one: 'Angle' },
    { key: 's3', title: 'Brand partners', one: 'Partner' },
    { key: 's4', title: 'Markets', one: 'Market' },
  ],
  toolAllowlist: [
    'searchEntity',
    'audienceBySegment',
    'resolveBundle',
    'rankPlaces',
    'lift',
    'partnerFit',
    'scoreRivals',
    'findTaste',
    'resolveTags',
    'themeTags',
    'bookProfiles',
  ],
  // The screen angle is answered in this agent's own pipeline, from series and films scored for the
  // readers. The generic tool loop may still ask Film one bounded question (spec §3.4).
  consults: ['film'],
  qloo: { titles: ['urn:entity:book'], ...sharedQlooCoverage },
  coverage: {
    tests: [
      "The book's readers by age and gender",
      'Which of your markets those readers are strongest in',
      'Which recent books those readers pick up, for comp titles',
      'Whether the comparable books are recent enough to pitch against',
      'Which series and films those readers also watch, for a screen angle',
      'Which bookshops and podcasts those readers go to, and which brands they use',
    ],
    thin: [
      'Debut authors, planned from comparable books and their readers',
      'Reader age and gender, read from the book where Qloo has it and from its genre where it does not',
      'Books for young children, planned around the adults who buy them',
    ],
    notSupported: [
      'Sales, pre-orders, chart positions, ratings and advances',
      'Creators, BookTok and author events, which change every season',
      'Festival dates and retailer terms',
    ],
  },
};
