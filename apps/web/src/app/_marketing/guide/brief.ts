import type { Category, StartMode } from '@oraqul/schema';

// The brief the guide builds is plain text in the forms Oraqul reads without guessing: a title in
// quotes, a release date as YYYY-MM-DD, a budget band in words, a target with a number, and
// "Rivals: Title on YYYY-MM-DD". Nothing here is sent anywhere; the person opens it in the app.

export const bands = [
  { id: 'micro', label: 'Micro', words: 'A micro budget.', hint: 'Under about $10k' },
  {
    id: 'independent',
    label: 'Independent',
    words: 'An independent budget.',
    hint: 'Up to about $100k',
  },
  { id: 'mid', label: 'Mid-size', words: 'A mid-size budget.', hint: 'Up to about $1M' },
  { id: 'major', label: 'Major', words: 'A major budget.', hint: 'Over $1M' },
] as const;
export type BandId = (typeof bands)[number]['id'];

export interface Extra {
  id: string;
  label: string;
  placeholder: string;
}

export interface CategoryGuide {
  name: string;
  /** "Launch plan for ___". */
  noun: string;
  compsLabel: string;
  /** What the one signal is, so the target field can say what its number counts. */
  signal: string;
  unit: string;
  extras: Extra[];
}

export const CATEGORY_GUIDE: Record<Category, CategoryGuide> = {
  film: {
    name: 'Film and series',
    noun: 'film',
    compsLabel: 'Comps',
    signal: 'Advance screenings and presales',
    unit: 'presales',
    extras: [
      { id: 'format', label: 'Film or series', placeholder: 'A feature film' },
      { id: 'language', label: 'Language', placeholder: 'English and Yoruba' },
      { id: 'route', label: 'Release route', placeholder: 'Cinemas first, then streaming' },
      { id: 'cast', label: 'Cast and director', placeholder: 'Names, as they would appear' },
    ],
  },
  music: {
    name: 'Music',
    noun: 'release',
    compsLabel: 'Sound-alikes',
    signal: 'Save rate and stream completion',
    unit: 'saves',
    extras: [
      { id: 'artist', label: 'Artist', placeholder: 'The artist name' },
      { id: 'type', label: 'Release type', placeholder: 'Single, EP, album or tour' },
      { id: 'support', label: 'Support acts already booked', placeholder: 'Names' },
    ],
  },
  books: {
    name: 'Books',
    noun: 'book',
    compsLabel: 'Comparable books',
    signal: 'Advance copy conversion and early reviews',
    unit: 'advance copies read',
    extras: [
      { id: 'author', label: 'Author', placeholder: 'The author name' },
      {
        id: 'kind',
        label: 'Kind of launch',
        placeholder: 'Debut, new book, next in a series or reissue',
      },
      { id: 'route', label: 'Route', placeholder: "A publisher's, or self-published" },
      { id: 'readership', label: 'Readership', placeholder: 'Adult, young adult or children' },
      { id: 'formats', label: 'Formats', placeholder: 'Print, ebook, audiobook' },
    ],
  },
  podcasts: {
    name: 'Podcasts',
    noun: 'podcast',
    compsLabel: 'Comparable shows',
    signal: 'Downloads per episode at day 30 and day 60',
    unit: 'downloads per episode',
    extras: [
      { id: 'kind', label: 'New show or new season', placeholder: 'A new show' },
      { id: 'format', label: 'Format', placeholder: 'Audio, video or both' },
      { id: 'platforms', label: 'Where it is published', placeholder: 'Spotify, Apple, YouTube' },
      { id: 'earlier', label: 'Earlier shows by the host or network', placeholder: 'Names' },
    ],
  },
  games: {
    name: 'Games',
    noun: 'game',
    compsLabel: 'Comparable games',
    signal: 'Wishlists',
    unit: 'wishlists',
    extras: [
      {
        id: 'kind',
        label: 'Kind of launch',
        placeholder: 'Premium, early access, free to play or mobile',
      },
      { id: 'platforms', label: 'Platforms', placeholder: 'Steam, Switch, iOS' },
      { id: 'franchise', label: 'Earlier games in the franchise', placeholder: 'Names' },
      { id: 'collabs', label: 'Collabs you want', placeholder: 'A band, a series, a brand' },
      { id: 'tags', label: 'Store tags', placeholder: 'Roguelike, Indie' },
    ],
  },
};

export interface Rival {
  title: string;
  date: string;
}

export interface Values {
  category: Category;
  mode: StartMode;
  title: string;
  about: string;
  country: string;
  release: string;
  cities: string;
  ages: string;
  comps: string;
  band: BandId | '';
  target: string;
  rivals: Rival[];
  partners: string;
  channels: string;
  extras: Record<string, string>;
  /** The plan to check or fix, pasted as written. */
  plan: string;
}

export const emptyValues = (category: Category = 'film'): Values => ({
  category,
  mode: 'build',
  title: '',
  about: '',
  country: '',
  release: '',
  cities: '',
  ages: '',
  comps: '',
  band: '',
  target: '',
  rivals: [{ title: '', date: '' }],
  partners: '',
  channels: '',
  extras: {},
  plan: '',
});

const words = (text: string) =>
  text
    .split(/[,;\n]/)
    .map((w) => w.trim())
    .filter(Boolean);

const quoted = (names: string[]) => names.map((n) => `"${n.replaceAll('"', '')}"`).join(', ');
const joined = (names: string[]) => {
  const last = names.at(-1);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${last}` : (last ?? '');
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validRivals = (rivals: Rival[]) =>
  rivals.filter((r) => r.title.trim() && ISO.test(r.date) && !Number.isNaN(Date.parse(r.date)));

/** What matters most, in order. Each is a detail the plan is better for, and why. */
export const DETAILS = [
  { id: 'release', label: 'Release date', why: 'Every calendar is worked back from it.' },
  {
    id: 'cities',
    label: 'Home city and diaspora cities',
    why: 'You get one plan per territory, home first.',
  },
  { id: 'comps', label: 'Comparable titles', why: 'They are how Qloo finds your audience.' },
  { id: 'band', label: 'Budget band', why: 'The plan proposes only what the budget can carry.' },
  {
    id: 'rivals',
    label: 'Rivals with their dates',
    why: 'Each date is checked against the audience it shares.',
  },
  {
    id: 'target',
    label: 'A target for the one signal',
    why: 'The plan is judged on a number you chose.',
  },
  { id: 'ages', label: 'Age band', why: 'It is tested against who Qloo says the audience is.' },
  {
    id: 'partners',
    label: 'Partners already signed',
    why: 'They stay in the plan and are never suggested back.',
  },
  { id: 'channels', label: 'Channels you already use', why: 'The channel plan builds on them.' },
] as const;
export type DetailId = (typeof DETAILS)[number]['id'];

export function filled(v: Values): Record<DetailId, boolean> {
  return {
    release: ISO.test(v.release),
    cities: words(v.cities).length > 0,
    comps: words(v.comps).length > 0,
    band: v.band !== '',
    rivals: validRivals(v.rivals).length > 0,
    target: /\d/.test(v.target),
    ages: v.ages.trim() !== '',
    partners: words(v.partners).length > 0,
    channels: words(v.channels).length > 0,
  };
}

/** The brief as plain text, in the order a reader of a plan expects it. Empty fields leave no trace. */
export function buildBrief(v: Values): string {
  const guide = CATEGORY_GUIDE[v.category];
  const title = v.title.trim();
  const cities = words(v.cities);
  const comps = words(v.comps).slice(0, 5);
  const band = bands.find((b) => b.id === v.band);
  const lead = v.mode === 'build' ? 'Launch plan for' : 'Our plan for';
  const what = `${guide.noun}${title ? ` "${title.replaceAll('"', '')}"` : ''}`;
  const about = v.about.trim() ? `, ${v.about.trim().replace(/[.]+$/, '')}` : '';
  const country = v.country.trim() ? ` from ${v.country.trim()}` : '';
  const ages = v.ages.trim() ? ` for ${v.ages.trim()}` : '';
  const where = cities.length ? `, opening in ${joined(cities)}` : '';
  const when = ISO.test(v.release) ? ` on ${v.release}` : '';
  const out: string[] = [`${lead} the ${what}${about}${country}${ages}${where}${when}.`];

  if (comps.length) out.push(`${guide.compsLabel}: ${quoted(comps)}.`);
  for (const extra of guide.extras) {
    const value = v.extras[extra.id]?.trim();
    if (value) out.push(`${extra.label}: ${value}.`);
  }
  if (band) out.push(band.words);
  const target = v.target.trim();
  if (/\d/.test(target)) {
    out.push(
      `Target ${target.replace(/^target\s*/i, '')}${/[a-z]/i.test(target) ? '' : ` ${guide.unit}`}.`,
    );
  }
  const rivals = validRivals(v.rivals);
  if (rivals.length)
    out.push(`Rivals: ${rivals.map((r) => `${r.title.trim()} on ${r.date}`).join('; ')}`);
  const partners = words(v.partners);
  if (partners.length) out.push(`Partners already signed: ${joined(partners)}.`);
  const channels = words(v.channels);
  if (channels.length) out.push(`Channels we already use: ${joined(channels)}.`);
  if (v.mode !== 'build' && v.plan.trim()) out.push('', v.plan.trim());
  return out.join('\n');
}
