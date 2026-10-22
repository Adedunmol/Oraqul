import {
  audienceOutputSchema,
  rankPlacesOutputSchema,
  searchEntityOutputSchema,
  type ToolContext,
  tools,
} from '@oraqul/engine';
import type { Category, Finding, QlooEntityType, Receipt } from '@oraqul/schema';
import type { LaunchBrief } from './brief.js';
import { ageLabel, round2, slug } from './brief.js';
import { entity, numbersIn } from './findings.js';
import { list } from './text.js';

/**
 * One question a category agent may put to another (spec §3.4): how a named title or artist from
 * the other side compares with this launch's audience and cities. Offers are made by code from
 * names the team gave; the research check may pick among them but cannot add one.
 */
export interface ConsultOffer {
  /** Stable, so the same brief offers the same consults in the same order. */
  id: string;
  /** The side that answers: its own tests run on the named entity. */
  category: Category;
  types: QlooEntityType[];
  name: string;
  /** Why the team's brief makes this worth asking, in plain words. */
  why: string;
}

export interface Consulted {
  findings: Finding[];
  receipts: Receipt[];
  /** False when Qloo did not know the name or returned nothing to compare. */
  found: boolean;
}

const MAX_CITIES = 5;

const SIDE: Record<string, Category> = {
  'urn:entity:artist': 'music',
  'urn:entity:movie': 'film',
  'urn:entity:tv_show': 'film',
  'urn:entity:podcast': 'podcasts',
  'urn:entity:book': 'books',
  'urn:entity:videogame': 'games',
};

/**
 * Runs the other side's own tests (the audience skew and the ranking of this launch's cities) on
 * the entity the offer names. Findings cite their receipts like any other. A failed call is a
 * miss, never a guess.
 */
export async function runConsult(
  ctx: ToolContext,
  brief: Pick<LaunchBrief, 'ages' | 'teamOrder'>,
  offer: ConsultOffer,
  emit: (finding: Finding) => void,
): Promise<Consulted> {
  const findings: Finding[] = [];
  const receipts: Receipt[] = [];
  const none: Consulted = { findings, receipts, found: false };

  const found = await tools.searchEntity
    .run(ctx, { name: offer.name, types: offer.types })
    .catch(() => null);
  if (!found) return none;
  const top = searchEntityOutputSchema
    .parse(found.data)
    .candidates.find((c) => c.name.toLowerCase() === offer.name.toLowerCase());
  receipts.push(...found.receipts);
  if (!top) return none;
  // A name that could be an artist, a film or a series is asked of the side Qloo says it belongs to.
  const side = top.types.map((t) => SIDE[t]).find(Boolean) ?? offer.category;

  const keep = (
    finding: Omit<Finding, 'callIds' | 'numbers' | 'context'> & { numbers: Record<string, number> },
    call: Receipt,
  ) => {
    const full: Finding = {
      ...finding,
      numbers: { ...numbersIn(finding.text), ...finding.numbers },
      context: { city: null, ages: [], tags: [], country: null, yearFrom: null, audience: null },
      callIds: [call.callId],
    };
    findings.push(full);
    receipts.push({
      ...call,
      lineId: full.id,
      rule: `${full.text} ${call.rule}`,
      confidence: full.confidence,
    });
    emit(full);
  };

  const audience = await tools.audienceBySegment
    .run(ctx, { entityIds: [top.entityId] })
    .catch(() => null);
  const out = audience ? audienceOutputSchema.parse(audience.data) : null;
  const [audienceCall] = audience?.receipts ?? [];
  const segment = out?.segments[0];
  const band = segment?.topAgeBand;
  if (out && audienceCall && segment && band) {
    const readers = Object.entries(brief.ages).sort(([, a], [, b]) => b - a)[0]?.[0];
    const against = readers
      ? band === readers
        ? `, the same age band as your audience`
        : `, where your audience peaks at ${ageLabel(readers).toLowerCase()}`
      : '';
    keep(
      {
        id: `f-consult-${side}-audience-${slug(offer.name)}`,
        query: 'consult',
        text: `Asked of the ${side} side, ${offer.name}'s audience peaks at ${ageLabel(band).toLowerCase()}${against}.`,
        entities: [entity(offer.name, null, `${side} consult`, top.entityId)],
        numbers: { [`affinity ${band}`]: round2(segment.age[band] ?? 0) },
        verdict: null,
        confidence: out.confidence,
        why: out.why,
      },
      audienceCall,
    );
  }

  const cities = brief.teamOrder.map((p) => p.place).slice(0, MAX_CITIES);
  if (cities.length > 0) {
    const placed = await tools.rankPlaces
      .run(ctx, { entityIds: [top.entityId], places: cities })
      .catch(() => null);
    const ranked = placed
      ? rankPlacesOutputSchema
          .parse(placed.data)
          .places.filter((p) => p.status === 'ranked' && p.lift !== null)
          .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      : [];
    const [placeCall] = placed?.receipts ?? [];
    const first = ranked[0];
    if (placeCall && first) {
      keep(
        {
          id: `f-consult-${side}-places-${slug(offer.name)}`,
          query: 'consult',
          text: `Of your cities, ${offer.name}'s audience concentrates most in ${list(
            ranked.slice(0, 3).map((p) => `${p.place} (${round2(p.lift ?? 0)}x)`),
          )}.`,
          entities: ranked.map((p) => entity(p.place, p.affinity, null)),
          numbers: Object.fromEntries(ranked.map((p) => [`lift ${p.place}`, round2(p.lift ?? 0)])),
          verdict: null,
          confidence: first.confidence,
          why: first.why,
        },
        placeCall,
      );
    }
  }
  return { findings, receipts, found: findings.length > 0 };
}
