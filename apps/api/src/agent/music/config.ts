import { musicPlan, rules } from '@oraqul/packs';
import type { CompUsed, Finding, LaunchLine, LaunchSection } from '@oraqul/schema';
import { testArtists } from '../launch/audit-verdicts.js';
import type { CheckRules } from '../launch/check.js';
import type { LaunchConfig } from '../launch/config.js';
import type { DecisionWords } from '../launch/decisions.js';
import { beatsSection } from '../launch/signal.js';
import { list } from '../launch/text.js';
import { ground } from './findings.js';
import type { MusicQueryPlan } from './planner.js';
import type { MusicRead } from './read.js';
import { marketRole, templateSection } from './writer.js';

const { BUDGET_CONVENTION } = musicPlan;

export const MUSIC_RULES: CheckRules = {
  titles: musicPlan.SECTION_TITLES,
  tasteClaim: musicPlan.TASTE_CLAIM,
  tagOnly: [],
};

export const MUSIC_DECISIONS: DecisionWords = {
  titles: musicPlan.SECTION_TITLES,
  opening: (home, others, strongest) =>
    `Start in ${home}${others.length ? `, then play ${list(others)} within the same few weeks, so the release has a live moment in every market` : ''}.${strongest ? ` Put the most spend and community work into ${strongest}, where your audience is strongest.` : ''}`,
  openingAsPlanned: (cities) => `Play ${list(cities)} as you planned.`,
  unranked: (cities) =>
    ` Build ${list(cities)} around the campus, creator and partner moves below.`,
  role: (verdict: Finding['verdict']) => marketRole(verdict),
  unreadCity:
    'Build the date here on community: campus shows, local creators and the partner moves below.',
  comp: (c) =>
    `Pitch the artist to press and playlists in the company of ${c}, a name you chose to be heard beside.`,
};

/** A reading with nothing in it, for an answer about a plan saved before readings. */
const EMPTY_READ: MusicRead = {
  artist: null,
  releaseType: null,
  genre: null,
  country: null,
  budget: null,
  partners: [],
  supportActs: [],
  featuredActs: [],
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

/** The calendar from the rule library, worked back from the release date. */
function timelineSection(read: MusicRead, today: string): LaunchSection {
  return beatsSection(musicPlan.SECTION_TITLES.timeline, rules.music.beats, read.window, today);
}

function budgetSection(read: MusicRead): LaunchSection {
  const budget = read.budget;
  const money = (n: number) => `${budget?.currency ?? ''}${Math.round(n).toLocaleString('en-US')}`;
  return {
    key: 'budget',
    title: musicPlan.SECTION_TITLES.budget,
    lines: [
      codeLine(
        'budget-1',
        budget
          ? `A starting split of ${money(budget.amount)}: adjust it with your label or booking agent, and move money first to the cities with the strongest ticket sales.`
          : 'A starting split of the marketing budget, as shares: adjust it with your label or booking agent, and move money first to the cities with the strongest ticket sales.',
      ),
      ...BUDGET_CONVENTION.map((c, i) =>
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

function gapsSection(read: MusicRead, comps: { used: CompUsed[] }): LaunchSection {
  // Only inputs the team could add. What could not be asked goes to the Assumptions tab instead.
  const texts = [
    ...(comps.used.some((c) => c.source !== 'you')
      ? [
          'I chose the sound-alike artists from what you wrote. Name your own, or say more about the sound and who it features, and I will rebuild the plan around them.',
        ]
      : []),
    ...(read.ages.length
      ? []
      : ['Say who the music is for (an age range), and the campaign can aim at them.']),
    ...(read.window
      ? []
      : ['Add a release date or tour window, and the timeline turns into real dates.']),
    ...(read.releaseType
      ? []
      : ['Say whether this is a single, an EP, an album or a tour, and the plan firms up.']),
    ...(read.budget ? [] : ['Add a marketing budget, and the split turns into amounts.']),
  ];
  return {
    key: 'gaps',
    title: musicPlan.SECTION_TITLES.gaps,
    lines: texts.map((text, i) => codeLine(`gaps-${i + 1}`, text)),
  };
}

export const musicLaunch: LaunchConfig<MusicRead, MusicQueryPlan> = {
  category: 'music',
  catalog: Object.values(musicPlan.MUSIC_QUERIES),
  anchorTypes: ['urn:entity:artist'],
  rivalTypes: ['urn:entity:artist'],
  genreTagPrefix: musicPlan.TAG_SPACES.support.prefix,
  artistQueries: ['support'],
  lead: (read) => read.artist,
  teamAnchors: (read) => read.featuredActs,
  words: {
    comps: 'artists',
    entity: 'artist',
    rivalExample: '“Rema” on 2026-12-05',
    planExample:
      'For example: “A folk album tour for 25 to 34, playing Manchester, Dublin and Berlin, with a regional brewery as a partner.”',
    artistPitch: 'a support slot or a collaboration',
  },
  minimum: {
    id: 'music.minimum',
    example:
      'For example: “An indie folk album from Manchester, with shows in Manchester and Dublin.”',
    missing: (read) => (read.places.length ? [] : ['at least one city they play']),
  },
  /** Whether the person's words say anything about the work beyond its title. */
  described: (read) => read.artist !== null,
  pickModules: (read) =>
    musicPlan.pickModules({
      scope: read.scope,
      ask: read.ask,
      releaseType: read.releaseType,
      cities: read.places.length,
      hasBudget: read.budget !== null,
    }),
  rules: MUSIC_RULES,
  decisions: MUSIC_DECISIONS,
  briefNames: {
    build: (read) => [
      ...read.places,
      ...(read.artist ? [read.artist] : []),
      ...read.supportActs,
      ...read.featuredActs,
      ...read.partners,
      ...(read.country ? [read.country] : []),
    ],
    answer: (read) => [
      ...read.places,
      ...(read.artist ? [read.artist] : []),
      ...read.partners,
      ...read.supportActs,
      ...read.featuredActs,
    ],
  },
  codeSections: { budget: budgetSection, gaps: gapsSection, timeline: timelineSection },
  templateSection,
  emptyRead: EMPTY_READ,
  ground,
  claims: (read) =>
    read.places.length +
    read.ages.length +
    read.partners.length +
    read.supportActs.length +
    read.featuredActs.length +
    read.comps.length +
    (read.artist ? 1 : 0) +
    (read.gender ? 1 : 0) +
    (read.window ? 1 : 0),
  beliefs: (read, text, grounded) =>
    testArtists(
      [...read.supportActs, ...read.featuredActs],
      ['support'],
      grounded,
      text,
      'your artist’s audience',
    ),
};
