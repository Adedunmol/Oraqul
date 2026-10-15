import type { Confidence, Verdict } from '@oraqul/schema';
import type {
  DAssumption,
  DAudience,
  DBrief,
  DCannot,
  DFit,
  DGaps,
  DRisk,
  EndpointKind,
} from './types';

export const A = (id: string, name: string, aff: number, ev: string): DAudience => ({
  id,
  name,
  aff,
  ev,
  k: 'demo',
});

export function F(
  id: string,
  name: string,
  fit: number,
  ev: string,
  k: EndpointKind,
  note?: string,
): DFit {
  return note ? { id, name, fit, ev, k, note } : { id, name, fit, ev, k };
}

export function AS(
  id: string,
  text: string,
  verdict: Verdict,
  why: string,
  fix: string,
  k: EndpointKind,
  ev: string,
  unstated = false,
): DAssumption {
  return { id, text, unstated, verdict, why, fix, k, ev };
}

export const RK = (id: string, text: string, signal: string, action: string): DRisk => ({
  id,
  text,
  signal,
  action,
});

export const CN = (id: string, item: string, reason: string): DCannot => ({ id, item, reason });

/** An even split that adds up to 100, with the remainder on the first group. */
export function defSplit(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [100];
  if (n === 2) return [62, 38];
  if (n === 3) return [50, 30, 20];
  const share = Math.floor(100 / n);
  const out = Array.from({ length: n }, () => share);
  out[0] = share + (100 - share * n);
  return out;
}

/** The hand-written split when it fits the number of groups, else an even one. */
export const fitArr = (arr: number[], n: number): number[] =>
  arr.length === n ? arr.slice() : defSplit(n);

export const lcf = (s: string): string =>
  /^(The|A|An|Your|Our|This|These|Most|Every|All|It|We|They|One|Two|Three)\b/.test(s)
    ? s.charAt(0).toLowerCase() + s.slice(1)
    : s;

export function topFit(list: DFit[]): DFit | undefined {
  return list.slice().sort((x, y) => y.fit - x.fit)[0];
}

export const splitList = (s: string): string[] =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

type Found =
  | { k: 'assumptions'; it: DAssumption }
  | { k: 'audience'; it: DAudience }
  | { k: 's1' | 's2' | 's3' | 's4' | 'bridge'; it: DFit }
  | { k: 'places'; it: DBrief['places'][number] }
  | { k: 'dates'; it: DBrief['dates'][number] }
  | { k: 'partners'; it: DBrief['partners'][number] }
  | { k: 'risks'; it: DRisk }
  | { k: 'shelf'; it: NonNullable<DBrief['shelf']>[number] }
  | { k: 'topics'; it: NonNullable<DBrief['topics']>[number] }
  | { k: 'grid'; it: NonNullable<DBrief['grid']>['rows'][number] }
  | { k: 'fan'; it: NonNullable<DBrief['fan']>[number] };

export type FoundLine = Found;

/** Finds a line by id in any group of the brief. */
export function findLine(b: DBrief, id: string): Found | undefined {
  const a = b.assumptions.find((x) => x.id === id);
  if (a) return { k: 'assumptions', it: a };
  const au = b.audience.find((x) => x.id === id);
  if (au) return { k: 'audience', it: au };
  for (const k of ['s1', 's2', 's3', 's4'] as const) {
    const f = b[k].find((x) => x.id === id);
    if (f) return { k, it: f };
  }
  const p = b.places.find((x) => x.id === id);
  if (p) return { k: 'places', it: p };
  const d = b.dates.find((x) => x.id === id);
  if (d) return { k: 'dates', it: d };
  const pa = b.partners.find((x) => x.id === id);
  if (pa) return { k: 'partners', it: pa };
  const r = b.risks.find((x) => x.id === id);
  if (r) return { k: 'risks', it: r };
  const sh = b.shelf?.find((x) => x.id === id);
  if (sh) return { k: 'shelf', it: sh };
  const br = b.bridge?.find((x) => x.id === id);
  if (br) return { k: 'bridge', it: br };
  const t = b.topics?.find((x) => x.id === id);
  if (t) return { k: 'topics', it: t };
  const g = b.grid?.rows.find((x) => x.id === id);
  if (g) return { k: 'grid', it: g };
  const fa = b.fan?.find((x) => x.id === id);
  if (fa) return { k: 'fan', it: fa };
  return undefined;
}

// Scenario code addresses lines the pack itself wrote, so a missing id is a bug in the pack.
export function assumption(b: DBrief, id: string): DAssumption | undefined {
  return b.assumptions.find((x) => x.id === id);
}

export function fitIn(list: DFit[], id: string): DFit | undefined {
  return list.find((x) => x.id === id);
}

/** One comparable string per line, so two briefs can be diffed line by line. */
export function flat(b: DBrief): Map<string, string> {
  const m = new Map<string, string>();
  for (const x of b.assumptions) m.set(x.id, `${x.verdict} | ${x.why}`);
  for (const x of b.audience) m.set(x.id, `affinity ${x.aff}`);
  for (const k of ['s1', 's2', 's3', 's4'] as const) {
    for (const x of b[k]) m.set(x.id, `fit ${x.fit}${x.note ? ` | ${x.note}` : ''}`);
  }
  for (const x of b.bridge ?? []) m.set(x.id, `fit ${x.fit}${x.note ? ` | ${x.note}` : ''}`);
  for (const x of b.shelf ?? []) m.set(x.id, `overlap ${x.ov}`);
  for (const x of b.places) {
    m.set(x.id, [`${x.lift.toFixed(1)}x lift`, x.date, x.aud, x.note].filter(Boolean).join(' | '));
  }
  for (const x of b.dates) m.set(x.id, `${x.overlap} | ${x.rec}`);
  for (const x of b.partners) m.set(x.id, x.ev);
  for (const x of b.risks) m.set(x.id, `${x.text} | ${x.signal}`);
  for (const x of b.topics ?? []) m.set(x.id, `${x.kind} weight ${x.w}`);
  for (const x of b.grid?.rows ?? []) {
    m.set(x.id, `lift ${x.vals.join(', ')}${x.tag ? ` | ${x.tag}` : ''}`);
  }
  for (const x of b.fan ?? []) {
    m.set(x.id, `overlap ${x.before} to ${x.after}${x.note ? ` | ${x.note}` : ''}`);
  }
  return m;
}

export function diffIds(a: DBrief, b: DBrief): string[] {
  const fa = flat(a);
  const out: string[] = [];
  for (const [id, value] of flat(b)) {
    if (fa.get(id) !== value) out.push(id);
  }
  if (a.chosenDate !== b.chosenDate) out.push('chosen');
  return out;
}

/** Scenarios can push a line that is already there; keep the first. */
export function dedupe(b: DBrief): void {
  const uniq = <T extends { id: string }>(list: T[]): T[] => {
    const seen = new Set<string>();
    return list.filter((x) => {
      if (seen.has(x.id)) return false;
      seen.add(x.id);
      return true;
    });
  };
  b.assumptions = uniq(b.assumptions);
  b.audience = uniq(b.audience);
  b.s1 = uniq(b.s1);
  b.s2 = uniq(b.s2);
  b.s3 = uniq(b.s3);
  b.s4 = uniq(b.s4);
  b.places = uniq(b.places);
  b.dates = uniq(b.dates);
  b.partners = uniq(b.partners);
  b.risks = uniq(b.risks);
  if (b.shelf) b.shelf = uniq(b.shelf);
  if (b.bridge) b.bridge = uniq(b.bridge);
  if (b.topics) b.topics = uniq(b.topics);
}

export function lowestPlanLines(b: DBrief): DFit[] {
  return [...b.s1, ...b.s2, ...b.s3, ...b.s4].sort((p, q) => p.fit - q.fit).slice(0, 3);
}

export function gaps(b: DBrief, actual: number[]): DGaps {
  const L = b.aLabels;
  const d = L.map((_, i) => (actual[i] ?? 0) - (b.planned[i] ?? 0));
  let w = 0;
  let s = 0;
  d.forEach((v, i) => {
    if (v < (d[w] ?? 0)) w = i;
    if (v > (d[s] ?? 0)) s = i;
  });
  return {
    W: L[w] ?? '',
    B: L[s] ?? '',
    wa: actual[w] ?? 0,
    wp: b.planned[w] ?? 0,
    ba: actual[s] ?? 0,
    bp: b.planned[s] ?? 0,
  };
}

export const confidenceWord: Record<Confidence, string> = {
  high: 'High',
  medium: 'Medium',
  lower: 'Lower',
};
