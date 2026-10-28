import type { Finding, PartnerCheck } from '@oraqul/schema';
import { type VenueCheck, venueKey } from '../../verify/venue-check.js';
import type { Verifier } from '../../verify/verifier.js';
import type { Grounded } from './findings.js';
import { list } from './text.js';

const BRAND_QUERIES = new Set(['brands', 'brands-city']);

/** The brand names in the findings, in the order they appear, once each. */
export function brandNames(findings: Finding[]): string[] {
  return [
    ...new Set(
      findings
        .filter((f) => BRAND_QUERIES.has(f.query))
        .flatMap((f) => f.entities.map((e) => e.name)),
    ),
  ];
}

/**
 * Checks the brands Qloo ranked and takes out any that no longer exist, before the writer or the
 * partner code can see them. A finding whose sentence named one is reworded from what is left, so
 * the name does not survive in the text. Everything else passes through with its check, because a
 * source that is down, or a brand it cannot place, must never change a plan.
 */
export async function verifyBrands(
  verifier: Verifier | undefined,
  grounded: Grounded,
): Promise<{ grounded: Grounded; checks: Record<string, PartnerCheck> }> {
  if (!verifier) return { grounded, checks: {} };
  const names = brandNames(grounded.findings);
  if (names.length === 0) return { grounded, checks: {} };
  const checked = await verifier.brands(names);
  const checks = Object.fromEntries(checked);
  const closed = new Set(names.filter((n) => checked.get(n)?.state === 'problem'));
  if (closed.size === 0) return { grounded, checks };
  const findings = grounded.findings.map((f) => {
    if (!BRAND_QUERIES.has(f.query) || !f.entities.some((e) => closed.has(e.name))) return f;
    const entities = f.entities.filter((e) => !closed.has(e.name));
    const city = f.context.city;
    const top = list(entities.slice(0, 3).map((e) => e.name));
    const text =
      entities.length === 0
        ? `No brand asked about in ${city ?? 'this market'} is still trading.`
        : f.query === 'brands'
          ? `For this audience${city ? ` in ${city}` : ''}, Qloo ranks ${top} highest among the brands asked.`
          : `Among the same brands, people${city ? ` in ${city}` : ''} overall like ${top} best. This is taste for the place, not for your comps.`;
    return { ...f, entities, text };
  });
  return {
    grounded: {
      ...grounded,
      findings: findings.filter((f) => f.entities.length > 0 || !BRAND_QUERIES.has(f.query)),
    },
    checks,
  };
}

const VENUE_TAGS = new Set(['movie theater', 'cinema']);
/** The places looked up per list: the first few are the ones the plan names. */
const VENUES_PER_LIST = 5;

/**
 * Checks the cinemas Qloo listed against OpenStreetMap and takes out any that is a stage theatre or
 * a hall, not a screen. A venue it cannot find stays: the map is missing many places, and a
 * missing one says nothing about the venue.
 */
export async function verifyVenues(
  verifier: Verifier | undefined,
  grounded: Grounded,
): Promise<{ grounded: Grounded; removed: string[] }> {
  if (!verifier) return { grounded, removed: [] };
  const lists = grounded.findings.filter(
    (f) => f.query === 'venues' && f.context.city && f.context.tags.some((t) => VENUE_TAGS.has(t)),
  );
  const items = lists.flatMap((f) =>
    f.entities.slice(0, VENUES_PER_LIST).map((e) => ({ name: e.name, city: f.context.city ?? '' })),
  );
  if (items.length === 0) return { grounded, removed: [] };
  const checked: Map<string, VenueCheck> = await verifier.venues(items);
  const bad = (name: string, city: string | null | undefined) =>
    checked.get(venueKey({ name, city: city ?? '' }))?.state === 'problem';
  const removed: string[] = [];
  const findings = grounded.findings.map((f) => {
    if (!lists.includes(f) || !f.entities.some((e) => bad(e.name, f.context.city))) return f;
    for (const e of f.entities) if (bad(e.name, f.context.city)) removed.push(e.name);
    const entities = f.entities.filter((e) => !bad(e.name, f.context.city));
    const text = entities.length
      ? `In ${f.context.city}, the cinemas that rank highest with your comps' audience are ${list(entities.slice(0, 3).map((e) => e.name))}.`
      : `No cinema in ${f.context.city} could be confirmed for this audience.`;
    return { ...f, entities, text };
  });
  return { grounded: { ...grounded, findings }, removed };
}
