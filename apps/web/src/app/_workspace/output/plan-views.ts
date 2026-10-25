import type { Finding, LaunchLine, LaunchPlan, Place } from '@oraqul/schema';

const key = (text: string) => text.trim().toLowerCase();

export interface TerritoryPlan {
  place: Place;
  /** 1 is where the audience is strongest. */
  rank: number;
  /** The plan's lines for this territory, under the section they sit in. */
  parts: { section: string; lines: LaunchLine[] }[];
  /** What Qloo returned for this territory alone, such as its cinemas or partner brands. */
  findings: Finding[];
}

/**
 * One plan per territory, made of the plan's own lines: a line belongs to a territory when it is
 * grouped under it or rests only on findings asked for that city. Nothing is written here, so a
 * line keeps the receipt it already had.
 */
export function territoriesOf(plan: LaunchPlan, places: Place[]): TerritoryPlan[] {
  const cityOf = new Map(plan.findings.map((f) => [f.id, f.context.city]));
  return [...places]
    .sort((a, b) => b.lift - a.lift)
    .map((place, i) => {
      const mine = (line: LaunchLine) => {
        if (line.group && key(line.group) === key(place.name)) return true;
        const cities = new Set(line.findingIds.map((id) => cityOf.get(id)).filter(Boolean));
        return cities.size === 1 && [...cities].every((c) => key(c ?? '') === key(place.name));
      };
      return {
        place,
        rank: i + 1,
        parts: plan.sections
          .filter((s) => s.key !== 'bottom-line' && s.key !== 'gaps')
          .map((s) => ({ section: s.title, lines: s.lines.filter(mine) }))
          .filter((p) => p.lines.length > 0),
        findings: plan.findings.filter(
          (f) => f.context.city && key(f.context.city) === key(place.name),
        ),
      };
    });
}

export interface SupportGridView {
  cities: string[];
  rows: {
    name: string;
    /** Qloo's affinity for the act in each city, 0 to 100, or null when the city's list left it out. */
    values: (number | null)[];
    /** Shade step per city, 0 (weakest) to 3 (strongest), or null. */
    levels: (number | null)[];
    average: number;
    /** The findings that list the act, to open their receipts. */
    findingIds: string[];
  }[];
}

const MAX_ACTS = 8;

/** The acts the support findings list, across the tour cities. Null when no city has a list. */
export function supportActsOf(plan: LaunchPlan): SupportGridView | null {
  const lists = plan.findings.filter((f) => f.query === 'support' && f.context.city);
  const cities = [...new Set(lists.map((f) => f.context.city as string))];
  if (cities.length === 0) return null;
  const acts = new Map<string, { name: string; at: Map<string, { v: number; id: string }> }>();
  for (const f of lists) {
    for (const e of f.entities) {
      if (e.affinity === null) continue;
      const act = acts.get(key(e.name)) ?? { name: e.name, at: new Map() };
      act.at.set(key(f.context.city as string), { v: Math.round(e.affinity * 100), id: f.id });
      acts.set(key(e.name), act);
    }
  }
  const all = [...acts.values()]
    .flatMap((a) => [...a.at.values()].map((x) => x.v))
    .sort((a, b) => a - b);
  const level = (v: number) => {
    const at = all.indexOf(v) / Math.max(all.length - 1, 1);
    return at >= 0.75 ? 3 : at >= 0.5 ? 2 : at >= 0.25 ? 1 : 0;
  };
  const rows = [...acts.values()]
    .map((a) => {
      const values = cities.map((c) => a.at.get(key(c))?.v ?? null);
      const known = values.filter((v): v is number => v !== null);
      return {
        name: a.name,
        values,
        levels: values.map((v) => (v === null ? null : level(v))),
        average: Math.round(known.reduce((s, v) => s + v, 0) / known.length),
        count: known.length,
        findingIds: [...a.at.values()].map((x) => x.id),
      };
    })
    .sort((a, b) => b.count - a.count || b.average - a.average)
    .slice(0, MAX_ACTS)
    .map(({ count: _count, ...row }) => row);
  return { cities, rows };
}

export interface ProcessView {
  /** One entry per research round, as plain sentences. */
  research: { title: string; steps: string[] }[];
  /** One entry per red-team round, as plain sentences. */
  review: { title: string; steps: string[] }[];
  /** Lines the check removed from a draft, so no removal is silent. */
  dropped: { draft: number; text: string; why: string }[];
  drafts: number;
}

const found = (yes: boolean) => (yes ? 'Qloo had an answer.' : 'Qloo had nothing for it.');

const REVIEW_ACTION: Record<NonNullable<LaunchPlan['review']>['rounds'][number]['action'], string> =
  {
    approved: 'The draft passed.',
    rewrote: 'The plan was written again with these points.',
    researched: 'More Qloo evidence was asked for, then the plan was written again.',
    stopped: 'The same point came back, so the draft was kept with it open.',
  };

/**
 * How the plan was made, in the person's terms: what each research round was missing and ran, what
 * the red team said about each draft and what was done, and the lines the check removed. All of it
 * is read from what the plan saved.
 */
export function processOf(plan: Pick<LaunchPlan, 'process' | 'review'>): ProcessView | null {
  const { process, review } = plan;
  if (!process && !review) return null;
  const research = (process?.research ?? []).map((r) => ({
    title: `Research round ${r.round}`,
    steps: [
      r.open.length ? `Still open: ${r.open.join('; ')}.` : 'Nothing was open.',
      ...r.asked.map(
        (a) => `Asked Qloo for ${a.label}, because ${a.why.replace(/\.$/, '')}. ${found(a.found)}`,
      ),
      ...r.retried.map((a) => `Asked again for ${a.label} ${a.says}. ${found(a.found)}`),
      ...r.consulted.map((c) => `Asked the ${c.category} side about ${c.name}. ${found(c.found)}`),
    ],
  }));
  const rounds = (review?.rounds ?? []).map((r) => ({
    title: `Draft ${r.round}`,
    steps: [
      ...(r.issues.length
        ? r.issues.map((i) => `${i.blocking ? 'Blocking' : 'Noted'}: ${i.text}`)
        : ['No points raised.']),
      REVIEW_ACTION[r.action],
    ],
  }));
  const dropped = process?.dropped ?? [];
  if (research.length === 0 && rounds.length === 0 && dropped.length === 0) return null;
  return { research, review: rounds, dropped, drafts: process?.drafts ?? rounds.length };
}
