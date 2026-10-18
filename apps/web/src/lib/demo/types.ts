import type {
  Category,
  Confidence,
  OutputTabKey,
  PlanSectionKey,
  Project,
  Verdict,
} from '@oraqul/schema';

// Internal shapes of the demo backend. They keep the extra fields it needs to build receipts
// (`k`, the endpoint family) and are turned into `@oraqul/schema` types in build-output.ts.

/** Which Qloo endpoint family a line's receipt comes from. `none` lines have no receipt. */
export type EndpointKind = 'demo' | 'cmp' | 'brand' | 'pod' | 'geo' | 'tag' | 'none';

export interface DAudience {
  id: string;
  name: string;
  aff: number;
  ev: string;
  k: EndpointKind;
}

export interface DFit {
  id: string;
  name: string;
  fit: number;
  ev: string;
  k: EndpointKind;
  note?: string;
  medium?: 'Series' | 'Film' | 'Podcast';
}

export interface DAssumption {
  id: string;
  text: string;
  unstated: boolean;
  verdict: Verdict;
  why: string;
  fix: string;
  k: EndpointKind;
  ev: string;
  src?: string;
}

export interface DRisk {
  id: string;
  text: string;
  signal: string;
  action: string;
}

export interface DCannot {
  id: string;
  item: string;
  reason: string;
}

export interface DPlace {
  id: string;
  name: string;
  lift: number;
  date?: string;
  aud: string;
  conf: Confidence;
  note: string;
}

export interface DDate {
  id: string;
  date: string;
  wk: number;
  rival: string;
  overlap: number;
  rec: string;
}

export interface DPartner {
  id: string;
  name: string;
  type: string;
  fits: string;
  ev: string;
  k: EndpointKind;
  draft: string;
}

export interface DShelf {
  id: string;
  name: string;
  ov: number;
  ev: string;
}

export interface DTopic {
  id: string;
  name: string;
  kind: 'distinct' | 'shared';
  w: number;
  ev: string;
}

export interface DGridRow {
  id: string;
  name: string;
  tag: string;
  vals: number[];
}

export interface DFan {
  id: string;
  name: string;
  before: number;
  after: number;
  ev: string;
  note?: string;
}

export interface DGaps {
  /** Label that came in furthest under plan, and its actual and planned share. */
  W: string;
  wa: number;
  wp: number;
  /** Label that came in furthest over plan. */
  B: string;
  ba: number;
  bp: number;
}

export interface DResultsInput {
  date: string;
  a: number[];
  t: { label: string; share: number }[] | null;
  hold: number | null;
}

export interface DCourse {
  summary: string;
  actions: string[];
  territories: string[];
  stop: string[];
}

export interface DBrief {
  aLabels: string[];
  planned: number[];
  audience: DAudience[];
  assumptions: DAssumption[];
  s1: DFit[];
  s2: DFit[];
  s3: DFit[];
  s4: DFit[];
  places: DPlace[];
  weeks: string[];
  dates: DDate[];
  chosenDate: string;
  partners: DPartner[];
  risks: DRisk[];
  cannot: DCannot[];
  course: DCourse | null;
  results: (DResultsInput & { g: DGaps }) | null;
  grid?: { cols: string[]; rows: DGridRow[] };
  shelf?: DShelf[];
  bridge?: DFit[];
  topics?: DTopic[];
  fan?: DFan[];
}

export interface DScenario {
  id: string;
  label: string;
  re: RegExp;
  apply(b: DBrief): void;
}

export type TraceKind = 'build' | 'audit' | 'date' | 'partner' | 'fix';

export interface DemoPack {
  id: Category;
  name: string;
  short: string;
  blurb: string;
  noun: string;
  /** What the agent falls back to when the title is not in Qloo. */
  fallback: string;
  tools: string[];
  cov: { tests: string[]; thin: string[]; none: string[] };
  fields: [label: string, key: 'kind' | 'genre' | 'lead' | 'comps' | 'places' | 'window'][];
  kinds: string[];
  placeLabel: string;
  placeOpts: string[];
  files: { plan: string; res: string };
  descHint: string;
  matchOpts(name: string): { v: string; l: string; d: string }[];
  q2: { prompt: string; opts: string[]; label: string };
  sec: { k: PlanSectionKey; t: string; one: string }[];
  sigTabs: [OutputTabKey, string][];
  planNote: string;
  dateLabel: string;
  dateTitle: string;
  partnerLabel: string;
  partnerWord: string;
  rivalWord: string;
  quick: [date: string, results: string, partner: string];
  noFc: { re: RegExp; msg: string };
  /** What the numbers a fix needs are called, such as "box office or viewing numbers". */
  noFcWhat: string;
  mv: [PlanSectionKey, string][];
  lead(b: DBrief): string;
  trace: Record<TraceKind, string[]>;
  res: {
    dateLabel: string;
    aTitle: string;
    aNoun: string;
    aLabels(r: Project): string[];
    planned(r: Project): number[];
    demoA(r: Project): number[];
    tTitle: string;
    tLabels(r: Project): string[] | null;
    demoT(r: Project): number[];
    holdLabel: string;
    holdShort: string;
    holdSub: string;
    holdDefault: number;
    confirmRows: [string, string][];
    chartA: string;
    chartSub: string;
    chartT: string;
    head(b: DBrief, g: DGaps): string;
    stats(b: DBrief, g: DGaps): { l: string; v: string }[];
  };
  base(r: Project): DBrief;
  scen: DScenario[];
  fix(b: DBrief, g: DGaps): void;
  auditFix(b: DBrief): Record<string, string>;
}
