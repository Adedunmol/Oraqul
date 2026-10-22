import { podcastsPlan } from '@oraqul/packs';
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
import { formatOf, kindOf, platformsOf } from './launch-kind.js';
import type { PodcastsQueryPlan } from './planner.js';
import type { PodcastsRead } from './read.js';
import { marketRole, templateSection } from './writer.js';

const { KIND_PROFILES, PLATFORM_LABEL, SECTION_TITLES, TASTE_CLAIM } = podcastsPlan;

export const PODCASTS_RULES: CheckRules = {
  titles: SECTION_TITLES,
  tasteClaim: TASTE_CLAIM,
  // A topic is an ordinary word, so a line may use one without citing the finding.
  tagOnly: ['topics'],
  // Counts a podcast team sells in need a source like any money figure.
  figureWords: /\b\d[\d,.]*\s?(downloads?|listens?|listeners|subscribers|followers|streams)\b/i,
};

export const PODCASTS_DECISIONS: DecisionWords = {
  titles: SECTION_TITLES,
  opening: (home, others, strongest) =>
    `Lead the launch in ${home}${others.length ? `, then bring in ${list(others)} within the first weeks, so every market has a swap and a community beat` : ''}.${strongest ? ` Put the most spend and live work into ${strongest}, where your listeners are strongest.` : ''}`,
  openingAsPlanned: (cities) => `Plan ${list(cities)} as you set them.`,
  unranked: (cities) => ` Build ${list(cities)} around the swaps and community moves below.`,
  role: (verdict: Finding['verdict']) => marketRole(verdict),
  unreadCity: 'Build the launch here on community: local newsletters, swaps and the moves below.',
  comp: (c) =>
    `Pitch the show to press and listeners in the company of ${c}, a title your listeners already know.`,
};

/** A reading with nothing in it, for an answer about a plan saved before readings. */
const EMPTY_READ: PodcastsRead = {
  show: null,
  launchKind: null,
  format: null,
  style: null,
  platforms: [],
  previousShows: [],
  crossPromo: [],
  rivals: [],
  topics: [],
  hosts: [],
  guests: [],
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

function budgetSection(read: PodcastsRead): LaunchSection {
  const budget = read.budget;
  const money = (n: number) => `${budget?.currency ?? ''}${Math.round(n).toLocaleString('en-US')}`;
  const split = KIND_PROFILES[kindOf(read).kind].budget;
  return {
    key: 'budget',
    title: SECTION_TITLES.budget,
    lines: [
      codeLine(
        'budget-1',
        budget
          ? `A starting split of ${money(budget.amount)}: adjust it with your network or your team, and move money first to the markets where your listeners are strongest.`
          : 'A starting split of the marketing budget, as shares: adjust it with your network or your team, and move money first to the markets where your listeners are strongest.',
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

function gapsSection(read: PodcastsRead, comps: { used: CompUsed[] }): LaunchSection {
  // Only inputs the team could add. What could not be asked goes to the Assumptions tab instead.
  const { kind, assumed } = kindOf(read);
  const format = formatOf(read);
  const texts = [
    ...(assumed
      ? [
          `Planned as a ${KIND_PROFILES[kind].short} launch. Say if it is a new season of a show that is already out, and the calendar changes.`,
        ]
      : []),
    ...(format.assumed
      ? [
          `Planned as an ${format.format} show on ${list(platformsOf(read).map((p) => PLATFORM_LABEL[p]))}. Say if it is filmed or goes on YouTube, and the plan adds a video section.`,
        ]
      : []),
    ...(comps.used.some((c) => c.source === 'added')
      ? [
          'Name two or three comparable shows your listeners also hear, and every recommendation gets sharper.',
        ]
      : []),
    ...(read.ages.length
      ? []
      : ['Say who the show is for (an age range), and the launch can aim at them.']),
    ...(read.window
      ? []
      : ['Add a release date or window, and the launch beats turn into real dates.']),
    ...(read.places.length
      ? []
      : [
          'Name the markets you care about, and the plan ranks them instead of the usual markets for a launch like this.',
        ]),
    ...(read.topics.length
      ? []
      : [
          'Name the topics you want the show to own, and the plan shows which of them your listeners lean to more than the rival shows’ listeners.',
        ]),
    ...(read.crossPromo.length
      ? []
      : [
          'Name a show you would like to swap with, and the plan shows where it ranks with your listeners.',
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
 * The calendar for the launch kind and platforms, in code so no beat before today is advised. With
 * a release date each beat has dates; without one it has its weeks.
 */
function timelineSection(read: PodcastsRead, today: string): LaunchSection {
  const { kind } = kindOf(read);
  const beats = podcastsPlan.datedBeats(
    podcastsPlan.beatsFor(kind, platformsOf(read)),
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
          'The release date has passed, so there are no launch beats left to plan. Send the results and run an audit to see what to change.',
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

/** Beliefs only Podcasts tests here: a named swap partner suits the listeners. Topics are tested in the findings. */
function beliefs(read: PodcastsRead, text: string, grounded: Grounded): DraftItem[] {
  const shows = grounded.findings.find((f) => f.id === 'f-crosspromo');
  return read.crossPromo.map((name): DraftItem => {
    const id = `a-promo-${slug(name)}`;
    const claim = `${name} is the right show to swap with`;
    const source = sourceOf(text, name);
    const found = grounded.findings.find((f) => f.id === `f-promo-${slug(name)}`);
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
        why: 'Qloo did not score this show against others, so there was nothing to compare it with.',
        fix: null,
      };
    }
    const verdict = rankVerdict(place, of);
    const better = shows?.entities.filter((e) => !sameName(e.name, name)).slice(0, 2);
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
          : `${name} ranks ${place} of ${of} among the shows asked about for your listeners.`,
      fix:
        (verdict === 'weak' || verdict === 'breaks') && better?.length
          ? line(
              `Keep ${name}, and look at ${list(better.map((e) => e.name))} too: they rank higher with your listeners.`,
              'grounded',
              [found.id],
              [name, ...better.map((e) => e.name)],
            )
          : null,
    };
  });
}

export const podcastsLaunch: LaunchConfig<PodcastsRead, PodcastsQueryPlan> = {
  category: 'podcasts',
  catalog: Object.values(podcastsPlan.PODCASTS_QUERIES),
  anchorTypes: ['urn:entity:podcast'],
  rivalTypes: ['urn:entity:podcast'],
  genreTagPrefix: podcastsPlan.TAG_SPACES.podcastGenre.prefix,
  artistQueries: [],
  lead: (read) => read.show,
  teamAnchors: (read) => read.previousShows,
  words: {
    comps: 'shows',
    entity: 'show',
    rivalExample: '“Midnight Ledger” on 2027-03-12',
    planExample:
      'For example: “A weekly video interview podcast about football for 18 to 34, launching in London and Lagos, with a trailer swap with another sports show.”',
    artistPitch: 'a trailer swap or a guest slot',
    compsVerb: 'hears',
  },
  // Qloo has no data on guests as people, but a guest who is also an artist can be measured. One
  // that Qloo does not know as an artist comes back empty and is not claimed.
  consults: (read) =>
    read.guests.slice(0, 2).map((name) => ({
      id: `consult-guest-${slug(name)}`,
      category: 'music',
      types: ['urn:entity:artist'],
      name,
      why: `${name} is a guest, so if they are an artist, who listens to them and where shows whether their audience matches the show's.`,
    })),
  minimum: {
    id: 'podcasts.minimum',
    example:
      'For example: “A true crime podcast for Nigerians”, “a weekly football chat show on YouTube”, or “season 2 of my business interview show”.',
    // A name alone says nothing: a plan for it would be the default launch, which is the wrong
    // plan for most shows. Anything about the show will do: its subject, style or audience.
    strict: true,
    missing: (read) =>
      read.genre ||
      read.style ||
      read.platforms.length ||
      read.regions.length ||
      read.places.length ||
      read.comps.length ||
      read.previousShows.length ||
      read.crossPromo.length ||
      read.topics.length
        ? []
        : ['a line about the show: its subject, its style, or who it is for'],
  },
  pickModules: (read) =>
    podcastsPlan.pickModules({
      scope: read.scope,
      ask: read.ask,
      kind: kindOf(read).kind,
      format: formatOf(read).format,
      style: read.style,
      hasGuests: read.guests.length > 0,
      hasBudget: read.budget !== null,
    }),
  rules: PODCASTS_RULES,
  decisions: PODCASTS_DECISIONS,
  briefNames: {
    build: (read) => [
      ...read.places,
      ...read.regions,
      ...(read.show ? [read.show] : []),
      ...read.previousShows,
      ...read.crossPromo,
      ...read.rivals,
      ...read.hosts,
      ...read.guests,
      ...read.partners,
      ...read.topics,
      ...(read.country ? [read.country] : []),
    ],
    answer: (read) => [
      ...read.places,
      ...read.regions,
      ...(read.show ? [read.show] : []),
      ...read.previousShows,
      ...read.crossPromo,
      ...read.hosts,
      ...read.guests,
      ...read.partners,
    ],
  },
  codeSections: { budget: budgetSection, gaps: gapsSection, timeline: timelineSection },
  applyChange: (read, change) => ({
    ...read,
    crossPromo: [...new Set([...read.crossPromo, ...change.addCollabs])],
  }),
  templateSection,
  emptyRead: EMPTY_READ,
  ground,
  claims: (read) =>
    read.places.length +
    read.ages.length +
    read.partners.length +
    read.crossPromo.length +
    read.topics.length +
    read.platforms.length +
    read.previousShows.length +
    read.comps.length +
    (read.show ? 1 : 0) +
    (read.gender ? 1 : 0) +
    (read.window ? 1 : 0),
  beliefs,
};
