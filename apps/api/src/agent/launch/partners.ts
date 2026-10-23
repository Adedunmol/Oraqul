import { cityCountry } from '@oraqul/engine';
import {
  type BudgetBand,
  bandCarries,
  CATEGORY_PARTNERS,
  FLAGSHIPS,
  PARTNER_RULES,
  PARTNER_SEEDS,
  type PartnerTier,
} from '@oraqul/packs';
import type {
  Category,
  DirectionCall,
  Finding,
  LaunchPlan,
  PartnerFlag,
  PartnerKit,
  PartnerNote,
  PartnerOption,
  Territory,
} from '@oraqul/schema';
import { normalise } from '../router/decide.js';
import { rankVerdict } from './audit-verdicts.js';
import { slug } from './brief.js';
import { directionOf } from './direction.js';
import type { QueryPlanCore } from './planner.js';

const same = (a: string, b: string) => normalise(a) === normalise(b);

const seedsFor = (market: string) => PARTNER_SEEDS[market.toLowerCase()];

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The markets the plan reaches: the release country and the country of each city. */
export function marketsOf(country: string | null, cities: string[]): string[] {
  const all = [country, ...cities.map((c) => cityCountry(c))].flatMap((c) => (c ? [c] : []));
  return all.filter((c, i) => all.findIndex((x) => same(x, c)) === i);
}

/**
 * A tier for a brand by what Qloo says about it. A flagship seed is tier A, and so is a ranked
 * brand at or above the flagship popularity: a mass-market name is not "category and integration".
 * Any other brand is tier B.
 */
export function tierOf(name: string, popularity: number | null = null): PartnerTier {
  if (FLAGSHIPS.some((f) => same(f, name))) return 'A';
  return popularity !== null && popularity >= PARTNER_RULES.tier.value.flagshipPopularity
    ? 'A'
    : 'B';
}

/**
 * Every name the line check treats as a flagship: the seeded ones, and any brand Qloo ranked at
 * flagship popularity, so a band that cannot carry tier A drops lines that propose either.
 */
export function flagshipNames(findings: Finding[]): string[] {
  const limit = PARTNER_RULES.tier.value.flagshipPopularity;
  const ranked = findings
    .filter((f) => f.query === 'brands')
    .flatMap((f) => f.entities.filter((e) => (e.popularity ?? 0) >= limit).map((e) => e.name));
  return [...new Set([...FLAGSHIPS, ...ranked])];
}

/** Whether a budget band can carry a tier. A near miss is a stretch and a far one is out. */
export function budgetFitOf(band: BudgetBand, tier: PartnerTier): PartnerOption['budgetFit'] {
  if (bandCarries(band, tier)) return tier === 'B' && band === 'micro' ? 'stretch' : 'fits';
  return band === 'independent' ? 'stretch' : 'out';
}

/**
 * Adds the seeded partners for each city's market to the brands Qloo is asked to rank, so a seed
 * gets a measured fit. A flagship is added unless the band is far out of its reach (micro), since
 * a stretch still deserves a measured fit. The team's own candidates come first, and one call
 * still resolves them all.
 */
export function withSeeds<P extends QueryPlanCore>(plan: P, band: BudgetBand, cities: string[]): P {
  const seeded = (city: string): string[] => {
    const country = cityCountry(city);
    const seeds = country ? seedsFor(country) : undefined;
    if (!seeds) return [];
    return [...(budgetFitOf(band, 'A') !== 'out' ? seeds.A.names : []), ...seeds.B.names];
  };
  const known = new Map(plan.brandCandidates.map((c) => [c.city, c.names]));
  const askCities = [...new Set([...plan.brandCandidates.map((c) => c.city), ...cities])];
  return {
    ...plan,
    brandCandidates: askCities.flatMap((city) => {
      const names = [...new Set([...(known.get(city) ?? []), ...seeded(city)])].slice(0, 8);
      return names.length > 0 ? [{ city, names }] : [];
    }),
  };
}

/** How the work reads for a partner: a family or an adult tone, from the brief's own words. */
export type Tone = 'family' | 'adult';

const FAMILY = new RegExp(`\\b(?:${PARTNER_RULES.contentFit.value.family.join('|')})\\b`, 'i');
const ADULT = new RegExp(
  `\\b(?:${[...PARTNER_RULES.contentFit.value.adult, ...PARTNER_RULES.contentFit.value.ratings.map((r) => r.replace('+', '\\+'))].join('|')})\\b`,
  'i',
);

/**
 * The content rating or tone the team gave, from a "Content rating or tone:" line. Null when
 * there is none or it reads neither way: nothing is guessed from the plot.
 */
export function toneOf(text: string, rating: 'family' | 'adult' | null = null): Tone | null {
  const given = text.match(/content rating or tone\s*:\s*([^\n]+)/i)?.[1] ?? '';
  if (given && ADULT.test(given)) return 'adult';
  if (given && FAMILY.test(given)) return 'family';
  return rating;
}

interface FlagInput {
  name: string;
  tier: PartnerTier;
  kind: PartnerOption['kind'];
  tone: Tone | null;
  ages: string[];
}

/**
 * Mismatches between the work and a partner (T2). They are direction only: a flagged partner stays
 * in the list with the reason beside it, and the team decides.
 */
export function flagsOf({ name, tier, tone, ages }: FlagInput): PartnerFlag[] {
  const fit = PARTNER_RULES.contentFit.value;
  const flags: PartnerFlag[] = [];
  const familyBrand = FAMILY.test(name);
  const drinks = fit.alcohol.some((w) => same(w, name) || normalise(name).includes(normalise(w)));
  if (tone === 'adult' && familyBrand) {
    flags.push({
      type: 'content',
      why: 'A family brand beside content you describe as adult or violent. Check that the partner is comfortable with it.',
    });
  }
  if (tone === 'adult' && tier === 'A') {
    flags.push({
      type: 'backlash',
      why: 'A flagship brand tied to adult or violent content can draw fan and public backlash. Show the partner the content before anything is announced.',
    });
  }
  if (drinks && tone === 'family') {
    flags.push({
      type: 'content',
      why: 'A drinks brand beside family content. Check the partner’s rules on who its marketing may reach.',
    });
  }
  if (drinks && fit.youngAges.some((a) => ages.includes(a))) {
    flags.push({
      type: 'content',
      why: 'A drinks brand when the audience includes people under 25, some of whom are under the legal drinking age. Check the partner’s rules on who its marketing may reach.',
    });
  }
  return flags;
}

/**
 * Lead time, band and barter notes (T1), worked from the release date and today. Big brands plan
 * about a year and a half ahead, so a release closer than that is told so plainly.
 */
export function partnerNotes(input: {
  release: string | null;
  today: string;
  band: BudgetBand;
}): PartnerNote[] {
  const { release, today, band } = input;
  const lead = PARTNER_RULES.leadTime.value;
  const notes: PartnerNote[] = [];
  if (release) {
    const days = Math.round((Date.parse(release) - Date.parse(today)) / 86_400_000);
    if (Number.isFinite(days) && days > 0) {
      const months = Math.max(1, Math.round(days / 30.4));
      notes.push({
        id: 'partner-note-lead',
        ruleId: 'partners.lead-time',
        text:
          months >= lead.months
            ? `The release is about ${months} months away. ${lead.why}`
            : `The release is about ${months} months away, short of the ${lead.months} months specialists advise. ${lead.why} Expect big brands to be planned already.`,
      });
    }
  }
  if (band === 'micro' || band === 'independent') {
    notes.push({ id: 'partner-note-band', ruleId: 'partners.lead-time', text: lead.independent });
  }
  notes.push({ id: 'partner-note-barter', ruleId: 'partners.lead-time', text: lead.barter });
  return notes;
}

interface Row {
  name: string;
  city: string | null;
  place: number;
  of: number;
  popularity: number | null;
  finding: Finding;
}

function rankedBrands(findings: Finding[]): Row[] {
  return findings
    .filter((f) => f.query === 'brands')
    .flatMap((f) =>
      f.entities.map((e, i) => ({
        name: e.name,
        city: f.context.city,
        place: i + 1,
        of: f.entities.length,
        popularity: e.popularity ?? null,
        finding: f,
      })),
    );
}

/** Keeps each tier's reserved slots, then fills what is left in tier order. */
function reserve(options: PartnerOption[]): PartnerOption[] {
  const slots = PARTNER_RULES.slots.value;
  const tiers: PartnerTier[] = ['A', 'B', 'C'];
  const total = tiers.reduce((sum, t) => sum + slots[t], 0);
  const by = (t: PartnerTier) => options.filter((o) => o.tier === t);
  // A partner the team named is never cut, whatever the slots.
  const chosen = new Set([
    ...options.filter((o) => o.from === 'team'),
    ...tiers.flatMap((t) => by(t).slice(0, slots[t])),
  ]);
  for (const o of tiers.flatMap(by)) {
    if (chosen.size >= total) break;
    chosen.add(o);
  }
  return tiers.flatMap(by).filter((o) => chosen.has(o));
}

/**
 * The partners a plan can approach, each with its tier, the place Qloo gave it among the brands
 * ranked for this audience, and whether the budget band can carry it. Price is never known.
 * Flagship partners the band cannot carry are left out unless the team signed them. Each tier
 * keeps its reserved slots, so ranked brands cannot push the local partners out.
 */
export function partnerOptions(input: {
  findings: Finding[];
  signed: string[];
  band: BudgetBand;
  /** The markets of the plan's territories. Seeds are listed only for these. */
  markets: string[];
  /** The release country, for a partner Qloo did not place in a city. */
  home?: string | null;
  category: Category;
  tone?: Tone | null;
  ages?: string[];
}): { partners: PartnerOption[]; calls: DirectionCall[] } {
  const { findings, signed, band, markets, category } = input;
  const home = input.home ?? markets[0] ?? 'the home market';
  const tone = input.tone ?? null;
  const ages = input.ages ?? [];
  const rows = rankedBrands(findings);
  const best = (name: string): Row | undefined =>
    rows.filter((r) => same(r.name, name)).sort((a, b) => a.place / a.of - b.place / b.of)[0];

  const names: { name: string; from: PartnerOption['from']; market: string | null }[] = [
    ...signed.map((name) => ({ name, from: 'team' as const, market: null })),
    ...rows
      .map((r) => r.name)
      .filter((n, i, all) => all.findIndex((x) => same(x, n)) === i)
      .map((name) => ({ name, from: 'qloo' as const, market: null })),
    ...markets.flatMap((m) =>
      (['A', 'B'] as const).flatMap((t) =>
        (seedsFor(m)?.[t].names ?? []).map((name) => ({ name, from: 'seed' as const, market: m })),
      ),
    ),
  ].filter((n, i, all) => all.findIndex((x) => same(x.name, n.name)) === i);

  const calls: DirectionCall[] = [];
  const options: PartnerOption[] = names.flatMap(({ name, from, market }) => {
    const row = best(name);
    const tier = tierOf(name, row?.popularity ?? null);
    const budgetFit = budgetFitOf(band, tier);
    if (budgetFit === 'out' && from !== 'team') return [];
    const direction = row ? directionOf(rankVerdict(row.place, row.of)) : null;
    const id = `partner-${slug(name)}`;
    if (row && direction) {
      const teamChoice = from === 'team';
      const say =
        direction === 'avoid'
          ? teamChoice
            ? ' Keep it, and lead with the stronger partners beside it.'
            : ' Approach the higher ranked ones first.'
          : '';
      calls.push({
        id: `call-${id}`,
        subject: 'partner',
        name,
        direction,
        confidence: row.finding.confidence,
        why: `Ranked ${row.place} of ${row.of} brands for this audience${row.city ? ` in ${row.city}` : ''}.${say}`,
        findingIds: [row.finding.id],
        teamChoice,
        territory: row.city,
      });
    }
    return [
      {
        id,
        name,
        tier,
        // The market it was ranked in, else the seed's own, else the release country.
        market: (row?.city ? cityCountry(row.city) : null) ?? market ?? home,
        from,
        fit: row && direction ? { place: row.place, of: row.of, direction } : null,
        budgetFit,
        price: 'unknown' as const,
        findingIds: row ? [row.finding.id] : [],
        kind: 'brand' as const,
        flags: flagsOf({ name, tier, kind: 'brand', tone, ages }),
      },
    ];
  });

  // Kinds of partner with no fixed name: what each tier can approach before a brand is chosen.
  const kinds = (tier: 'B' | 'C', market: string, list: string[], id: string): PartnerOption[] =>
    list.map((kind) => ({
      id: `${id}-${slug(kind)}`,
      name: sentence(kind),
      tier,
      market,
      from: 'seed' as const,
      fit: null,
      budgetFit: budgetFitOf(band, tier),
      price: 'unknown' as const,
      findingIds: [],
      kind: 'kind' as const,
      flags: flagsOf({ name: kind, tier, kind: 'kind', tone, ages }),
    }));
  const own = CATEGORY_PARTNERS[category].value;
  const kindsB = kinds(
    'B',
    home,
    [...new Set([...own.bKinds, ...markets.flatMap((m) => seedsFor(m)?.B.kinds ?? [])])],
    'partner-b',
  );
  const kindsC = markets.flatMap((m) =>
    kinds(
      'C',
      m,
      [...new Set([...own.cKinds, ...(seedsFor(m)?.C.kinds ?? [])])],
      `partner-c-${slug(m)}`,
    ),
  );

  return { partners: reserve([...options, ...kindsB, ...kindsC]), calls };
}

/** The partner ids each territory carries: the partners Qloo ranked in its city. */
export function withPartnerIds(territories: Territory[], calls: DirectionCall[]): Territory[] {
  return territories.map((t) => ({
    ...t,
    partnerIds: calls
      .filter(
        (c) =>
          c.subject === 'partner' &&
          c.territory &&
          c.territory.toLowerCase() === t.name.toLowerCase(),
      )
      .map((c) => `partner-${c.id.replace(/^call-partner-/, '')}`),
  }));
}

/**
 * A saved plan with the team's own partners changed to exactly `names`. Nothing new is asked of
 * Qloo: a name is placed from the brands the plan already ranked, and one it did not rank shows
 * as not ranked until a partner brief scores it. Partners Oraqul suggested are left as they were.
 */
export function withTeamPartners(
  plan: LaunchPlan,
  names: string[],
  category: Category,
): LaunchPlan {
  const wanted = names
    .map((n) => n.trim())
    .filter((n, i, all) => n && all.findIndex((x) => same(x, n)) === i);
  const isWanted = (name: string) => wanted.some((n) => same(n, name));
  const kept = plan.partners.filter((p) => p.from !== 'team' || isWanted(p.name));
  const fresh = wanted.filter((n) => !kept.some((p) => p.from === 'team' && same(p.name, n)));
  const markets = marketsOf(
    null,
    plan.territories.map((t) => t.name),
  );
  const built = partnerOptions({
    findings: plan.findings,
    signed: fresh,
    band: plan.band?.band ?? 'independent',
    markets: [],
    home: markets[0] ?? null,
    category,
  });
  const added = built.partners.filter((p) => p.from === 'team');
  const rest = kept.filter((p) => !added.some((a) => same(a.name, p.name)));
  const calls = [
    ...plan.calls.filter(
      (c) =>
        c.subject !== 'partner' ||
        (!(c.teamChoice && !isWanted(c.name)) && !added.some((a) => same(a.name, c.name))),
    ),
    ...built.calls.filter((c) => added.some((a) => same(a.name, c.name))),
  ];
  return {
    ...plan,
    partners: reserve([...added, ...rest]),
    calls,
    territories: withPartnerIds(plan.territories, calls),
  };
}

/**
 * The pitch kit for one partner (T3, T4). Code writes it from the category's partner rules, the
 * release date and today; the only line that claims anything is `why`, which cites the finding
 * that ranked the partner. The ideas are offered for the partner to shape, not to accept.
 */
export function partnerKit(input: {
  name: string;
  category: Category;
  why: { text: string; findingIds: string[] };
  script: string;
  release: string | null;
  today: string;
}): PartnerKit {
  const { name, category, why, script, release, today } = input;
  const own = CATEGORY_PARTNERS[category].value;
  const lead = PARTNER_RULES.leadTime.value;
  return {
    why,
    gets: own.gets,
    ask: `Ask ${name} for a call to talk through what a partnership could be, and say whether you are hoping for cash, product, a venue or reach. ${lead.barter}`,
    timeline: [
      `Now (${today}): send the pitch and ask for a call.`,
      'Before the campaign starts: agree the idea, and what each side makes and pays for.',
      release
        ? `Release (${release}): announce together on both sides’ channels.`
        : 'Release: announce together on both sides’ channels.',
      'After release: share what happened with the partner.',
    ],
    ideas: own.ideas.slice(0, 2),
    script,
    room: PARTNER_RULES.pitch.value.room,
  };
}
