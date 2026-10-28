import { cityCountry } from '@oraqul/engine';
import type { Finding, PartnerCheck } from '@oraqul/schema';
import { presenceKey } from '../../verify/brand-presence.js';
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

/** A finding of ranked brands with some taken out, its sentence reworded from what is left. */
function without(f: Finding, gone: Set<string>, closedForever: boolean): Finding {
  if (!f.entities.some((e) => gone.has(e.name))) return f;
  const entities = f.entities.filter((e) => !gone.has(e.name));
  const city = f.context.city;
  const top = list(entities.slice(0, 3).map((e) => e.name));
  const text =
    entities.length === 0
      ? closedForever
        ? `No brand asked about in ${city ?? 'this market'} is still trading.`
        : `No brand asked about in ${city ?? 'this market'} could be confirmed as selling there.`
      : f.query === 'brands'
        ? `For this audience${city ? ` in ${city}` : ''}, Qloo ranks ${top} highest among the brands asked.`
        : `Among the same brands, people${city ? ` in ${city}` : ''} overall like ${top} best. This is taste for the place, not for the comps.`;
  return { ...f, entities, text };
}

const sameCountry = (a: string | null, b: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Brand lookups a plan may make, so a long list never turns into a long wait. */
const MAX_PRESENCE = 12;

/**
 * Checks the brands Qloo ranked and takes out any that no longer exist, before the writer or the
 * partner code can see them. A brand that Qloo ranked for a city is a taste fit, not proof that it
 * sells there, so each one not based in that city's country is looked up on the web, and one a
 * page says does not sell there is taken out of that city's list. Everything else passes through
 * with its check, because a source that is down, or a brand it cannot place, must never change a
 * plan. `keep` are brands the team named, which are never removed.
 */
export async function verifyBrands(
  verifier: Verifier | undefined,
  grounded: Grounded,
  keep: string[] = [],
): Promise<{ grounded: Grounded; checks: Record<string, PartnerCheck> }> {
  if (!verifier) return { grounded, checks: {} };
  const names = brandNames(grounded.findings);
  if (names.length === 0) return { grounded, checks: {} };
  const checked = await verifier.brands(names);
  const checks: Record<string, PartnerCheck> = Object.fromEntries(checked);
  const closed = new Set(names.filter((n) => checked.get(n)?.state === 'problem'));
  let findings = grounded.findings.map((f) =>
    BRAND_QUERIES.has(f.query) ? without(f, closed, true) : f,
  );

  const team = new Set(keep.map((k) => k.trim().toLowerCase()));
  const asked = new Map<string, { name: string; country: string }>();
  for (const f of findings) {
    if (!BRAND_QUERIES.has(f.query) || !f.context.city) continue;
    const country = cityCountry(f.context.city);
    if (!country) continue;
    for (const e of f.entities) {
      const based = checks[e.name];
      if (based?.state === 'verified' && sameCountry(based.country, country)) continue;
      asked.set(presenceKey(e.name, country), { name: e.name, country });
    }
  }
  const present = asked.size
    ? await verifier.presence([...asked.values()].slice(0, MAX_PRESENCE))
    : new Map();
  const absent = new Map<string, Set<string>>();
  for (const [key, found] of present) {
    const item = asked.get(key);
    if (!item || !found) continue;
    if (found.state === 'present' && found.source) {
      const check = checks[item.name] ?? {
        state: 'unverified',
        note: null,
        country: null,
        operates: [],
      };
      checks[item.name] = {
        ...check,
        operates: [...check.operates, { country: item.country, ...found.source }],
      };
    } else if (found.state === 'absent' && !team.has(item.name.trim().toLowerCase())) {
      absent.set(item.country, (absent.get(item.country) ?? new Set()).add(item.name));
    }
  }
  if (absent.size > 0) {
    findings = findings.map((f) => {
      const country = f.context.city ? cityCountry(f.context.city) : null;
      const gone = country ? absent.get(country) : undefined;
      return BRAND_QUERIES.has(f.query) && gone ? without(f, gone, false) : f;
    });
  }
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
