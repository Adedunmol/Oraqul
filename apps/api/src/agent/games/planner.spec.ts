import { gamesPlan } from '@oraqul/packs';
import { checkPlan, defaultPlan, type QueryPlanInput } from './planner.js';
import type { GamesRead } from './read.js';
import { RESEARCH_SYSTEM } from './research.js';

const read: GamesRead = {
  game: null,
  launchKind: 'mobile',
  platforms: [],
  franchise: [],
  collabs: [],
  storeTags: [],
  regions: ['Nigeria'],
  creators: [],
  audienceNote: 'Nigerians',
  genre: 'shooter',
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

const input = (over: Partial<GamesRead> = {}): QueryPlanInput => ({
  title: 'Jagun jagun',
  read: { ...read, ...over },
  modules: ['partnerships', 'publicity', 'community'],
  compsCountry: null,
});

describe('Games query plan', () => {
  it('asks per-city questions in the cities the regions stand for when none is named', () => {
    const plan = defaultPlan(input());
    expect(plan.cities).toEqual([]);
    expect(plan.regionCities).toEqual(['Lagos', 'Abuja']);
    expect(plan.askCities).toEqual(['Lagos', 'Abuja']);
    expect(plan.brandCities).toEqual(['Lagos', 'Abuja']);
    expect(plan.communityCities).toEqual(['Lagos', 'Abuja']);
  });

  it('keeps the team cities as the ones to ask about when it names some', () => {
    const plan = defaultPlan(input({ places: ['Seoul'] }));
    expect(plan.askCities).toEqual(['Seoul']);
    expect(plan.worthALook).toEqual(expect.arrayContaining(['Lagos', 'Abuja']));
  });

  it('keeps the brands the model names for a ranked region, and drops any other city', () => {
    const plan = defaultPlan(input());
    const checked = checkPlan(
      {
        podcastGenre: null,
        podcastCity: null,
        brandCategories: [],
        brandCities: [],
        communityPlaces: [],
        communityCities: [],
        worthALook: [],
        brandCandidates: [
          { city: 'Lagos', names: ['MTN', 'Glo', 'Airtel'] },
          { city: 'Berlin', names: ['Zalando'] },
        ],
      },
      plan,
    );
    expect(checked.brandCandidates).toEqual([{ city: 'Lagos', names: ['MTN', 'Glo', 'Airtel'] }]);
    // The regions the person named stay the plan's regions: the model cannot swap them.
    expect(checked.worthALook).toEqual(plan.worthALook);
  });

  it('tells the web search to look at how the audience gets and pays for games', () => {
    expect(RESEARCH_SYSTEM).toMatch(/pay for games/);
    expect(gamesPlan.KIND_PROFILES.mobile.defaultCities.length).toBeGreaterThan(0);
  });
});
