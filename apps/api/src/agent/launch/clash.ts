import {
  resolveBundleOutputSchema,
  rivalTypeOf,
  scoreRivalsOutputSchema,
  type ToolContext,
  tools,
} from '@oraqul/engine';
import type { Finding, QlooEntityType, Receipt, RivalDate } from '@oraqul/schema';
import { slug } from './brief.js';

/** A rival release the team named, with the day it opens. */
export interface Rival {
  title: string;
  date: string;
}

// "Rival: Salt Road 2 on 2027-03-12" or "Rivals: A on 2027-03-12; B opens 2027-03-19". The date
// is the person's own: Qloo holds no release calendar (spec §5).
const RIVAL_LINE = /^[ \t>*-]*rivals?\b[^\n:]*:?[ \t]*(.+)$/gim;
const RIVAL_ITEM =
  /([^,;\n()]+?)\s*(?:\bon\b|\bopens?\b|\bopening\b|\breleases?\b|\breleased\b|\(|-|–|—|:)\s*(\d{4}-\d{2}-\d{2})\)?/gi;

/** The rivals a brief names with a day, read by form so no model has to guess a date. */
export function rivalsFrom(text: string): Rival[] {
  const found: Rival[] = [];
  for (const line of text.matchAll(RIVAL_LINE)) {
    for (const item of (line[1] ?? '').matchAll(RIVAL_ITEM)) {
      const title = (item[1] ?? '').replace(/^[\s"“'‘]+|[\s"”'’]+$/g, '').replace(/^and\s+/i, '');
      const date = item[2];
      if (!title || !date || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) continue;
      if (!found.some((r) => r.title.toLowerCase() === title.toLowerCase() && r.date === date)) {
        found.push({ title, date });
      }
    }
  }
  return found;
}

const BAND = { risky: 'high', moderate: 'moderate', low: 'low' } as const;

export function adviceFor(band: RivalDate['band']): string {
  return band === 'high'
    ? 'Avoid this week: the rival shares much of your audience.'
    : band === 'moderate'
      ? 'Possible, with a campaign that sets your title apart.'
      : 'Safe: little shared audience.';
}

export interface Clash {
  lines: RivalDate[];
  /** The distinct opening days, oldest first. `RivalDate.week` indexes it. */
  weeks: string[];
  /** The day with the least shared audience with any rival. */
  chosen: string;
  /** Rivals Qloo did not find by name, or did not score. */
  missing: string[];
  receipts: Receipt[];
  /** The call every line rests on. Null when nothing could be scored. */
  call: Receipt | null;
  confidence: Finding['confidence'];
  why: string;
}

/**
 * Scores each rival against the anchors in one call (spec §5), so the overlaps are comparable.
 * The rival's date is the person's; Qloo only says how much of the audience is shared.
 */
export async function scoreClash(
  tc: ToolContext,
  anchors: string[],
  rivals: Rival[],
  rivalTypes: readonly QlooEntityType[],
): Promise<Clash> {
  const rivalType = rivalTypeOf(rivalTypes);
  const receipts: Receipt[] = [];
  const empty: Clash = {
    lines: [],
    weeks: [],
    chosen: '',
    missing: rivals.map((r) => r.title),
    receipts,
    call: null,
    confidence: 'lower',
    why: 'no rival was scored',
  };
  if (rivals.length === 0 || !rivalType) return empty;

  const found = await tools.resolveBundle.run(tc, {
    names: rivals.map((r) => r.title),
    types: [...rivalTypes],
  });
  receipts.push(...found.receipts);
  const anchorsFound = resolveBundleOutputSchema.parse(found.data).anchors;
  const resolved = rivals.flatMap((r) => {
    const a = anchorsFound.find((x) => x.name === r.title);
    return a?.status === 'found' && a.entityId ? [{ ...r, entityId: a.entityId }] : [];
  });
  if (resolved.length === 0) return { ...empty, receipts };

  const scored = await tools.scoreRivals.run(tc, {
    entityIds: anchors,
    type: rivalType,
    rivals: resolved.map((r) => r.entityId),
  });
  receipts.push(...scored.receipts);
  const data = scoreRivalsOutputSchema.parse(scored.data);
  const [call] = scored.receipts;

  const weeks = [...new Set(resolved.map((r) => r.date))].sort();
  const lines: RivalDate[] = resolved.flatMap((r) => {
    const row = data.rivals.find((x) => x.entityId === r.entityId);
    if (!row || row.overlap === null || row.band === null) return [];
    const band = BAND[row.band];
    return [
      {
        id: `date-${r.date}-${slug(r.title)}`,
        date: r.date,
        week: weeks.indexOf(r.date),
        rival: row.name,
        overlap: row.overlap,
        band,
        advice: adviceFor(band),
      },
    ];
  });
  // A day is as risky as its riskiest rival; the safest day is the one to open on.
  const worstOf = (date: string) =>
    Math.max(...lines.filter((l) => l.date === date).map((l) => l.overlap));
  const chosen = [...new Set(lines.map((l) => l.date))].sort((a, b) => worstOf(a) - worstOf(b))[0];
  const scoredTitles = new Set(lines.map((l) => l.rival));
  return {
    lines,
    weeks,
    chosen: chosen ?? '',
    missing: rivals.filter((r) => !scoredTitles.has(r.title)).map((r) => r.title),
    receipts,
    call: call ?? null,
    confidence: data.confidence,
    why: data.why,
  };
}

const round = (n: number) => Math.round(n);

/** The clash as a finding, built by code from the one scoring call, so a plan line can cite it. */
export function clashFinding(clash: Clash): Finding | null {
  if (!clash.call || clash.lines.length === 0) return null;
  const sorted = [...clash.lines].sort((a, b) => b.overlap - a.overlap);
  const parts = sorted.map(
    (l) => `${l.rival} on ${l.date} (shared audience ${round(l.overlap)}, ${l.band})`,
  );
  return {
    id: 'f-clash',
    query: 'clash',
    text: `Against the rivals you named, your comps' audience overlaps most with ${parts.join('; ')}.`,
    entities: sorted.map((l) => ({
      entityId: null,
      name: l.rival,
      affinity: l.overlap / 100,
      detail: l.date,
    })),
    numbers: Object.fromEntries(sorted.map((l) => [`overlap ${l.rival}`, round(l.overlap)])),
    verdict: null,
    confidence: clash.confidence,
    why: clash.why,
    context: { city: null, ages: [], tags: [], country: null, yearFrom: null, audience: null },
    callIds: [clash.call.callId],
  };
}
