import { describe, expect, it } from 'vitest';
import { checkLine } from './check.js';
import { withSharedModules } from './modules.js';
import { channelsSection, territoriesOf, withLines } from './territories.js';

describe('territoriesOf (D4)', () => {
  const nigerian = {
    category: 'film' as const,
    cities: ['Atlanta', 'London', 'Lagos', 'Houston'],
    country: 'Nigeria',
    ranked: ['London', 'Lagos', 'Houston', 'Atlanta'],
  };

  it('plans the home market first, then the diaspora cities in the rollout order', () => {
    const t = territoriesOf(nigerian);
    expect(t.map((x) => x.name)).toEqual(['Lagos', 'London', 'Houston', 'Atlanta']);
    expect(t.map((x) => x.role)).toEqual(['home', 'diaspora', 'diaspora', 'diaspora']);
    expect(t.map((x) => x.order)).toEqual([0, 1, 2, 3]);
  });

  it('never adds or drops a city the team named, and orders the rest as ranked', () => {
    const t = territoriesOf({
      ...nigerian,
      cities: ['Accra', 'Lagos', 'Paris', 'Lyon'],
      ranked: ['Lyon', 'Paris', 'Lagos', 'Accra'],
    });
    expect(t.map((x) => x.name)).toEqual(['Lagos', 'Lyon', 'Paris', 'Accra']);
    expect(t.map((x) => x.role)).toEqual(['home', 'other', 'other', 'other']);
  });

  it('has no territory without a city', () => {
    expect(territoriesOf({ ...nigerian, cities: [] })).toEqual([]);
  });

  it('leads Nigeria on WhatsApp and Instagram and Lagos or London by category (D7)', () => {
    const film = territoriesOf(nigerian);
    const lagos = film.find((x) => x.name === 'Lagos');
    expect(
      lagos?.channels
        .filter((c) => c.lead)
        .map((c) => c.name)
        .slice(0, 2),
    ).toEqual(['WhatsApp', 'Instagram']);
    const london = film.find((x) => x.name === 'London');
    expect(london?.channels[0]).toEqual({ name: 'YouTube', lead: true });

    const music = territoriesOf({ ...nigerian, category: 'music' }).find(
      (x) => x.name === 'London',
    );
    expect(music?.channels[0]?.name).toBe('TikTok');
  });
});

describe('channelsSection', () => {
  it('writes one playbook line per territory that the line check accepts', () => {
    const territories = territoriesOf({
      category: 'books',
      cities: ['Lagos', 'London'],
      country: 'Nigeria',
      ranked: ['Lagos', 'London'],
    });
    const section = channelsSection('Channels', territories);
    expect(section.lines.map((l) => l.group)).toEqual(['Lagos', 'London']);
    const ctx = {
      rules: { titles: {} as never, tasteClaim: /\b(fans?|likes?)\b/i, tagOnly: [] },
      findings: [],
      sources: [],
      briefNames: ['Lagos', 'London'],
      briefText: '',
      teamCities: ['Lagos', 'London'],
      teamAges: [],
      allowed: ['channels' as const],
    };
    for (const line of section.lines) expect(checkLine('channels', line, ctx)).toBeNull();
    expect(section.lines[0]?.text).toMatch(/^Home market\. Lead on WhatsApp, Instagram and/);
  });

  it('collects each territory its plan lines by group', () => {
    const territories = territoriesOf({
      category: 'film',
      cities: ['Lagos', 'London'],
      country: 'Nigeria',
      ranked: [],
    });
    const out = withLines(territories, [
      channelsSection('Channels', territories),
      {
        key: 'markets',
        title: 'Markets',
        lines: [
          {
            id: 'm-lagos',
            kind: 'playbook',
            text: 'x',
            findingIds: [],
            sourceIds: [],
            names: [],
            group: 'lagos',
          },
        ],
      },
    ]);
    expect(out[0]?.lineIds).toEqual(['channels-lagos', 'm-lagos']);
  });
});

describe('withSharedModules', () => {
  const pick = { modules: ['partnerships', 'timeline', 'budget'] as never, ruledOut: [] };

  it('adds channels and creative briefs to a full plan with a city, before the timeline', () => {
    const out = withSharedModules(pick, { scope: 'full', places: ['Lagos'] });
    expect(out.modules).toEqual(['partnerships', 'channels', 'creative', 'timeline', 'budget']);
  });

  it('adds nothing to a narrow ask, and only the creative briefs when there is no city', () => {
    expect(withSharedModules(pick, { scope: 'narrow', places: ['Lagos'] })).toBe(pick);
    expect(withSharedModules(pick, { scope: 'full', places: [] }).modules).toEqual([
      'partnerships',
      'creative',
      'timeline',
      'budget',
    ]);
  });
});
