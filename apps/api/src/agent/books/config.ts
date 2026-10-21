import { booksPlan } from '@oraqul/packs';
import type { CompUsed, Finding, LaunchLine, LaunchSection } from '@oraqul/schema';
import {
  asConfidence,
  type DraftItem,
  line,
  rankVerdict,
  sameName,
  sourceOf,
} from '../launch/audit-verdicts.js';
import { slug } from '../launch/brief.js';
import type { CheckRules } from '../launch/check.js';
import type { LaunchConfig } from '../launch/config.js';
import type { DecisionWords } from '../launch/decisions.js';
import type { Grounded } from '../launch/findings.js';
import { list, releaseDate } from '../launch/text.js';
import { ground } from './findings.js';
import { beatTagsOf, hasAudio, kindOf, readershipOf, routeOf } from './launch-kind.js';
import type { BooksQueryPlan } from './planner.js';
import type { BooksRead } from './read.js';
import { marketRole, templateSection } from './writer.js';

const { KIND_PROFILES, SECTION_TITLES, TASTE_CLAIM } = booksPlan;

export const BOOKS_RULES: CheckRules = {
  titles: SECTION_TITLES,
  tasteClaim: TASTE_CLAIM,
  // A theme is an ordinary word, so a line may use one without citing the finding.
  tagOnly: ['themes'],
  // Counts a book team sells in need a source like any money figure.
  figureWords:
    /\b\d[\d,.]*\s?(copies|pre-?orders?|sales|units|reviews|ratings|bestsellers?|downloads|listens)\b/i,
};

export const BOOKS_DECISIONS: DecisionWords = {
  titles: SECTION_TITLES,
  opening: (home, others, strongest) =>
    `Launch the book in ${home}${others.length ? `, then bring in ${list(others)} within the first weeks, so every market has an event and a bookshop beat` : ''}.${strongest ? ` Put the most spend and events into ${strongest}, where your readers are strongest.` : ''}`,
  openingAsPlanned: (cities) => `Plan ${list(cities)} as you set them.`,
  unranked: (cities) => ` Build ${list(cities)} around bookshop events and the moves below.`,
  role: (verdict: Finding['verdict']) => marketRole(verdict),
  unreadCity:
    'Build the launch here on bookshops and book clubs: events, signings and the moves below.',
  comp: (c) =>
    `Pitch the book to booksellers, press and readers in the company of ${c}, a book your readers already know.`,
};

/** A reading with nothing in it, for an answer about a plan saved before readings. */
const EMPTY_READ: BooksRead = {
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
  suggestedComps: [],
};

const codeLine = (id: string, text: string): LaunchLine => ({
  id,
  kind: 'playbook',
  text,
  findingIds: [],
  sourceIds: [],
  names: [],
  group: null,
});

function budgetSection(read: BooksRead): LaunchSection {
  const budget = read.budget;
  const money = (n: number) => `${budget?.currency ?? ''}${Math.round(n).toLocaleString('en-US')}`;
  const split = KIND_PROFILES[kindOf(read).kind].budget[routeOf(read).route];
  return {
    key: 'budget',
    title: SECTION_TITLES.budget,
    lines: [
      codeLine(
        'budget-1',
        budget
          ? `A starting split of ${money(budget.amount)}: adjust it with your publisher or your team, and move money first to the markets where your readers are strongest.`
          : 'A starting split of the marketing budget, as shares: adjust it with your publisher or your team, and move money first to the markets where your readers are strongest.',
      ),
      ...split.map((c, i) =>
        codeLine(
          `budget-${i + 2}`,
          budget
            ? `${c.line}: ${Math.round(c.share * 100)}%, ${money(budget.amount * c.share)}.`
            : `${c.line}: ${Math.round(c.share * 100)}%.`,
        ),
      ),
    ],
  };
}

function gapsSection(read: BooksRead, comps: { used: CompUsed[] }): LaunchSection {
  // Only inputs the team could add. What could not be asked goes to the Assumptions tab instead.
  const { kind, assumed } = kindOf(read);
  const route = routeOf(read);
  const readership = readershipOf(read);
  const texts = [
    ...(assumed
      ? [
          `Planned as a ${KIND_PROFILES[kind].short} launch. Say if it is something else, such as a reissue or the next book in a series, and the calendar changes.`,
        ]
      : []),
    ...(route.assumed
      ? [
          'Planned for a book a publisher sells to shops. Say if you are self-publishing, and the plan swaps the retail sell-in for ads, newsletters and your own listings.',
        ]
      : []),
    ...(readership.assumed
      ? [
          'Planned for adult readers. Say if it is young adult or for children, and the plan adds schools, libraries and the people who buy for them.',
        ]
      : []),
    ...(hasAudio(read)
      ? []
      : ['Say if there is an audiobook, and the plan adds an audiobook section.']),
    ...(comps.used.some((c) => c.source === 'added')
      ? [
          'Name two or three comparable books your readers also read, and every recommendation gets sharper.',
        ]
      : []),
    ...(read.ages.length
      ? []
      : ['Say who the book is for (an age range), and the launch can aim at them.']),
    ...(read.window
      ? []
      : ['Add a publication date or window, and the launch beats turn into real dates.']),
    ...(read.places.length
      ? []
      : [
          'Name the markets you care about, and the plan ranks them instead of the usual markets for a launch like this.',
        ]),
    ...(read.screenTitles.length
      ? []
      : [
          'Name a series or a film you would like the book compared with, and the plan shows where it ranks with your readers.',
        ]),
    ...(read.budget ? [] : ['Add a marketing budget, and the split turns into amounts.']),
  ];
  return {
    key: 'gaps',
    title: SECTION_TITLES.gaps,
    lines: texts.map((text, i) => codeLine(`gaps-${i + 1}`, text)),
  };
}

const weeks = (at: number) => (at === 0 ? 'Launch week' : `T${at < 0 ? '-' : '+'}${Math.abs(at)}`);

/**
 * The calendar for the launch kind, route, readership and formats, in code so no beat before today
 * is advised. With a publication date each beat has dates; without one it has its weeks.
 */
function timelineSection(read: BooksRead, today: string): LaunchSection {
  const { kind } = kindOf(read);
  const beats = booksPlan.datedBeats(
    booksPlan.beatsFor(kind, beatTagsOf(read)),
    releaseDate(read.window),
    today,
  );
  if (beats.length === 0) {
    return {
      key: 'timeline',
      title: SECTION_TITLES.timeline,
      lines: [
        codeLine(
          'timeline-passed',
          'The publication date has passed, so there are no launch beats left to plan. Send the results and run an audit to see what to change.',
        ),
      ],
    };
  }
  const lines = beats.map((b) => {
    const when = b.until === undefined ? weeks(b.at) : `${weeks(b.at)} to ${weeks(b.until)}`;
    const dates =
      b.from && b.to ? (b.from === b.to ? ` (${b.from})` : ` (${b.from} to ${b.to})`) : '';
    return codeLine(`timeline-${b.key}`, `${when}${dates}: ${b.text}`);
  });
  return { key: 'timeline', title: SECTION_TITLES.timeline, lines };
}

/**
 * Beliefs only Books tests here: a named screen title suits the readers, and a named bookshop is
 * one of the bookshops these readers go to. Comp recency is tested in the findings.
 */
function beliefs(read: BooksRead, text: string, grounded: Grounded): DraftItem[] {
  const screens = read.screenTitles.map((name): DraftItem => {
    const id = `a-screen-${slug(name)}`;
    const claim = `${name} is the right screen comparison`;
    const source = sourceOf(text, name);
    const found = grounded.findings.find((f) => f.id === `f-screen-${slug(name)}`);
    const place = found?.numbers.place;
    const of = found?.numbers.of;
    if (!found || place === undefined || of === undefined) {
      return {
        id,
        subject: 'media',
        claim,
        source,
        unstated: false,
        verdict: 'cant',
        confidence: 'lower',
        findingIds: [],
        why: 'Qloo did not score this title against others for these readers, so there was nothing to compare it with.',
        fix: null,
      };
    }
    const verdict = rankVerdict(place, of);
    const medium = found.entities[0]?.detail === 'Film' ? 'Film' : 'Series';
    const bridge = grounded.findings.find((f) => f.id === `f-bridge-${medium.toLowerCase()}`);
    const better = bridge?.entities.filter((e) => !sameName(e.name, name)).slice(0, 2);
    return {
      id,
      subject: 'media',
      claim,
      source,
      unstated: false,
      verdict,
      confidence: verdict === 'cant' ? 'lower' : asConfidence(found.confidence),
      findingIds: [found.id],
      why:
        verdict === 'cant'
          ? `Only ${of} were ranked, too few to say where ${name} stands.`
          : `${name} ranks ${place} of ${of} among the ${medium === 'Film' ? 'films' : 'series'} asked about for your readers.`,
      fix:
        (verdict === 'weak' || verdict === 'breaks') && bridge && better?.length
          ? line(
              `Keep ${name} as a comparison, and look at ${list(better.map((e) => e.name))} too: they rank higher with your readers.`,
              'grounded',
              [bridge.id],
              [name, ...better.map((e) => e.name)],
            )
          : null,
    };
  });

  const shops = grounded.findings.filter((f) => f.query === 'bookshops');
  const named = read.bookshops.map((name): DraftItem => {
    const id = `a-shop-${slug(name)}`;
    const claim = `${name} is a bookshop your readers go to`;
    const source = sourceOf(text, name);
    const hit = shops
      .map((f) => ({ f, at: f.entities.findIndex((e) => sameName(e.name, name)) }))
      .find((h) => h.at !== -1);
    if (!hit) {
      return {
        id,
        subject: 'other',
        claim,
        source,
        unstated: false,
        verdict: 'cant',
        confidence: 'lower',
        findingIds: [],
        why: 'This bookshop is not among the ones Qloo ranked for these readers, which is not a test of the bookshop.',
        fix: null,
      };
    }
    const position = hit.at + 1;
    const verdict = position <= 3 ? 'holds' : 'weak';
    const better = hit.f.entities.filter((e) => !sameName(e.name, name)).slice(0, 2);
    return {
      id,
      subject: 'other',
      claim,
      source,
      unstated: false,
      verdict,
      confidence: asConfidence(hit.f.confidence),
      findingIds: [hit.f.id],
      why: `${name} ranks ${position} among the bookshops your readers go to${hit.f.context.city ? ` in ${hit.f.context.city}` : ''}.`,
      fix:
        verdict === 'weak' && better.length
          ? line(
              `Keep ${name}, and look at ${list(better.map((e) => e.name))} first: they rank higher with your readers.`,
              'grounded',
              [hit.f.id],
              [name, ...better.map((e) => e.name)],
            )
          : null,
    };
  });
  return [...screens, ...named];
}

export const booksLaunch: LaunchConfig<BooksRead, BooksQueryPlan> = {
  category: 'books',
  anchorTypes: ['urn:entity:book'],
  rivalTypes: ['urn:entity:book'],
  genreTagPrefix: booksPlan.TAG_SPACES.bookGenre.prefix,
  artistQueries: [],
  lead: (read) => read.book,
  teamAnchors: (read) => read.previousBooks,
  words: {
    comps: 'books',
    entity: 'book',
    rivalExample: '“The Night Ledger” on 2027-03-12',
    planExample:
      'For example: “A debut literary novel by a Nigerian author, published by an independent press in London and Lagos in March, with an audiobook and a hope of a series adaptation.”',
    artistPitch: 'a blurb or an event together',
    compsVerb: 'reads',
  },
  minimum: {
    id: 'books.minimum',
    example:
      'For example: “A Nigerian literary debut for readers of Americanah”, “a romantasy for 18 to 34 on Kindle”, or “the paperback reissue of my memoir”.',
    // A title alone says nothing: a plan for it would be the default launch, which is the wrong
    // plan for most books. Anything about the book will do: its genre, readers or kind.
    strict: true,
    missing: (read) =>
      read.genre ||
      read.readership ||
      read.regions.length ||
      read.places.length ||
      read.comps.length ||
      read.previousBooks.length ||
      read.screenTitles.length
        ? []
        : ['a line about the book: its genre, who it is for, or what kind of launch it is'],
  },
  pickModules: (read) =>
    booksPlan.pickModules({
      scope: read.scope,
      ask: read.ask,
      kind: kindOf(read).kind,
      route: routeOf(read).route,
      readership: readershipOf(read).readership,
      audio: hasAudio(read),
      hasBudget: read.budget !== null,
    }),
  rules: BOOKS_RULES,
  decisions: BOOKS_DECISIONS,
  briefNames: {
    build: (read) => [
      ...read.places,
      ...read.regions,
      ...(read.book ? [read.book] : []),
      ...(read.author ? [read.author] : []),
      ...read.previousBooks,
      ...read.screenTitles,
      ...read.bookshops,
      ...read.partners,
      ...(read.country ? [read.country] : []),
    ],
    answer: (read) => [
      ...read.places,
      ...read.regions,
      ...(read.book ? [read.book] : []),
      ...(read.author ? [read.author] : []),
      ...read.previousBooks,
      ...read.screenTitles,
      ...read.bookshops,
      ...read.partners,
    ],
  },
  codeSections: { budget: budgetSection, gaps: gapsSection, timeline: timelineSection },
  // A screen title the person adds is one more to score for the bridge.
  applyChange: (read, change) => ({
    ...read,
    screenTitles: [...new Set([...read.screenTitles, ...change.addCollabs])],
  }),
  templateSection,
  emptyRead: EMPTY_READ,
  ground,
  claims: (read) =>
    read.places.length +
    read.ages.length +
    read.partners.length +
    read.screenTitles.length +
    read.bookshops.length +
    read.previousBooks.length +
    read.comps.length +
    (read.book ? 1 : 0) +
    (read.gender ? 1 : 0) +
    (read.window ? 1 : 0),
  beliefs,
};
