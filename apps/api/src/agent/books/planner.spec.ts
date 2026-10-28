import { booksPlan } from '@oraqul/packs';
import { checkPlan, defaultPlan, type QueryPlanInput } from './planner.js';
import type { BooksRead } from './read.js';
import { RESEARCH_SYSTEM } from './research.js';

const read: BooksRead = {
  book: null,
  author: null,
  launchKind: 'debut',
  route: null,
  readership: null,
  formats: [],
  previousBooks: [],
  screenTitles: [],
  bookshops: [],
  regions: ['Nigeria'],
  audienceNote: 'Nigerians',
  genre: 'literary fiction',
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

const input = (over: Partial<BooksRead> = {}): QueryPlanInput => ({
  title: 'The Lagos Ledger',
  read: { ...read, ...over },
  modules: ['comps', 'adaptation', 'partnerships', 'events'],
  compsCountry: null,
});

describe('Books query plan', () => {
  it('asks per-city questions in the cities the regions stand for when none is named', () => {
    const plan = defaultPlan(input());
    expect(plan.cities).toEqual([]);
    expect(plan.regionCities).toEqual(['Lagos', 'Abuja']);
    expect(plan.askCities).toEqual(['Lagos', 'Abuja']);
    expect(plan.bookshopCities).toEqual(['Lagos', 'Abuja']);
    expect(plan.brandCities).toEqual(['Lagos', 'Abuja']);
  });

  it('keeps the team cities as the ones to ask about when it names some', () => {
    const plan = defaultPlan(input({ places: ['London'] }));
    expect(plan.askCities).toEqual(['London']);
    expect(plan.worthALook).toEqual(expect.arrayContaining(['Lagos', 'Abuja']));
  });

  it('reads the book genre from the subject, and runs the queries the modules offer', () => {
    const plan = defaultPlan(input());
    expect(plan.genre).toBe('literary fiction');
    expect(plan.queries).toEqual([
      'audience',
      'markets',
      'themes',
      'shelf',
      'bridge',
      'brands',
      'bookshops',
    ]);
  });

  it('asks the shelf in the home market only, so it reads like what readers there pick up', () => {
    expect(defaultPlan(input({ places: ['London', 'Lagos'], country: 'Nigeria' })).shelfCity).toBe(
      'Lagos',
    );
    expect(defaultPlan(input({ places: ['London'] })).shelfCity).toBeNull();
  });

  it('chooses no screen titles itself, and the readership and route by default', () => {
    const plan = defaultPlan(input({ genre: 'romance' }));
    // The model names the screen titles from the book; code holds no list of them.
    expect(plan.screenSeries).toEqual([]);
    expect(plan.screenFilms).toEqual([]);
    expect(plan.route).toBe('traditional');
    expect(plan.readership).toBe('adult');
  });

  it('keeps the brands the model names for a ranked region, and drops any other city', () => {
    const plan = defaultPlan(input());
    const checked = checkPlan(
      {
        genre: null,
        shelfCity: null,
        bookshopCities: [],
        brandCategories: [],
        brandCities: [],
        screenSeries: [],
        screenFilms: [],
        brandCandidates: [
          { city: 'Lagos', names: ['MTN', 'Glo', 'Airtel'] },
          { city: 'Berlin', names: ['Zalando'] },
        ],
      },
      plan,
    );
    expect(checked.brandCandidates).toEqual([{ city: 'Lagos', names: ['MTN', 'Glo', 'Airtel'] }]);
    // Worth a look is code's: the model has no say in which cities are ranked beside the team's.
    expect(checked.worthALook).toEqual(plan.worthALook);
    expect(checked.screenSeries).toEqual([]);
  });

  it('takes the screen titles the model names, as short plain phrases', () => {
    const plan = defaultPlan(input());
    const checked = checkPlan(
      {
        genre: null,
        shelfCity: null,
        bookshopCities: [],
        brandCategories: [],
        brandCities: [],
        screenSeries: [
          'Conversations with Friends',
          'A line that is far too long to be a title of anything at all',
        ],
        screenFilms: [],
        brandCandidates: [],
      },
      plan,
    );
    expect(checked.screenSeries).toEqual(['Conversations with Friends']);
  });

  it('tells the web search to look at where the readers buy, never to name the book', () => {
    expect(RESEARCH_SYSTEM).toMatch(/where people there buy books/);
    expect(RESEARCH_SYSTEM).toMatch(/never the book or the author/);
    expect(booksPlan.KIND_PROFILES.debut.defaultCities.length).toBeGreaterThan(0);
  });
});
