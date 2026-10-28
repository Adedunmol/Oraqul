import { filmPlan, rules } from '@oraqul/packs';
import type { CompUsed, LaunchLine, LaunchSection } from '@oraqul/schema';
import { slug } from '../launch/brief.js';
import type { LaunchConfig } from '../launch/config.js';
import { beatsSection } from '../launch/signal.js';
import { filmBeliefs } from './audit-verdicts.js';
import { FILM_RULES } from './check.js';
import { FILM_DECISIONS } from './decisions.js';
import { ground } from './findings.js';
import type { QueryPlan } from './planner.js';
import type { FilmRead } from './read.js';
import { templateSection } from './writer.js';

const { BUDGET_CONVENTION } = filmPlan;

/** A reading with nothing in it, for an answer about a plan saved before readings. */
const EMPTY_READ: FilmRead = {
  format: null,
  genre: null,
  comps: [],
  places: [],
  window: null,
  ages: [],
  gender: null,
  rating: null,
  suggestedComps: [],
  logline: null,
  country: null,
  language: null,
  cast: [],
  director: null,
  soundtrack: [],
  route: null,
  budget: null,
  partners: [],
  scope: 'full',
  ask: null,
};

/** The calendar from the rule library, worked back from the release date. */
function timelineSection(read: FilmRead, today: string): LaunchSection {
  return beatsSection(filmPlan.SECTION_TITLES.timeline, rules.film.beats, read.window, today);
}

function budgetSection(read: FilmRead): LaunchSection {
  const budget = read.budget;
  const money = (n: number) => `${budget?.currency ?? ''}${Math.round(n).toLocaleString('en-US')}`;
  const line = (id: string, text: string): LaunchLine => ({
    id,
    kind: 'playbook',
    text,
    findingIds: [],
    sourceIds: [],
    names: [],
    group: null,
  });
  return {
    key: 'budget',
    title: filmPlan.SECTION_TITLES.budget,
    lines: [
      line(
        'budget-1',
        budget
          ? `A starting split of ${money(budget.amount)}: adjust it with your distributor, and move money first to the cities with the strongest pre-sales.`
          : 'A starting split of the marketing budget, as shares: adjust it with your distributor, and move money first to the cities with the strongest pre-sales.',
      ),
      ...BUDGET_CONVENTION.map((c, i) =>
        line(
          `budget-${i + 2}`,
          budget
            ? `${c.line}: ${Math.round(c.share * 100)}%, ${money(budget.amount * c.share)}.`
            : `${c.line}: ${Math.round(c.share * 100)}%.`,
        ),
      ),
    ],
  };
}

function gapsSection(read: FilmRead, comps: { used: CompUsed[] }): LaunchSection {
  // Only inputs the team could add. What could not be asked goes to the Assumptions tab instead.
  const texts = [
    ...(comps.used.some((c) => c.source === 'added')
      ? [
          'Say what the film is about, its genre, and who stars in it or directs it, and the plan can be built around them.',
        ]
      : []),
    ...(read.ages.length
      ? []
      : ['Say who the film is for (an age range), and the campaign can aim at them.']),
    ...(read.window
      ? []
      : ['Add a release date or window, and the timeline turns into real dates.']),
    ...(read.route
      ? []
      : ['Say whether it goes to cinemas, a platform or both, and the release route firms up.']),
    ...(read.budget ? [] : ['Add a marketing budget, and the split turns into amounts.']),
  ];
  return {
    key: 'gaps',
    title: filmPlan.SECTION_TITLES.gaps,
    lines: texts.map((text, i) => ({
      id: `gaps-${i + 1}`,
      kind: 'playbook',
      text,
      findingIds: [],
      sourceIds: [],
      names: [],
      group: null,
    })),
  };
}

export const filmLaunch: LaunchConfig<FilmRead, QueryPlan> = {
  category: 'film',
  catalog: Object.values(filmPlan.FILM_QUERIES),
  anchorTypes: ['urn:entity:movie', 'urn:entity:tv_show'],
  rivalTypes: ['urn:entity:movie'],
  genreTagPrefix: filmPlan.TAG_SPACES.films.prefix,
  artistQueries: ['music'],
  words: {
    comps: 'films or series',
    entity: 'title',
    rivalExample: '“Gangs of Lagos” on 2026-12-05',
    planExample:
      'For example: “A Nigerian crime thriller for 25 to 34, opening in Lagos and London, with Nike as a partner.”',
    artistPitch: 'the soundtrack or a launch single',
  },
  // The soundtrack artists the team named are asked of the Music side: who listens to them, and
  // where, set against this film's audience.
  consults: (read) =>
    read.soundtrack.slice(0, 2).map((name) => ({
      id: `consult-music-${slug(name)}`,
      category: 'music',
      types: ['urn:entity:artist'],
      name,
      why: `${name} is on the soundtrack, so who listens to them and where shows whether the music reaches the film's audience.`,
    })),
  minimum: {
    id: 'film.minimum',
    example: 'For example: “A Nigerian crime thriller, opening in Lagos and London.”',
    missing: (read) => (read.places.length ? [] : ['at least one city it opens in']),
  },
  typical: {
    genre: 'drama',
    country: 'Nigeria',
    label: 'a typical Nollywood film',
    // A logline is not counted: a reader may fill it with the request itself, and a real one has
    // already let the analysis infer a genre.
    described: (read) =>
      read.cast.length > 0 || read.director !== null || read.soundtrack.length > 0,
  },
  pickModules: (read) =>
    filmPlan.pickModules({
      scope: read.scope,
      ask: read.ask,
      format: read.format,
      route: read.route,
      hasBudget: read.budget !== null,
    }),
  rules: FILM_RULES,
  decisions: FILM_DECISIONS,
  briefNames: {
    build: (read) => [
      ...read.places,
      ...read.cast,
      ...(read.director ? [read.director] : []),
      ...read.soundtrack,
      ...read.partners,
      ...(read.country ? [read.country] : []),
    ],
    answer: (read) => [...read.places, ...read.cast, ...read.partners, ...read.soundtrack],
  },
  codeSections: { budget: budgetSection, gaps: gapsSection, timeline: timelineSection },
  templateSection,
  emptyRead: EMPTY_READ,
  ground,
  claims: (read) =>
    read.places.length +
    read.ages.length +
    read.partners.length +
    read.soundtrack.length +
    read.comps.length +
    (read.gender ? 1 : 0) +
    (read.window ? 1 : 0),
  beliefs: filmBeliefs,
};
