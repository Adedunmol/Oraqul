import type { Output, OutputDetail, WatchState } from '@oraqul/schema';
import { redactForShare } from '../outputs/share-view.js';

// What the hosted MCP server may say about a plan: the plan and its finding summaries, the same
// data a share link already allows, and less. Qloo's terms bar passing raw data on, so nothing that
// was sent to Qloo or came back goes out: no receipts, no call ids, no endpoints, no affinities, no
// numbers a finding computed from the raw response. A tool never returns anything but these shapes.

export interface PlanSummary {
  id: string;
  kind: string;
  title: string;
  headline: string;
  confidence: { level: string; why: string };
  moves: { text: string }[];
  sections: {
    key: string;
    title: string;
    lines: {
      id: string;
      kind: 'grounded' | 'playbook';
      text: string;
      findingIds: string[];
      sourceIds: string[];
    }[];
  }[];
  /** What each cited finding says, by id. The sentence, its verdict and the names it ranks. */
  findings: {
    id: string;
    text: string;
    verdict: string | null;
    confidence: string;
    names: string[];
  }[];
  /** Web pages the plan cites, with the day each was read. */
  sources: { id: string; title: string; url: string; retrievedAt: string | null }[];
  project: { id: string; name: string; category: string };
}

export function planSummary(detail: OutputDetail): PlanSummary {
  // The share view first, so anything a share link withholds is withheld here too.
  const { output, project } = redactForShare(detail);
  const plan = output.plan;
  return {
    id: output.id,
    kind: output.kind,
    title: output.title,
    headline: output.headline,
    confidence: { level: output.confidence.level, why: output.confidence.why },
    moves: output.moves.map((m) => ({ text: m.text })),
    sections: (plan?.sections ?? []).map((s) => ({
      key: s.key,
      title: s.title,
      lines: s.lines.map((l) => ({
        id: l.id,
        kind: l.kind,
        text: l.text,
        findingIds: l.findingIds,
        sourceIds: l.sourceIds,
      })),
    })),
    findings: (plan?.findings ?? []).map((f) => ({
      id: f.id,
      text: f.text,
      verdict: f.verdict,
      confidence: f.confidence,
      names: f.entities.map((e) => e.name),
    })),
    sources: (plan?.sources ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      retrievedAt: s.retrievedAt ?? null,
    })),
    project: { id: project.id, name: project.name, category: project.category },
  };
}

export interface WatchSummary {
  outputId: string;
  watching: boolean;
  lastCheckedAt: string | null;
  notes: string[];
  events: {
    id: string;
    type: string;
    severity: string;
    status: string;
    title: string;
    reason: string;
    evidence: { url: string; title: string; retrievedAt: string }[];
    createdAt: string;
  }[];
  pace: {
    verdict: string;
    gap: number | null;
    gapPoints: number | null;
    unit: string;
    entries: number;
    note: string;
  } | null;
}

export function watchSummary(state: WatchState): WatchSummary {
  const r = state.pace.result;
  return {
    outputId: state.outputId,
    watching: state.status === 'active',
    lastCheckedAt: state.lastCheckedAt,
    notes: state.notes,
    events: state.events.map((e) => ({
      id: e.id,
      type: e.type,
      severity: e.severity,
      status: e.status,
      title: e.title,
      reason: e.reason,
      evidence: e.evidence.map((s) => ({ url: s.url, title: s.title, retrievedAt: s.retrievedAt })),
      createdAt: e.createdAt,
    })),
    pace: r
      ? {
          verdict: r.verdict,
          gap: r.gap,
          gapPoints: r.gapPoints,
          unit: r.unit,
          entries: r.entries,
          note: r.note,
        }
      : null,
  };
}

/** An output as a short line in a list. */
export const outputLine = (o: Output) => ({
  id: o.id,
  kind: o.kind,
  title: o.title,
  headline: o.headline,
});
