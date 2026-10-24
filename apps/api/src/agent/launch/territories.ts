import { cityCountry } from '@oraqul/engine';
import { DIASPORA, leadChannels, platformOf, suggestPlatforms } from '@oraqul/packs';
import type { Category, LaunchSection, LaunchSectionKey, Territory } from '@oraqul/schema';
import { slug } from './brief.js';
import { codeLine } from './signal.js';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** How many channels lead. The rest are added once the lead ones are running. */
const LEAD = 3;

/**
 * A territory's channels. The platforms the team chose, in the order that suits the territory's
 * market (WhatsApp last, since it only passes a launch between people who know each other), or
 * the market's usual ones when the team chose none.
 */
function channelsFor(category: Category, country: string | null, chosen: string[] | null) {
  if (!chosen?.length) return leadChannels(category, country);
  const order = suggestPlatforms(category, country).map((p) => p.name);
  const rank = (name: string) => {
    const i = order.indexOf(platformOf(name));
    return i === -1 ? order.length : i;
  };
  return [...chosen].sort((a, b) => rank(a) - rank(b));
}

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
  /** The platforms the team chose. Null plans on the market's usual ones. */
  platforms?: string[] | null;
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
    const channels = channelsFor(category, cityCountry(name), input.platforms ?? null);
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
      // WhatsApp passes a launch between people who know each other, so it never leads (D7).
      channels: channels.map((channel, i) => ({
        name: channel,
        lead: i < LEAD && platformOf(channel) !== 'WhatsApp',
      })),
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
      const sharing = rest.filter((c) => platformOf(c) === 'WhatsApp');
      const others = rest.filter((c) => platformOf(c) !== 'WhatsApp');
      const role =
        t.role === 'home' ? 'Home market. ' : t.role === 'diaspora' ? 'Diaspora city. ' : '';
      const first = lead.length
        ? `Lead on ${join(lead)}${others.length ? `, then add ${join(others)}` : ''}`
        : others.length
          ? `Add ${join(others)}`
          : 'Add a public platform to find people who do not know you yet';
      const share = sharing.length
        ? `. Use ${join(sharing)} as a sharing layer: it passes a launch between people who know each other, and does not reach strangers`
        : '';
      return codeLine(`channels-${slug(t.name)}`, `${role}${first}${share}.`, t.name);
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
