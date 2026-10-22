import { cityCountry } from '@oraqul/engine';
import { DIASPORA, leadChannels } from '@oraqul/packs';
import type { Category, LaunchSection, LaunchSectionKey, Territory } from '@oraqul/schema';
import { slug } from './brief.js';
import { codeLine } from './signal.js';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** How many channels lead. The rest are added once the lead ones are running. */
const LEAD = 3;

/**
 * One territory per city the team named: the home market first (the city in the release's
 * country), then the diaspora cities the country's rollout reaches, then the rest in the team's
 * own order. The team's cities are constraints: none is added or dropped here.
 */
export function territoriesOf(input: {
  category: Category;
  cities: string[];
  /** The release's country, as a full name. */
  country: string | null;
  /** The team's cities in the order Qloo ranked them, for the cities that are neither. */
  ranked: string[];
}): Territory[] {
  const { category, cities, country } = input;
  if (cities.length === 0) return [];
  const home = country ? cities.find((c) => cityCountry(c) === country) : undefined;
  const hubs = country ? (DIASPORA[country.toLowerCase()] ?? []) : [];
  const diaspora = hubs.flatMap((hub) => cities.find((c) => same(c, hub) && c !== home) ?? []);
  const rest = [...input.ranked, ...cities].filter(
    (c, i, all) =>
      cities.some((x) => same(x, c)) &&
      all.findIndex((x) => same(x, c)) === i &&
      c !== home &&
      !diaspora.some((d) => same(d, c)),
  );
  const ordered = [...(home ? [home] : []), ...diaspora, ...rest];
  return ordered.map((name, order) => {
    const channels = leadChannels(category, cityCountry(name));
    return {
      id: `territory-${slug(name)}`,
      name,
      role: same(name, home ?? '')
        ? 'home'
        : diaspora.some((d) => same(d, name))
          ? 'diaspora'
          : 'other',
      order,
      callId: null,
      channels: channels.map((channel, i) => ({ name: channel, lead: i < LEAD })),
      partnerIds: [],
      lineIds: [],
    };
  });
}

const join = (items: string[]) => {
  const last = items.at(-1);
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${last}` : (last ?? '');
};

/** Where to lead, per territory, written by code from the rule library. Playbook lines. */
export function channelsSection(title: string, territories: Territory[]): LaunchSection {
  return {
    key: 'channels' satisfies LaunchSectionKey,
    title,
    lines: territories.map((t) => {
      const lead = t.channels.filter((c) => c.lead).map((c) => c.name);
      const rest = t.channels.filter((c) => !c.lead).map((c) => c.name);
      const role =
        t.role === 'home' ? 'Home market. ' : t.role === 'diaspora' ? 'Diaspora city. ' : '';
      return codeLine(
        `channels-${slug(t.name)}`,
        `${role}Lead on ${join(lead)}${rest.length ? `, then add ${join(rest)}` : ''}.`,
        t.name,
      );
    }),
  };
}

/** Each territory's plan lines: every line of the final plan grouped under its name. */
export function withLines(territories: Territory[], sections: LaunchSection[]): Territory[] {
  return territories.map((t) => ({
    ...t,
    lineIds: sections.flatMap((s) =>
      s.lines.filter((l) => l.group && same(l.group, t.name)).map((l) => l.id),
    ),
  }));
}
