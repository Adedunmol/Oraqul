import { cityCountry } from '@oraqul/engine';
import {
  type BudgetBand,
  bandCarries,
  FLAGSHIPS,
  PARTNER_SEEDS,
  type PartnerTier,
} from '@oraqul/packs';
import type { DirectionCall, Finding, PartnerOption } from '@oraqul/schema';
import { normalise } from '../router/decide.js';
import { rankVerdict } from './audit-verdicts.js';
import { slug } from './brief.js';
import { directionOf } from './direction.js';
import type { QueryPlanCore } from './planner.js';

const MAX_OPTIONS = 14;

const same = (a: string, b: string) => normalise(a) === normalise(b);

const seedsFor = (market: string) => PARTNER_SEEDS[market.toLowerCase()];

/** The markets the plan reaches: the release country and the country of each city. */
export function marketsOf(country: string | null, cities: string[]): string[] {
  const all = [country, ...cities.map((c) => cityCountry(c))].flatMap((c) => (c ? [c] : []));
  return all.filter((c, i) => all.findIndex((x) => same(x, c)) === i);
}

/** A tier for a brand by name: flagship names are tier A, any other brand is category and integration. */
export function tierOf(name: string): PartnerTier {
  return FLAGSHIPS.some((f) => same(f, name)) ? 'A' : 'B';
}

/** Whether a budget band can carry a tier. A near miss is a stretch and a far one is out. */
export function budgetFitOf(band: BudgetBand, tier: PartnerTier): PartnerOption['budgetFit'] {
  if (bandCarries(band, tier)) return tier === 'B' && band === 'micro' ? 'stretch' : 'fits';
  return band === 'independent' ? 'stretch' : 'out';
}

/**
 * Adds the seeded partners for each city's market to the brands Qloo is asked to rank, so a seed
 * gets a measured fit. A flagship is added only when the band can carry it. The team's own
 * candidates come first, and one call still resolves them all.
 */
export function withSeeds<P extends QueryPlanCore>(plan: P, band: BudgetBand, cities: string[]): P {
  const seeded = (city: string): string[] => {
    const country = cityCountry(city);
    const seeds = country ? seedsFor(country) : undefined;
    if (!seeds) return [];
    return [...(bandCarries(band, 'A') ? seeds.A.names : []), ...seeds.B.names];
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

interface Row {
  name: string;
  city: string | null;
  place: number;
  of: number;
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
        finding: f,
      })),
    );
}

/**
 * The partners a plan can approach, each with its tier, the place Qloo gave it among the brands
 * ranked for this audience, and whether the budget band can carry it. Price is never known.
 * Flagship partners the band cannot carry are left out unless the team signed them.
 */
export function partnerOptions(input: {
  findings: Finding[];
  signed: string[];
  band: BudgetBand;
  markets: string[];
}): { partners: PartnerOption[]; calls: DirectionCall[] } {
  const { findings, signed, band, markets } = input;
  const home = markets[0] ?? 'the home market';
  const rows = rankedBrands(findings);
  const best = (name: string): Row | undefined =>
    rows.filter((r) => same(r.name, name)).sort((a, b) => a.place / a.of - b.place / b.of)[0];

  const names: { name: string; from: PartnerOption['from'] }[] = [
    ...signed.map((name) => ({ name, from: 'team' as const })),
    ...rows
      .map((r) => r.name)
      .filter((n, i, all) => all.findIndex((x) => same(x, n)) === i)
      .map((name) => ({ name, from: 'qloo' as const })),
    ...markets.flatMap((m) =>
      (['A', 'B'] as const).flatMap((t) =>
        (seedsFor(m)?.[t].names ?? []).map((name) => ({ name, from: 'seed' as const })),
      ),
    ),
  ].filter((n, i, all) => all.findIndex((x) => same(x.name, n.name)) === i);

  const calls: DirectionCall[] = [];
  const options: PartnerOption[] = names.flatMap(({ name, from }) => {
    const tier = tierOf(name);
    const budgetFit = budgetFitOf(band, tier);
    if (budgetFit === 'out' && from !== 'team') return [];
    const row = best(name);
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
        market: home,
        from,
        fit: row && direction ? { place: row.place, of: row.of, direction } : null,
        budgetFit,
        price: 'unknown' as const,
        findingIds: row ? [row.finding.id] : [],
      },
    ];
  });

  // Tier C has no fixed names: the kinds of local partner an independent release can approach.
  const local: PartnerOption[] = markets.flatMap((m) =>
    (seedsFor(m)?.C.kinds ?? []).map((kind) => ({
      id: `partner-c-${slug(m)}-${slug(kind)}`,
      name: kind.charAt(0).toUpperCase() + kind.slice(1),
      tier: 'C' as const,
      market: m,
      from: 'seed' as const,
      fit: null,
      budgetFit: 'fits' as const,
      price: 'unknown' as const,
      findingIds: [],
    })),
  );

  const order: Record<PartnerTier, number> = { A: 0, B: 1, C: 2 };
  const partners = [...options, ...local]
    .sort((a, b) => order[a.tier] - order[b.tier])
    .slice(0, MAX_OPTIONS);
  return { partners, calls };
}
