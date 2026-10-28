import { podcastsPlan } from '@oraqul/packs';
import { checkPlan, defaultPlan, type QueryPlanInput } from './planner.js';
import type { PodcastsRead } from './read.js';
import { RESEARCH_SYSTEM } from './research.js';

const read: PodcastsRead = {
  show: null,
  launchKind: 'debut',
  format: 'audio',
  style: null,
  platforms: [],
  previousShows: [],
  crossPromo: [],
  rivals: [],
  topics: [],
  hosts: [],
  guests: [],
  regions: ['Nigeria'],
  audienceNote: 'Nigerians',
  genre: 'true crime',
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

const input = (over: Partial<PodcastsRead> = {}): QueryPlanInput => ({
  title: 'Cold Case Files',
  read: { ...read, ...over },
  modules: ['crosspromo', 'partnerships', 'guests'],
  compsCountry: null,
});

describe('Podcasts query plan', () => {
  it('asks per-city questions in the cities the regions stand for when none is named', () => {
    const plan = defaultPlan(input());
    expect(plan.cities).toEqual([]);
    expect(plan.regionCities).toEqual(['Lagos', 'Abuja']);
    expect(plan.askCities).toEqual(['Lagos', 'Abuja']);
    expect(plan.brandCities).toEqual(['Lagos', 'Abuja']);
  });

  it('keeps the team cities as the ones to ask about when it names some', () => {
    const plan = defaultPlan(input({ places: ['London'] }));
    expect(plan.askCities).toEqual(['London']);
    expect(plan.worthALook).toEqual(expect.arrayContaining(['Lagos', 'Abuja']));
  });

  it('reads the podcast genre from the subject, and runs the queries the modules offer', () => {
    const plan = defaultPlan(input());
    expect(plan.genre).toBe('true crime');
    expect(plan.queries).toEqual([
      'audience',
      'markets',
      'topics',
      'crosspromo',
      'brands',
      'guests',
    ]);
  });

  it('asks a football show for Nigerians with the soccer tag, and sports as the fallback', () => {
    const plan = defaultPlan(input({ genre: 'football', places: ['Lagos', 'London'] }));
    expect(plan.genre).toBe('soccer');
    expect(plan.genreFallback).toBe('sports');
    expect(defaultPlan(input({ genre: 'true crime' })).genreFallback).toBeNull();
  });

  it('keeps the brands the model names for a ranked region, and drops any other city', () => {
    const plan = defaultPlan(input());
    const checked = checkPlan(
      {
        genre: null,
        showCity: null,
        crossoverCity: null,
        brandCategories: [],
        brandCities: [],
        brandCandidates: [
          { city: 'Lagos', names: ['MTN', 'Glo', 'Airtel'] },
          { city: 'Berlin', names: ['Zalando'] },
        ],
      },
      plan,
    );
    expect(checked.brandCandidates).toEqual([{ city: 'Lagos', names: ['MTN', 'Glo', 'Airtel'] }]);
    // The markets the person named stay the plan's markets: the model cannot swap them.
    expect(checked.worthALook).toEqual(plan.worthALook);
  });

  it('tells the web search to look at how the audience listens, never to name the show', () => {
    expect(RESEARCH_SYSTEM).toMatch(/how people there listen/);
    expect(RESEARCH_SYSTEM).toMatch(/never the show/);
    expect(podcastsPlan.KIND_PROFILES.debut.defaultCities.length).toBeGreaterThan(0);
  });
});
