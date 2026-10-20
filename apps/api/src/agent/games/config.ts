import { gamesPlan } from '@oraqul/packs';
import type { CompUsed, Finding, LaunchLine, LaunchSection } from '@oraqul/schema';
import {
  asConfidence,
  type DraftItem,
  line,
  rankVerdict,
  sameName,
  sourceOf,
  testArtists,
} from '../launch/audit-verdicts.js';
import { slug } from '../launch/brief.js';
import type { CheckRules } from '../launch/check.js';
import type { LaunchConfig } from '../launch/config.js';
import type { DecisionWords } from '../launch/decisions.js';
import type { Grounded } from '../launch/findings.js';
import { list, releaseDate } from '../launch/text.js';
import { ground } from './findings.js';
import { kindOf, platformsOf } from './launch-kind.js';
import type { GamesQueryPlan } from './planner.js';
import type { GamesRead } from './read.js';
import { marketRole, templateSection } from './writer.js';

const { KIND_PROFILES, PLATFORM_LABEL, SECTION_TITLES, TASTE_CLAIM } = gamesPlan;

export const GAMES_RULES: CheckRules = {
  titles: SECTION_TITLES,
  tasteClaim: TASTE_CLAIM,
  // A tag or a platform is an ordinary word, so a line may use one without citing the finding.
  tagOnly: ['profile', 'tags'],
  // Counts a games team sells in need a source like any money figure.
  figureWords: /\b\d[\d,.]*\s?(wishlists?|installs?|downloads?|players|copies|dau|mau|ccu)\b/i,
};

export const GAMES_DECISIONS: DecisionWords = {
  titles: SECTION_TITLES,
  opening: (home, others, strongest) =>
    `Lead the launch in ${home}${others.length ? `, then bring in ${list(others)} within the first weeks, so every region has a creator and community beat` : ''}.${strongest ? ` Put the most spend and community work into ${strongest}, where your players are strongest.` : ''}`,
  openingAsPlanned: (cities) => `Plan ${list(cities)} as you set them.`,
  unranked: (cities) =>
    ` Build ${list(cities)} around the creator, community and partner moves below.`,
  role: (verdict: Finding['verdict']) => marketRole(verdict),
  unreadCity:
    'Build the launch here on community: local creators, a Discord and the partner moves below.',
  comp: (c) =>
    `Pitch the game to press and creators in the company of ${c}, a title your players already know.`,
};

/** A reading with nothing in it, for an answer about a plan saved before readings. */
const EMPTY_READ: GamesRead = {
  game: null,
  launchKind: null,
  platforms: [],
  franchise: [],
  collabs: [],
  storeTags: [],
  regions: [],
  creators: [],
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

function budgetSection(read: GamesRead): LaunchSection {
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
          ? `A starting split of ${money(budget.amount)}: adjust it with your publisher or your team, and move money first to the regions where your players are strongest.`
          : 'A starting split of the marketing budget, as shares: adjust it with your publisher or your team, and move money first to the regions where your players are strongest.',
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

function gapsSection(read: GamesRead, comps: { used: CompUsed[] }): LaunchSection {
  // Only inputs the team could add. What could not be asked goes to the Assumptions tab instead.
  const { kind, assumed } = kindOf(read);
  const texts = [
    ...(assumed
      ? [
          `Planned as a ${KIND_PROFILES[kind].short} launch on ${list(platformsOf(read).map((p) => PLATFORM_LABEL[p]))}. Say if it is early access, free to play or mobile, and the calendar changes.`,
        ]
      : read.platforms.length
        ? []
        : [
            `Say which platforms you ship on. Until then the plan assumes ${list(platformsOf(read).map((p) => PLATFORM_LABEL[p]))}.`,
          ]),
    ...(comps.used.some((c) => c.source === 'added')
      ? [
          'Name two or three comparable games your players also play, and every recommendation gets sharper.',
        ]
      : []),
    ...(read.ages.length
      ? []
      : ['Say who the game is for (an age range), and the campaign can aim at them.']),
    ...(read.window
      ? []
      : ['Add a release date or window, and the launch beats turn into real dates.']),
    ...(read.places.length
      ? []
      : [
          'Name the regions you care about, and the plan ranks them instead of the usual markets for this kind of launch.',
        ]),
    ...(read.collabs.length
      ? []
      : [
          'Name a collab (an artist, a series, a brand, a podcast or another game), and the plan shows where it ranks with your players.',
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
function timelineSection(read: GamesRead, today: string): LaunchSection {
  const { kind } = kindOf(read);
  const beats = gamesPlan.datedBeats(
    gamesPlan.beatsFor(kind, platformsOf(read)),
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

/** Beliefs only Games tests: a named collab suits the players, and the creators it names. */
function beliefs(read: GamesRead, text: string, grounded: Grounded): DraftItem[] {
  const fanFindings = grounded.findings.filter(
    (f) => f.query === 'fanbase' && !f.id.startsWith('f-fan-collab-'),
  );
  const collabItems = read.collabs.map((name): DraftItem => {
    const id = `a-collab-${slug(name)}`;
    const claim = `${name} is the right collab for this launch`;
    const source = sourceOf(text, name);
    const found = grounded.findings.find((f) => f.id === `f-fan-collab-${slug(name)}`);
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
        why: 'Qloo did not score this collab against others, so there was nothing to compare it with.',
        fix: null,
      };
    }
    const verdict = rankVerdict(place, of);
    const better = fanFindings
      .find((f) => f.entities.some((e) => sameName(e.name, name)))
      ?.entities.filter((e) => !sameName(e.name, name))
      .slice(0, 2);
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
          : `${name} ranks ${place} of ${of} among the ones asked about for your players.`,
      fix:
        (verdict === 'weak' || verdict === 'breaks') && better?.length
          ? line(
              `Keep ${name}, and look at ${list(better.map((e) => e.name))} too: they rank higher with your players.`,
              'grounded',
              [found.id],
              [name, ...better.map((e) => e.name)],
            )
          : null,
    };
  });

  const creators = testArtists(
    read.creators,
    ['creators'],
    grounded,
    text,
    "your game's players",
  ).map((item) => ({
    ...item,
    claim: `${item.claim.replace(' suits the audience', '')} suits your players`,
  }));
  return [...collabItems, ...creators];
}

export const gamesLaunch: LaunchConfig<GamesRead, GamesQueryPlan> = {
  category: 'games',
  anchorTypes: ['urn:entity:videogame'],
  rivalTypes: ['urn:entity:videogame'],
  genreTagPrefix: gamesPlan.TAG_SPACES.gameGenre.prefix,
  artistQueries: [],
  lead: (read) => read.game,
  teamAnchors: (read) => read.franchise,
  words: {
    comps: 'games',
    entity: 'game',
    rivalExample: '“Hollow Knight: Silksong” on 2027-03-12',
    planExample:
      'For example: “A roguelike on Steam and Switch for 18 to 34, launching in Europe and Southeast Asia, with a collab with an anime studio.”',
    artistPitch: 'a collab or a sponsored stream',
    compsVerb: 'plays',
  },
  minimum: {
    id: 'games.minimum',
    example:
      'For example: “A Nigerian mobile shooter”, “a cozy farming game for Switch”, or “a roguelike for Steam”.',
    // A name alone says nothing: a plan for it would be the default launch, which is the wrong
    // plan for most games. Anything about the game will do: its kind, platform or audience.
    strict: true,
    missing: (read) =>
      read.genre ||
      read.launchKind ||
      read.platforms.length ||
      read.regions.length ||
      read.places.length ||
      read.comps.length ||
      read.franchise.length ||
      read.collabs.length
        ? []
        : ['a line about the game: what kind it is, the platform, or who it is for'],
  },
  pickModules: (read) =>
    gamesPlan.pickModules({
      scope: read.scope,
      ask: read.ask,
      kind: kindOf(read).kind,
      platforms: platformsOf(read),
      hasBudget: read.budget !== null,
    }),
  rules: GAMES_RULES,
  decisions: GAMES_DECISIONS,
  briefNames: {
    build: (read) => [
      ...read.places,
      ...read.regions,
      ...(read.game ? [read.game] : []),
      ...read.franchise,
      ...read.collabs,
      ...read.creators,
      ...read.partners,
      ...read.storeTags,
      ...(read.country ? [read.country] : []),
    ],
    answer: (read) => [
      ...read.places,
      ...read.regions,
      ...(read.game ? [read.game] : []),
      ...read.franchise,
      ...read.collabs,
      ...read.creators,
      ...read.partners,
    ],
  },
  codeSections: { budget: budgetSection, gaps: gapsSection, timeline: timelineSection },
  applyChange: (read, change) => ({
    ...read,
    collabs: [...new Set([...read.collabs, ...change.addCollabs])],
  }),
  templateSection,
  emptyRead: EMPTY_READ,
  ground,
  claims: (read) =>
    read.places.length +
    read.ages.length +
    read.partners.length +
    read.collabs.length +
    read.creators.length +
    read.storeTags.length +
    read.platforms.length +
    read.franchise.length +
    read.comps.length +
    (read.game ? 1 : 0) +
    (read.gender ? 1 : 0) +
    (read.window ? 1 : 0),
  beliefs,
};
