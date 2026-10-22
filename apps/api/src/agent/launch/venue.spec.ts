import { isVenue } from './findings.js';

describe('isVenue', () => {
  it('keeps a bar, a lounge and a club', () => {
    for (const name of ['Bloomsbury Tavern', 'Crescendo Lounge And Bar', 'Rhino at the Windmill']) {
      expect(isVenue({ name, popularity: 0.4 }), name).toBe(true);
    }
  });

  it('drops activities, gambling floors, hotels, and landmarks', () => {
    for (const name of [
      'The Camden Pub Crawl',
      'Empire Casino',
      'Ruby Lucy Hotel & Bar',
      'Soho Food Tours',
    ]) {
      expect(isVenue({ name, popularity: 0.4 }), name).toBe(false);
    }
    expect(isVenue({ name: 'Sky Garden', popularity: 1 })).toBe(false);
  });
});
