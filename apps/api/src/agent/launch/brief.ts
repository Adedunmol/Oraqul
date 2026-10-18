import {
  ageVerdict,
  audienceIndex,
  type audienceOutputSchema,
  averageBands,
  compsVerdict,
  genderVerdict,
  placeVerdict,
  type rankPlacesOutputSchema,
  type VerdictResult,
} from '@oraqul/engine';
import type {
  Assumption,
  AudienceSegment,
  Brief,
  Confidence,
  Place,
  Receipt,
  Risk,
  Untested,
  Verdict,
} from '@oraqul/schema';
import type { z } from 'zod';
import { type AgeBand, ageBands, type LaunchRead } from './read-core.js';

type AudienceData = z.infer<typeof audienceOutputSchema>;
type PlacesData = z.infer<typeof rankPlacesOutputSchema>;

/** One test's result: what came back and the call receipt behind it, or why it could not run. */
export type Tested<T> = { data: T; receipt: Receipt } | { data: null; why: string };

/** The words in a brief that differ by category. */
export interface BriefLabels {
  /** What the launch is, in "a strong market for this ___": film, series, title. */
  marketNoun: string;
  /** The unstated assumption that the anchors point to one audience. */
  compsClaim: string;
  /** The line that says sales and revenue are the person's own numbers. */
  sales: { item: string; reason: string };
}

export interface BriefResults<R extends LaunchRead = LaunchRead> {
  read: R;
  labels: BriefLabels;
  /** The comps Qloo found, with how well it knows each. */
  anchors: { entityId: string; name: string; popularity: number | null }[];
  dropped: { name: string; why: string }[];
  audience: Tested<AudienceData>;
  /** One heatmap call over the team's cities and the "Worth a look" cities. */
  places: Tested<PlacesData>;
  worthALook: string[];
}

export interface LaunchBrief {
  /** The Audience and Assumptions tabs. Plan sections live on the launch plan. */
  brief: Brief;
  /** One receipt per line, each a copy of the call behind it with the line's rule. */
  lineReceipts: Receipt[];
  /** Why each line has its confidence, by line id (spec §5.1). */
  reasons: Map<string, string>;
  /** The team's cities in order of lift, strongest first. Unranked cities are left out. */
  teamOrder: PlacesData['places'];
  /** "Worth a look" cities that beat the weakest of the team's, strongest first. */
  worth: PlacesData['places'];
  /** Average affinity per age band and per gender, over the comps that have a profile. */
  ages: Record<string, number>;
  genders: Record<string, number>;
}

const AGE_LABEL: Record<AgeBand, string> = {
  '24_and_younger': 'Aged 24 and under',
  '25_to_29': 'Aged 25 to 29',
  '30_to_34': 'Aged 30 to 34',
  '35_to_44': 'Aged 35 to 44',
  '45_to_54': 'Aged 45 to 54',
  '55_and_older': 'Aged 55 and over',
};

const AUDIENCE_RULE =
  'The index is 50 + 50 × the affinity Qloo gives this group, averaged over the comps that have a profile. 50 is neutral. It is a taste index, not a share of viewers.';
const PLACE_RULE =
  "Place lift is the city's mean cell affinity over the mean of every ranked city in the same call, so 1.0 is an average city. 1.2 and above holds, 1.0 to 1.2 is weak, below 1.0 breaks.";

const MAX_SEGMENTS = 6;

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');

const isAgeBand = (band: string): band is AgeBand => ageBands.some((b) => b === band);
export const ageLabel = (band: string): string =>
  isAgeBand(band) ? AGE_LABEL[band] : band.replaceAll('_', ' ');

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The team's decisions are tested, never replaced: a city that does not hold gets a fix within the
 * team's own cities (spec §5.2).
 */
export function buildBrief<R extends LaunchRead>(r: BriefResults<R>): LaunchBrief {
  const receipts: Receipt[] = [];
  const reasons = new Map<string, string>();
  const cite = (
    lineId: string,
    base: Receipt,
    rule: string,
    confidence: Confidence,
    reason: string,
  ) => {
    receipts.push({ ...base, lineId, rule, confidence });
    reasons.set(lineId, reason);
  };

  const ages = r.audience.data ? averageBands(r.audience.data.segments.map((s) => s.age)) : {};
  const genders = r.audience.data
    ? averageBands(r.audience.data.segments.map((s) => s.gender))
    : {};
  const audienceReceipt = r.audience.data ? r.audience.receipt : null;

  const audience: AudienceSegment[] = [
    ...Object.entries(ages).map(([band, value]) => ({
      id: `aud-${band}`,
      name: ageLabel(band),
      value,
    })),
    ...Object.entries(genders).map(([g, value]) => ({
      id: `aud-${g}`,
      name: g === 'female' ? 'Women' : g === 'male' ? 'Men' : g,
      value,
    })),
  ]
    .sort((a, b) => b.value - a.value)
    .slice(0, MAX_SEGMENTS)
    .map(({ id, name, value }) => ({
      id,
      name,
      affinity: audienceIndex(value),
      evidence: `Affinity ${value.toFixed(2)} across ${r.audience.data?.segments.length ?? 0} of ${r.anchors.length} comps`,
    }));
  if (audienceReceipt) {
    for (const s of audience) {
      cite(
        s.id,
        audienceReceipt,
        `${AUDIENCE_RULE} Confidence ${r.audience.data?.why ?? ''}.`,
        audienceReceipt.confidence,
        r.audience.data?.why ?? '',
      );
    }
  }

  const placeRows = r.places.data?.places ?? [];
  const placesReceipt = r.places.data ? r.places.receipt : null;
  const ranked = placeRows
    .filter((p) => p.status === 'ranked' && p.lift !== null && p.band !== null)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const isTeam = (place: string) => r.read.places.some((p) => same(p, place));
  const teamOrder = ranked.filter((p) => isTeam(p.place));
  const weakest = teamOrder.at(-1)?.lift ?? Number.POSITIVE_INFINITY;
  const worth = ranked.filter(
    (p) =>
      !isTeam(p.place) &&
      r.worthALook.some((w) => same(w, p.place)) &&
      (p.lift ?? 0) > weakest &&
      p.band !== 'weak',
  );

  const places: Place[] = teamOrder.map((p) => ({
    id: `place-${slug(p.place)}`,
    name: p.place,
    lift: round2(p.lift ?? 0),
    band: p.band ?? 'weak',
    audience: audience[0]?.name ?? 'The comps’ audience',
    confidence: p.confidence,
    note: `${p.cells} cells. ${p.why}`,
  }));
  if (placesReceipt) {
    for (const p of teamOrder) {
      cite(
        `place-${slug(p.place)}`,
        placesReceipt,
        `${PLACE_RULE} Confidence ${p.why}.`,
        p.confidence,
        p.why,
      );
    }
  }

  const assumptions: Assumption[] = [];
  const add = (
    id: string,
    text: string,
    result: VerdictResult,
    fix: string,
    unstated: boolean,
    receipt: Receipt | null,
    confidence: Confidence,
    reason: string,
  ) => {
    assumptions.push({
      id,
      text,
      verdict: result.verdict,
      why: result.why,
      fix: result.verdict === 'holds' ? '' : fix,
      unstated,
    });
    if (receipt && result.verdict !== 'cant') {
      cite(id, receipt, `${result.why} Confidence ${reason}.`, confidence, reason);
    } else if (receipt) {
      cite(
        id,
        receipt,
        `Could not test: ${result.why}`,
        'lower',
        'lower: this line could not be tested',
      );
    }
  };

  if (r.read.ages.length) {
    const results = r.read.ages.map((band) => ageVerdict(band, ages));
    const best = results.sort((a, b) => order(b.verdict) - order(a.verdict))[0];
    const strongest = r.read.ages
      .filter((band) => ages[band] !== undefined)
      .sort((a, b) => (ages[b] ?? 0) - (ages[a] ?? 0))[0];
    const text = `The audience is ${r.read.ages.map((b) => ageLabel(b).toLowerCase()).join(', ')}`;
    if (best) {
      add(
        'a-age',
        text,
        r.audience.data ? best : { verdict: 'cant', why: whyNot(r.audience) },
        strongest
          ? `Keep your age band, and lead the creative with people ${ageLabel(strongest).toLowerCase()}, the strongest part of it.`
          : '',
        false,
        audienceReceipt,
        audienceReceipt?.confidence ?? 'lower',
        r.audience.data?.why ?? '',
      );
    }
  }
  if (r.read.gender) {
    const g = r.read.gender;
    add(
      'a-gender',
      `The audience is mostly ${g === 'female' ? 'women' : 'men'}`,
      r.audience.data ? genderVerdict(g, genders) : { verdict: 'cant', why: whyNot(r.audience) },
      'Do not narrow the campaign by gender.',
      false,
      audienceReceipt,
      audienceReceipt?.confidence ?? 'lower',
      r.audience.data?.why ?? '',
    );
  }
  const strongestTeam = teamOrder[0];
  for (const name of r.read.places) {
    const row = placeRows.find((p) => same(p.place, name));
    const result = row
      ? placeVerdict(row)
      : {
          verdict: 'cant' as const,
          why: r.places.data
            ? 'This city is not in the city table, so it was not tested.'
            : whyNot(r.places),
        };
    add(
      `a-place-${slug(name)}`,
      `${name} is a strong market for this ${r.labels.marketNoun}`,
      result,
      strongestTeam && !same(strongestTeam.place, name)
        ? `Keep ${name}, and open it after ${strongestTeam.place}, where lift is ${round2(strongestTeam.lift ?? 0)}.`
        : '',
      false,
      row && row.status !== 'unknown_place' ? placesReceipt : null,
      row?.confidence ?? 'lower',
      row?.why ?? '',
    );
  }
  const compsResult = r.places.data
    ? compsVerdict(r.places.data.leaveOneOut)
    : { verdict: 'cant' as const, why: whyNot(r.places) };
  add(
    'a-comps',
    r.labels.compsClaim,
    compsResult,
    'Add or swap comps so no single title carries the result.',
    true,
    placesReceipt,
    placesReceipt?.confidence ?? 'lower',
    placesReceipt ? confidenceReason(placesReceipt) : '',
  );

  const risks: Risk[] = assumptions
    .filter((a) => a.verdict === 'weak' || a.verdict === 'breaks')
    .map((a) => ({ id: `risk-${a.id}`, text: a.text, signal: a.why, action: a.fix }));

  const cannot: Untested[] = [
    ...r.dropped.map((d) => ({ id: `cant-comp-${slug(d.name)}`, item: d.name, reason: d.why })),
    ...assumptions
      .filter((a) => a.verdict === 'cant')
      .map((a) => ({ id: `cant-${a.id}`, item: a.text, reason: a.why })),
    { id: 'cant-box-office', ...r.labels.sales },
    ...(r.read.window
      ? [
          {
            id: 'cant-window',
            item: `The release window (${r.read.window})`,
            reason: 'Timing is checked against rival releases with the rival date check.',
          },
        ]
      : []),
  ];

  return {
    brief: {
      audience,
      assumptions,
      s1: [],
      s2: [],
      s3: [],
      s4: [],
      places,
      weeks: [],
      dates: [],
      chosenDate: '',
      partners: [],
      risks,
      cannot,
      groupLabels: [],
      planned: [],
      results: null,
      course: null,
    },
    lineReceipts: receipts,
    reasons,
    teamOrder,
    worth,
    ages,
    genders,
  };
}

/** The reason a tool put on its receipt, after "Confidence ". */
export function confidenceReason(receipt: Receipt): string {
  const at = receipt.rule.lastIndexOf('Confidence ');
  return at === -1 ? '' : receipt.rule.slice(at + 'Confidence '.length).replace(/\.$/, '');
}

function whyNot(t: Tested<unknown>): string {
  return 'why' in t ? t.why : '';
}

function order(v: Verdict): number {
  return { holds: 3, weak: 2, breaks: 1, cant: 0 }[v];
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
