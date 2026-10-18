import { musicPlan } from '@oraqul/packs';
import type { CompUsed, Finding, LaunchLine, LaunchSection } from '@oraqul/schema';
import { testArtists } from '../launch/audit-verdicts.js';
import type { CheckRules } from '../launch/check.js';
import type { LaunchConfig } from '../launch/config.js';
import type { DecisionWords } from '../launch/decisions.js';
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
    `Pitch the artist to press and playlists in the company of ${c}, a name your audience already knows.`,
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
    ...(comps.used.some((c) => c.source === 'added')
      ? [
          'Name two or three artists your audience also plays, and every recommendation gets sharper.',
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
  anchorTypes: ['urn:entity:artist'],
  rivalTypes: ['urn:entity:artist'],
  genreTagPrefix: musicPlan.TAG_SPACES.support.prefix,
  artistQueries: ['support'],
  lead: (read) => read.artist,
  words: {
    comps: 'artists',
    entity: 'artist',
    rivalExample: '“Rema” on 2026-12-05',
    planExample:
      'For example: “An afrobeats album tour for 25 to 34, playing Lagos, London and Accra, with MTN as a partner.”',
    artistPitch: 'a support slot or a collaboration',
  },
  minimum: {
    id: 'music.minimum',
    example: 'For example: “An afrobeats album from Lagos, with shows in Lagos and London.”',
    missing: (read) =>
      [
        read.artist || read.genre ? null : 'who the artist is and what they are releasing',
        read.places.length ? null : 'at least one city they play',
      ].filter((m): m is string => m !== null),
  },
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
      ...read.partners,
      ...(read.country ? [read.country] : []),
    ],
    answer: (read) => [
      ...read.places,
      ...(read.artist ? [read.artist] : []),
      ...read.partners,
      ...read.supportActs,
    ],
  },
  codeSections: { budget: budgetSection, gaps: gapsSection },
  templateSection,
  emptyRead: EMPTY_READ,
  ground,
  claims: (read) =>
    read.places.length +
    read.ages.length +
    read.partners.length +
    read.supportActs.length +
    read.comps.length +
    (read.artist ? 1 : 0) +
    (read.gender ? 1 : 0) +
    (read.window ? 1 : 0),
  beliefs: (read, text, grounded) =>
    testArtists(read.supportActs, ['support'], grounded, text, 'your artist’s audience'),
};
