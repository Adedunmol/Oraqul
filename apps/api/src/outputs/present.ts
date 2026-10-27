import { packs } from '@oraqul/packs';
import {
  type AuditReport,
  auditReportSchema,
  type Brief,
  briefSchema,
  type Category,
  type EvidenceRow,
  type Finding,
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
  refreshReportSchema,
  type Verdict,
  type VerdictCounts,
} from '@oraqul/schema';
import { z } from 'zod';
import type { outputs, receipts } from '../db/schema.js';

type OutputRow = typeof outputs.$inferSelect;
type ReceiptRow = typeof receipts.$inferSelect;

const KIND_LABEL: Record<Job, string> = {
  build: 'Plan',
  audit: 'Audit report',
  scenario: 'Scenario',
  fix: 'Fixed plan',
  date: 'Rival date check',
  partner: 'Partner brief',
  creative: 'Creative kit',
  refresh: 'What changed',
  rescue: 'Rescue',
};
const PREFIX: Record<Job, string> = {
  build: 'v',
  scenario: 'S',
  audit: 'A',
  fix: 'F',
  date: 'D',
  partner: 'B',
  creative: 'K',
  refresh: 'R',
  rescue: 'X',
};

// Product copy for the tabs (spec §9.3). The web demo has the same words until it is removed.
const TAB_NOTE: Partial<Record<OutputTabKey, string>> = {
  summary: 'The short version: what to do first, and how sure Oraqul is.',
  audience: 'Who it is for, measured against Qloo taste data.',
  risks: 'What could go wrong with the plan, most serious first, and what to do about it.',
  alternatives: 'Stronger options the data points to. Your own choices stay in the plan.',
  results: 'What the launch produced, compared with where the plan expected it.',
  fixes: 'What the audit found weak or broken, beside the part of the new plan that answers it.',
  assumptions:
    'Every belief your plan rests on. Holds means Qloo data supports it. Breaks means it does not. Each one has a receipt: the exact Qloo call behind it. What could not be tested is at the end.',
  plan: 'The plan itself, section by section, then the risks to watch.',
  evidence: 'Every claim with its receipt. Use this to check any number.',
  changes: 'What moved compared with the plan before.',
  territories:
    'One plan per territory: the home market first, then the diaspora cities, each with its call, its lead channels and its partners.',
  calls:
    'Okay, risky or avoid, for each date, territory and partner, set by code from what Qloo returned.',
  refresh:
    'What Qloo and the web say now, set beside what this plan saved. The plan itself is unchanged.',
  campaign:
    'The content calendar as a dated checklist your team edits and ticks off. Each action comes with a guide to adapt, and Oraqul alerts the team when a date slips: it makes no final asset and posts nothing.',
  watch:
    'Oraqul re-checks this plan on a schedule and says what needs a look. Add your own figures to see whether the launch is ahead of, on or behind the plan’s pace. It never changes the plan.',
  kit: 'Guides for the team that makes the creative: hooks, a script, a shot list, a key art brief and captions. Oraqul does not make the asset.',
  route: 'The tour stops in your order, scored against the strongest order.',
  supportacts: 'The acts Qloo ranks highest with your audience in each tour city.',
  fanbase: 'Which fan bases to collab with, ranked within each medium.',
  regions: 'Which regions fit the game, ranked by how strongly each does.',
  date: 'How each date overlaps with rival releases. Lower overlap is better.',
  partners: 'Drafts for partners. Nothing is sent from here.',
};
const TAB_LABEL: Partial<Record<OutputTabKey, string>> = {
  summary: 'Summary',
  audience: 'Audience',
  assumptions: 'Assumptions',
  risks: 'Risks',
  alternatives: 'Worth a look',
  results: 'Results',
  fixes: 'What was fixed',
  plan: 'Plan',
  evidence: 'Evidence',
  changes: 'What changed',
  territories: 'Territories',
  calls: 'Direction calls',
  kit: 'Creative kit',
  campaign: 'Campaign',
  watch: 'Watch',
  refresh: 'What changed',
  route: 'Tour route',
  supportacts: 'Support acts',
  fanbase: 'Fan base bridge',
  regions: 'Regions',
  date: 'Rival date check',
  partners: 'Partner briefs',
};

// Podcasts name the same tabs in their own words: a swap list instead of a fan base bridge, markets
// instead of regions, and the topic map.
const PODCAST_TABS: Partial<Record<OutputTabKey, { label: string; note: string }>> = {
  topics: {
    label: 'Topic map',
    note: 'The topics your listeners lean to, against the listeners of rival shows. Yours are the ones they do not share.',
  },
  fanbase: {
    label: 'Cross promotion',
    note: 'Which shows to swap with, ranked by how close their listeners are to yours.',
  },
  regions: {
    label: 'Markets',
    note: 'Which markets fit the show, ranked by how strongly each does.',
  },
};

// Books name the same tabs in their own words: the comp shelf and the adaptation bridge, and markets
// instead of regions.
const BOOK_TABS: Partial<Record<OutputTabKey, { label: string; note: string }>> = {
  shelf: {
    label: 'Comp shelf',
    note: 'The recent books your readers pick up, ranked by how close their readers are to yours. These are the comps to pitch against.',
  },
  bridge: {
    label: 'Adaptation bridge',
    note: 'The series, films and podcasts your readers also follow, ranked within each kind of media. They give the pitch angles for screen and audio.',
  },
  regions: {
    label: 'Markets',
    note: 'Which markets fit the book, ranked by how strongly each does.',
  },
};

// The tabs a category names in its own words, over the shared ones.
const CATEGORY_TABS: Partial<
  Record<Category, Partial<Record<OutputTabKey, { label: string; note: string }>>>
> = { podcasts: PODCAST_TABS, books: BOOK_TABS };

const LIMITS: Partial<Record<Category, string>> = {
  film: 'Confidence shows how much Qloo data sits behind a line. Qloo shows current taste, not history. Box office, viewing numbers and reviews are not in Qloo. Every number comes from the comps you confirmed.',
  music:
    'Qloo shows current taste, not history. Streams, chart positions and ticket sales are not in Qloo. Every number comes from the sound-alike artists you confirmed.',
  games:
    'Qloo shows current taste, not history. Wishlists, sales, player counts and reviews are not in Qloo. Every number comes from the comparable games you confirmed.',
  books:
    'Confidence shows how much Qloo data sits behind a line. Qloo shows current taste, not history, and holds age and gender for only about half of books. Sales, pre-orders, chart positions and ratings are not in Qloo. Every number comes from the comparable books you confirmed.',
  podcasts:
    'Confidence shows how much Qloo data sits behind a line. Qloo shows current taste, not history. Downloads, chart positions, ratings and ad rates are not in Qloo. Every number comes from the comparable shows you confirmed.',
  shows:
    'Qloo shows current taste, not history. Ticket prices, venue capacity, ticket sales and event calendars are not in Qloo: the show date, the capacity, the price band and the rival dates are the ones you gave. Every audience number comes from the comparable acts you confirmed.',
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
  /** The audit report this one was written from. Set for a fixed plan. */
  parentReport?: AuditReport | null;
}

/** The stored audit report, or null for every other kind of output. */
export function storedReport(value: unknown): AuditReport | null {
  const parsed = auditReportSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
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
  parentReport = null,
}: PresentInput): Output {
  const brief = briefSchema.parse(row.brief);
  const plan = storedPlan(row.plan);
  const audit = storedReport(row.report);
  const refresh = refreshReportSchema.safeParse(row.refresh).data ?? null;
  // A fixed plan carries the report it answers, so its screen can set each fix beside the plan.
  const report = audit ?? (row.kind === 'fix' ? parentReport : null);
  const moves = movesSchema.parse(row.moves ?? []);
  const confidence = overallConfidenceSchema.parse(row.confidence);
  const pack = packs[category];
  const counts = audit ? countItems(audit) : countVerdicts(brief);
  const headline = row.headline ?? '';
  const summary = [
    headline,
    ...moves.map((m, i) => `${i + 1}. ${m.text}`),
    `Confidence: ${capital(confidence.level)}. ${confidence.why}`,
  ].join('\n');
  // A plan with territories shows one plan per territory, whatever the category. Film plans saved
  // before territories were stored keep the old rule, which regroups their lines by city.
  const territories: OutputTabKey[] =
    (plan?.territories.length ?? 0) > 0 ||
    (plan && plan.territories.length === 0 && category === 'film' && brief.places.length >= 2)
      ? ['territories']
      : [];
  // Games: the fan base bridge and the regions sit next to the plan, only when there is something
  // to show (the bridge needs a fan base, the regions need two to compare).
  // Podcasts: the topic map and the swap list, with the markets, on the same terms.
  // Books: the comp shelf and the adaptation bridge, with the markets.
  const gameTabs: OutputTabKey[] =
    category === 'games' || category === 'podcasts'
      ? [
          ...(category === 'podcasts' && brief.topics?.length ? (['topics'] as const) : []),
          ...(brief.fan?.length ? (['fanbase'] as const) : []),
          ...(brief.places.length >= 2 ? (['regions'] as const) : []),
        ]
      : category === 'books'
        ? [
            ...(brief.shelf?.length ? (['shelf'] as const) : []),
            ...(brief.bridge?.length ? (['bridge'] as const) : []),
            ...(brief.places.length >= 2 ? (['regions'] as const) : []),
          ]
        : [];
  // Film: one plan per territory, regrouped from the plan's own lines. Music: the tour route and the
  // support acts, from the route score and the support findings.
  const planTabs: OutputTabKey[] = plan
    ? [
        ...territories,
        // The calls on dates, territories and partners, set by code.
        ...(plan.calls.length > 0 ? (['calls'] as const) : []),
        // The calendar as actions the team runs and ticks off.
        ...(plan.calendar.length > 0 ? (['campaign'] as const) : []),
        // Rivals the team named in the brief were checked inside the build.
        ...(brief.dates.length > 0 ? (['date'] as const) : []),
        ...(category === 'music'
          ? [
              ...(brief.route ? (['route'] as const) : []),
              ...(plan.findings.some((f) => f.query === 'support')
                ? (['supportacts'] as const)
                : []),
            ]
          : []),
        // Watching and pacing are for a whole launch plan, not a narrow answer.
        ...(plan.scope === 'full' ? (['watch'] as const) : []),
      ]
    : [];
  // A launch plan opens on the plan itself (PRD O1); the evidence sits behind it.
  const tabKeys: OutputTabKey[] =
    row.kind === 'creative'
      ? ['kit', 'evidence']
      : row.kind === 'rescue'
        ? ['plan', 'evidence']
        : row.kind === 'refresh'
          ? ['refresh']
          : audit
            ? [
                'summary',
                'assumptions',
                'risks',
                'alternatives',
                ...(audit.results ? (['results'] as const) : []),
                'evidence',
              ]
            : plan
              ? row.kind === 'scenario'
                ? [
                    'plan',
                    'changes',
                    ...gameTabs,
                    ...planTabs,
                    'audience',
                    'assumptions',
                    'evidence',
                  ]
                : row.kind === 'fix' && report
                  ? [
                      'plan',
                      'fixes',
                      ...gameTabs,
                      ...planTabs,
                      'audience',
                      'assumptions',
                      'evidence',
                    ]
                  : ['plan', ...gameTabs, ...planTabs, 'audience', 'assumptions', 'evidence']
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
    stats: stats(audit ? audit.items.length : brief.assumptions.length, counts),
    counts,
    summary,
    changes,
    focusIds,
    ...(row.kind === 'date' || brief.dates.length > 0 ? { dateSource: 'you' as const } : {}),
    tabs: tabKeys.map(
      (key): OutputTab => ({
        key,
        label: CATEGORY_TABS[category]?.[key]?.label ?? TAB_LABEL[key] ?? key,
        note:
          plan && key === 'plan'
            ? ''
            : (CATEGORY_TABS[category]?.[key]?.note ?? TAB_NOTE[key] ?? ''),
      }),
    ),
    sections: pack.planSections,
    glance:
      plan || audit || row.kind === 'date' || row.kind === 'partner'
        ? []
        : glance(brief, pack.planSections, category),
    brief,
    plan,
    report,
    refresh,
    evidence: [
      ...(plan ? findingRows(plan.findings, bottomLineFindings(plan), receipts) : []),
      ...(audit ? findingRows(audit.findings, reportDrivers(audit), receipts) : []),
      ...evidence(brief, pack.planSections, receipts, moves, focusIds),
    ],
    receipts: receipts.map(toReceipt),
    limits: LIMITS[category] ?? LIMITS.film ?? '',
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

function countItems(report: AuditReport): VerdictCounts {
  const c: VerdictCounts = { holds: 0, weak: 0, breaks: 0, cant: 0 };
  for (const i of report.items) c[i.verdict]++;
  return c;
}

function stats(assumptions: number, c: VerdictCounts): OutputStat[] {
  return [
    { label: 'Assumptions', value: String(assumptions) },
    { label: 'Hold', value: String(c.holds), verdict: 'holds' },
    {
      label: 'Weak or break',
      value: String(c.weak + c.breaks),
      verdict: 'breaks',
    },
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
  if ((category === 'film' || category === 'music') && top) {
    rows.push({
      label: category === 'film' ? 'Top territory' : 'Top city',
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
      brief[s.key].map((l) => ({
        id: l.id,
        label: l.name,
        group: s.title,
        returned: l.evidence,
      })),
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

// Each line's shown value, so two briefs can be compared line by line.
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

// Evidence rows for a launch plan's findings. A finding the bottom line cites drives the plan.
/** The findings behind a plan's bottom line, which drive what it recommends. */
function bottomLineFindings(plan: LaunchPlan): Set<string> {
  return new Set(
    plan.sections
      .filter((s) => s.key === 'bottom-line')
      .flatMap((s) => s.lines.flatMap((l) => l.findingIds)),
  );
}

/** The findings behind the fixes of a report. */
function reportDrivers(report: AuditReport): Set<string> {
  return new Set(report.items.flatMap((i) => (i.fix ? i.fix.findingIds : [])));
}

function findingRows(
  findings: Finding[],
  drivers: Set<string>,
  receipts: ReceiptRow[],
): EvidenceRow[] {
  const backed = new Set(receipts.flatMap((r) => (r.lineId ? [r.lineId] : [])));
  return findings
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
