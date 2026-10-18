import { packs } from '@oraqul/packs';
import {
  type Brief,
  briefSchema,
  type Category,
  type EvidenceRow,
  type GlanceRow,
  type Job,
  type LaunchPlan,
  type LineChange,
  launchPlanSchema,
  type Move,
  moveSchema,
  type Output,
  type OutputStat,
  type OutputTab,
  type OutputTabKey,
  overallConfidenceSchema,
  type Receipt,
  receiptSchema,
  type Verdict,
  type VerdictCounts,
} from '@oraqul/schema';
import { z } from 'zod';
import type { outputs, receipts } from '../db/schema.js';

type OutputRow = typeof outputs.$inferSelect;
type ReceiptRow = typeof receipts.$inferSelect;

const KIND_LABEL: Record<Job, string> = {
  build: 'Plan',
  audit: 'Audit',
  scenario: 'Scenario',
  rescue: 'Rescue',
  date: 'Rival date check',
  partner: 'Partner brief',
};
const PREFIX: Record<Job, string> = {
  build: 'v',
  scenario: 'S',
  audit: 'A',
  rescue: 'R',
  date: 'D',
  partner: 'B',
};

// Product copy for the tabs (spec §9.3). The web demo has the same words until it is removed.
const TAB_NOTE: Partial<Record<OutputTabKey, string>> = {
  summary: 'The short version: what to do first, and how sure Oraqul is.',
  audience: 'Who it is for, measured against Qloo taste data.',
  assumptions:
    'Every belief your plan rests on. Holds means Qloo data supports it. Breaks means it does not. Each one has a receipt: the exact Qloo call behind it. What could not be tested is at the end.',
  plan: 'The plan itself, section by section, then the risks to watch.',
  evidence: 'Every claim with its receipt. Use this to check any number.',
  changes: 'What moved compared with the plan before.',
  territories: 'Where to open first, ranked by how strongly each territory fits.',
  date: 'How each date overlaps with rival releases. Lower overlap is better.',
  partners: 'Drafts for partners. Nothing is sent from here.',
};
const TAB_LABEL: Partial<Record<OutputTabKey, string>> = {
  summary: 'Summary',
  audience: 'Audience',
  assumptions: 'Assumptions',
  plan: 'Plan',
  evidence: 'Evidence',
  changes: 'What changed',
  territories: 'Territories',
  date: 'Rival date check',
  partners: 'Partner briefs',
};

const movesSchema = z.array(moveSchema);

export interface PresentInput {
  row: OutputRow;
  receipts: ReceiptRow[];
  category: Category;
  createdBy: string;
  /** 1 for the project's first output of this kind, then 2 and so on. */
  version: number;
  /** The brief of the plan this one was built on, for "What changed". */
  parentBrief: Brief | null;
  /** The launch plan this one was built on, when it has one. */
  parentPlan?: LaunchPlan | null;
}

/** The stored launch plan, or null for outputs saved in the older brief shape. */
export function storedPlan(value: unknown): LaunchPlan | null {
  const parsed = launchPlanSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Spec §7 `GET /outputs/:id`: everything the screens show, computed here from the stored brief. */
export function presentOutput({
  row,
  receipts,
  category,
  createdBy,
  version,
  parentBrief,
  parentPlan = null,
}: PresentInput): Output {
  const brief = briefSchema.parse(row.brief);
  const plan = storedPlan(row.plan);
  const moves = movesSchema.parse(row.moves ?? []);
  const confidence = overallConfidenceSchema.parse(row.confidence);
  const pack = packs[category];
  const counts = countVerdicts(brief);
  const headline = row.headline ?? '';
  const summary = [
    headline,
    ...moves.map((m, i) => `${i + 1}. ${m.text}`),
    `Confidence: ${capital(confidence.level)}. ${confidence.why}`,
  ].join('\n');
  const territories: OutputTabKey[] =
    category === 'film' && brief.places.length >= 2 ? ['territories'] : [];
  // A launch plan opens on the plan itself (PRD O1); the evidence sits behind it.
  const tabKeys: OutputTabKey[] = plan
    ? row.kind === 'scenario'
      ? ['plan', 'changes', 'audience', 'assumptions', 'evidence']
      : ['plan', 'audience', 'assumptions', 'evidence']
    : row.kind === 'date'
      ? ['summary', 'date', 'evidence']
      : row.kind === 'partner'
        ? ['summary', 'partners', 'evidence']
        : row.kind === 'scenario'
          ? ['summary', 'changes', 'assumptions', 'plan', ...territories, 'evidence']
          : ['summary', 'audience', 'assumptions', 'plan', ...territories, 'evidence'];
  const focusIds =
    row.kind === 'date'
      ? brief.dates.map((d) => d.id)
      : row.kind === 'partner'
        ? brief.partners.map((p) => p.id)
        : [];
  const changes =
    row.kind !== 'scenario'
      ? []
      : plan && parentPlan
        ? comparePlans(parentPlan, plan)
        : parentBrief
          ? compareBriefs(parentBrief, brief, pack.planSections)
          : [];

  return {
    id: row.id,
    projectId: row.projectId,
    threadId: row.threadId,
    kind: row.kind,
    parentId: row.parentId,
    title: row.title,
    label: row.kind === 'build' ? `v${version} · ${row.title}` : row.title,
    shortLabel: `${PREFIX[row.kind]}${version}`,
    kindLabel: KIND_LABEL[row.kind],
    createdBy,
    createdAt: row.createdAt.toISOString(),
    headline,
    moves,
    confidence,
    stats: stats(brief, counts),
    counts,
    summary,
    changes,
    focusIds,
    ...(row.kind === 'date' ? { dateSource: 'you' as const } : {}),
    tabs: tabKeys.map(
      (key): OutputTab => ({
        key,
        label: TAB_LABEL[key] ?? key,
        note: plan && key === 'plan' ? '' : (TAB_NOTE[key] ?? ''),
      }),
    ),
    sections: pack.planSections,
    glance:
      plan || row.kind === 'date' || row.kind === 'partner'
        ? []
        : glance(brief, pack.planSections, category),
    brief,
    plan,
    evidence: [
      ...(plan ? findingRows(plan, receipts) : []),
      ...evidence(brief, pack.planSections, receipts, moves, focusIds),
    ],
    receipts: receipts.map(toReceipt),
    limits:
      'Confidence shows how much Qloo data sits behind a line. Qloo shows current taste, not history. Box office, viewing numbers and reviews are not in Qloo. Every number comes from the comps you confirmed.',
  };
}

function toReceipt(row: ReceiptRow): Receipt {
  return receiptSchema.parse({
    callId: row.callId,
    ...(row.lineId ? { lineId: row.lineId } : {}),
    endpoint: row.endpoint,
    input: row.input,
    returned: row.returned,
    rule: row.rule,
    confidence: row.confidence,
    calledAt: row.calledAt.toISOString(),
    source: row.source,
  });
}

function countVerdicts(brief: Brief): VerdictCounts {
  const c: VerdictCounts = { holds: 0, weak: 0, breaks: 0, cant: 0 };
  for (const a of brief.assumptions) c[a.verdict]++;
  return c;
}

function stats(brief: Brief, c: VerdictCounts): OutputStat[] {
  return [
    { label: 'Assumptions', value: String(brief.assumptions.length) },
    { label: 'Hold', value: String(c.holds), verdict: 'holds' },
    { label: 'Weak or break', value: String(c.weak + c.breaks), verdict: 'breaks' },
    { label: 'Could not test', value: String(c.cant), verdict: 'cant' },
  ];
}

type Sections = Output['sections'];

function glance(brief: Brief, sections: Sections, category: Category): GlanceRow[] {
  const rows: GlanceRow[] = [];
  for (const s of sections) {
    const top = [...brief[s.key]].sort((a, b) => b.fit - a.fit)[0];
    if (top) {
      rows.push({
        label: s.one,
        name: top.name,
        value: String(top.fit),
        lineId: top.id,
        note: top.evidence,
      });
    }
  }
  const top = [...brief.places].sort((a, b) => b.lift - a.lift)[0];
  if (category === 'film' && top) {
    rows.push({
      label: 'Top territory',
      name: top.name,
      value: `${top.lift.toFixed(2)}x`,
      lineId: top.id,
      note: 'Highest lift over an average city in the same call',
    });
  }
  return rows;
}

interface Line {
  id: string;
  label: string;
  group: string;
  returned: string;
  verdict?: Verdict;
}

function lines(brief: Brief, sections: Sections): Line[] {
  return [
    ...brief.assumptions.map((a) => ({
      id: a.id,
      label: a.text,
      group: 'Assumptions',
      returned: a.why,
      verdict: a.verdict,
    })),
    ...brief.audience.map((a) => ({
      id: a.id,
      label: a.name,
      group: 'Audience',
      returned: a.evidence,
    })),
    ...sections.flatMap((s) =>
      brief[s.key].map((l) => ({ id: l.id, label: l.name, group: s.title, returned: l.evidence })),
    ),
    ...brief.places.map((p) => ({
      id: p.id,
      label: p.name,
      group: 'Places',
      returned: `Lift ${p.lift.toFixed(2)}x. ${p.note}`,
    })),
    ...brief.dates.map((d) => ({
      id: d.id,
      label: `${d.date} vs ${d.rival}`,
      group: 'Rival dates',
      returned: `Shared audience ${d.overlap}`,
    })),
    ...brief.partners.map((p) => ({
      id: p.id,
      label: p.name,
      group: 'Partners',
      returned: p.evidence,
    })),
  ];
}

/** Each line's shown value, so two briefs can be compared line by line. */
function values(brief: Brief, sections: Sections): Map<string, { label: string; value: string }> {
  const out = new Map<string, { label: string; value: string }>();
  for (const a of brief.assumptions) {
    const verdict = a.verdict === 'cant' ? 'Could not test' : capital(a.verdict);
    out.set(a.id, { label: a.text, value: `${verdict}. ${a.why}` });
  }
  for (const a of brief.audience) out.set(a.id, { label: a.name, value: `Index ${a.affinity}` });
  for (const s of sections) {
    for (const l of brief[s.key]) out.set(l.id, { label: l.name, value: `Fit ${l.fit}` });
  }
  for (const p of brief.places) {
    out.set(p.id, { label: p.name, value: `Lift ${p.lift.toFixed(2)}x` });
  }
  return out;
}

/** Spec §7 compare: every line whose shown value differs between two briefs. */
export function compareBriefs(a: Brief, b: Brief, sections: Sections): LineChange[] {
  const before = values(a, sections);
  const after = values(b, sections);
  const ids = [...new Set([...before.keys(), ...after.keys()])];
  return ids.flatMap((lineId) => {
    const x = before.get(lineId);
    const y = after.get(lineId);
    if (x?.value === y?.value) return [];
    return [
      {
        lineId,
        label: y?.label ?? x?.label ?? lineId,
        before: x?.value ?? null,
        after: y?.value ?? null,
      },
    ];
  });
}

function evidence(
  brief: Brief,
  sections: Sections,
  receipts: ReceiptRow[],
  moves: Move[],
  focusIds: string[],
): EvidenceRow[] {
  const backed = new Set(receipts.flatMap((r) => (r.lineId ? [r.lineId] : [])));
  const drivers = new Set(moves.map((m) => m.lineId));
  return lines(brief, sections)
    .filter((l) => backed.has(l.id) && (focusIds.length === 0 || focusIds.includes(l.id)))
    .map((l) => ({
      lineId: l.id,
      label: l.label,
      group: l.group,
      ...(l.verdict ? { verdict: l.verdict } : {}),
      returned: l.returned,
      driver: drivers.has(l.id) || l.verdict === 'breaks' || l.verdict === 'weak',
    }));
}

/** Evidence rows for a launch plan's findings. A finding the bottom line cites drives the plan. */
function findingRows(plan: LaunchPlan, receipts: ReceiptRow[]): EvidenceRow[] {
  const backed = new Set(receipts.flatMap((r) => (r.lineId ? [r.lineId] : [])));
  const drivers = new Set(
    plan.sections
      .filter((s) => s.key === 'bottom-line')
      .flatMap((s) => s.lines.flatMap((l) => l.findingIds)),
  );
  return plan.findings
    .filter((f) => backed.has(f.id))
    .map((f) => ({
      lineId: f.id,
      label: f.text,
      group: 'Findings',
      ...(f.verdict ? { verdict: f.verdict } : {}),
      returned: f.entities.length
        ? f.entities.map((e) => e.name).join(', ')
        : `Confidence ${f.confidence}. ${f.why}`,
      driver: drivers.has(f.id) || f.verdict === 'breaks' || f.verdict === 'weak',
    }));
}

/** Spec §7 compare for launch plans: every line whose text differs, matched by line id. */
export function comparePlans(a: LaunchPlan, b: LaunchPlan): LineChange[] {
  const flat = (p: LaunchPlan) =>
    new Map(
      p.sections.flatMap((s) =>
        s.lines.map((l) => [l.id, { label: s.title, value: l.text }] as const),
      ),
    );
  const before = flat(a);
  const after = flat(b);
  const ids = [...new Set([...before.keys(), ...after.keys()])];
  return ids.flatMap((lineId) => {
    const x = before.get(lineId);
    const y = after.get(lineId);
    if (x?.value === y?.value) return [];
    return [
      {
        lineId,
        label: y?.label ?? x?.label ?? lineId,
        before: x?.value ?? null,
        after: y?.value ?? null,
      },
    ];
  });
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
