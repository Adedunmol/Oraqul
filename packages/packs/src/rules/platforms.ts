import type { Category } from '@oraqul/schema';
import { leadChannels } from './index';
import { teamRule } from './shared';

/** A platform a team can pick to run its campaign on, with what it is for. */
export interface Platform {
  name: string;
  /** What the platform does for a launch, in a phrase. Playbook, not a taste claim. */
  use: string;
}

// The short phrases name the job each platform does in a launch, so a team can choose by job.
// WhatsApp is private: people share into it, so it is offered last and never as the way to reach
// strangers.
const CATALOGUE: Platform[] = [
  {
    name: 'Instagram',
    use: 'Reels, Stories and link stickers. Where a launch is seen and shared.',
  },
  { name: 'TikTok', use: 'Short video that discovery runs on. Sounds and clips travel here.' },
  { name: 'YouTube', use: 'Trailers, full videos and Shorts. Search keeps them found.' },
  { name: 'X', use: 'Release-day talk, fan threads and press pick-ups.' },
  { name: 'Facebook', use: 'Community groups and older audiences, with ads that reach them.' },
  { name: 'Snapchat', use: 'Younger audiences, with Spotlight clips and story ads.' },
  { name: 'Reddit', use: 'Niche communities that reward a real answer, not an ad.' },
  { name: 'Discord', use: 'A home for the fans who stay: previews, questions and playtests.' },
  { name: 'Twitch', use: 'Live play and reactions with creators.' },
  {
    name: 'WhatsApp',
    use: 'People pass it on to people they know. Seed a Status and a Channel; it does not reach strangers.',
  },
];

const byName = new Map(CATALOGUE.map((p) => [p.name.toLowerCase(), p]));

/** A format name such as "Instagram Reels" stands for its platform. */
export function platformOf(channel: string): string {
  const lower = channel.toLowerCase();
  const hit = CATALOGUE.find(
    (p) => lower === p.name.toLowerCase() || lower.startsWith(`${p.name.toLowerCase()} `),
  );
  return hit?.name ?? channel;
}

/** Platforms that a category adds beyond the common ones, strongest first. */
export const CATEGORY_EXTRAS = teamRule<Record<Category, string[]>>('platforms.category', {
  film: ['X', 'Facebook'],
  music: ['X', 'Snapchat'],
  books: ['Reddit', 'X'],
  podcasts: ['X', 'Reddit'],
  games: ['Reddit', 'Twitch', 'X'],
});

/** Platforms a market adds, after its own leaders. */
export const MARKET_EXTRAS = teamRule<Record<string, string[]>>('platforms.market', {
  nigeria: ['X', 'Facebook', 'Snapchat'],
  ghana: ['X', 'Facebook', 'Snapchat'],
  'south africa': ['X', 'Facebook'],
});

/** How many platforms the card offers, WhatsApp included where the market uses it. */
const SUGGEST = 7;

/** Markets where WhatsApp is how a release is passed around, so it is offered as a sharing layer. */
const WHATSAPP_MARKETS = new Set(['nigeria', 'ghana', 'south africa', 'india', 'brazil']);

/**
 * The platforms to offer a team for a market, best fit first. The category's leaders and the
 * market's own come before the rest, and WhatsApp comes last because it spreads a launch between
 * people who already know each other.
 */
export function suggestPlatforms(category: Category, country: string | null): Platform[] {
  const key = country?.toLowerCase() ?? '';
  const names = [
    ...leadChannels(category, country).map(platformOf),
    ...(MARKET_EXTRAS.value[key] ?? []),
    ...CATEGORY_EXTRAS.value[category],
  ].filter((n, i, all) => n !== 'WhatsApp' && all.indexOf(n) === i);
  const shown = [
    ...names.slice(0, SUGGEST - 1),
    ...(WHATSAPP_MARKETS.has(key) ? ['WhatsApp'] : []),
  ];
  return shown.flatMap((n) => byName.get(n.toLowerCase()) ?? []);
}

/** Platforms a message names, in the order the catalogue lists them. */
export function platformsNamed(text: string): string[] {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ')} `;
  return CATALOGUE.filter((p) => {
    const n = p.name.toLowerCase();
    // "X" alone is too short to find in running text, so it needs a platform word beside it.
    return n === 'x'
      ? /\b(?:twitter|on x|x\.com)\b/.test(text.toLowerCase())
      : lower.includes(` ${n} `);
  }).map((p) => p.name);
}
