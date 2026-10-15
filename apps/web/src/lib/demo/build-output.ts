import {
  type Brief,
  type Confidence,
  type EvidenceRow,
  type GlanceRow,
  type Job,
  type LineChange,
  type Move,
  type Output,
  type OutputStat,
  type OutputTab,
  type OutputTabKey,
  outputSchema,
  type Project,
  type Receipt,
  type VerdictCounts,
} from '@oraqul/schema';
import { type FoundLine, findLine, flat, lcf, topFit } from './brief';
import { uuidFrom } from './ids';
import { PACKS } from './packs';
import type { DBrief, DemoPack, DPlace, EndpointKind } from './types';

/** An output as the demo backend keeps it, before it is serialised for the screens. */
export interface DOutput {
  id: string;
  projectId: string;
  threadId: string;
  kind: Job;
  title: string;
  by: string;
  at: string;
  brief: DBrief;
  parentId: string | null;
  /** The plan a date check or partner brief was made from. */
  ofId: string | null;
  changed: string[];
  focusIds: string[];
  src?: 'you' | 'calendar';
}

const KIND_LABEL: Record<'plan' | 'audit' | 'scenario' | 'rescue', string> = {
  plan: 'Plan',
  audit: 'Audit',
  scenario: 'Scenario',
  rescue: 'Rescue',
};

const isPlanKind = (k: Job): k is 'plan' | 'audit' | 'scenario' | 'rescue' =>
  k === 'plan' || k === 'audit' || k === 'scenario' || k === 'rescue';

export function kindLabel(pack: DemoPack, kind: Job): string {
  if (kind === 'date') return pack.dateLabel;
  if (kind === 'partner') return pack.partnerLabel;
  return KIND_LABEL[kind];
}

const VERB: Record<Project['category'], string> = {
  film: 'Open on',
  music: 'Release on',
  books: 'Publish on',
  podcasts: 'Launch on',
  games: 'Launch on',
};

const ENDPOINT: Record<Exclude<EndpointKind, 'none'>, string> = {
  demo: 'insights.demographics',
  cmp: 'analysis.compare',
  brand: 'insights.entities',
  pod: 'insights.entities',
  geo: 'insights.heatmap',
  tag: 'insights.tags',
};

const TAB_NOTE: Record<OutputTabKey, string> = {
  summary: 'The short version: what to do first, and how sure Oraqul is.',
  audience: 'Who it is for, measured against Qloo taste data.',
  assumptions:
    'Every belief your plan rests on. Holds means Qloo data supports it. Breaks means it does not. Each one has a receipt: the exact Qloo call behind it. What could not be tested is at the end.',
  plan: 'The plan itself, section by section, then the risks to watch.',
  risks: 'What could go wrong, and what to do about it.',
  cannot: 'What Oraqul could not test, and why. You may need to supply this.',
  evidence: 'Every claim with its receipt. Use this to check any number.',
  changes: 'What moved compared with the plan before.',
  results: 'The results you added, compared with what the plan expected.',
  date: 'How each date overlaps with rival releases. Lower overlap is better.',
  partners: 'Drafts for partners. Nothing is sent from here.',
  territories: 'Where to open first, ranked by how strongly each territory fits.',
  route: 'The tour stops in order, with how well each city fits.',
  supportacts: 'How each support act fits in each city on the route.',
  shelf: 'The comparable titles whose readers are closest to yours.',
  bridge: 'Screen and audio titles your readers also love.',
  topics: 'Topics your listeners like that rival shows do not own.',
  fanbase: 'Other fan bases that overlap with your players.',
  regions: 'Regions ranked by fit, against the lead region the plan names.',
};

const TAB_LABEL: Partial<Record<OutputTabKey, string>> = {
  summary: 'Summary',
  audience: 'Audience',
  assumptions: 'Assumptions',
  plan: 'Plan',
  risks: 'Risks',
  cannot: 'Could not test',
  evidence: 'Evidence',
  changes: 'What changed',
  results: 'Results',
};

function tabsFor(pack: DemoPack, o: DOutput): OutputTab[] {
  const sig = pack.sigTabs
    .map(([key]) => key)
    .filter((k) => k !== 'territories' || o.brief.places.length >= 2);
  const keys: Record<Job, OutputTabKey[]> = {
    // Could not test sits under Assumptions and Risks under Plan, so a plan opens on fewer tabs.
    plan: ['summary', 'audience', 'assumptions', 'plan', ...sig, 'evidence'],
    audit: ['summary', 'assumptions', 'plan', ...sig, 'evidence'],
    scenario: ['summary', 'changes', 'assumptions', 'plan', ...sig, 'evidence'],
    rescue: ['summary', 'results', 'changes', 'assumptions', ...sig, 'evidence'],
    date: ['summary', 'date', 'evidence'],
    partner: ['summary', 'partners', 'evidence'],
  };
  return keys[o.kind].map((key) => ({ key, label: tabLabel(pack, key), note: TAB_NOTE[key] }));
}

function tabLabel(pack: DemoPack, key: OutputTabKey): string {
  const sig = pack.sigTabs.find(([k]) => k === key);
  if (sig) return sig[1];
  if (key === 'date') return pack.dateLabel;
  if (key === 'partners') return `${pack.partnerLabel}s`;
  return TAB_LABEL[key] ?? key;
}

export function counts(b: DBrief): VerdictCounts {
  const c: VerdictCounts = { holds: 0, weak: 0, breaks: 0, cant: 0 };
  for (const a of b.assumptions) c[a.verdict]++;
  return c;
}

function statsFor(b: DBrief): OutputStat[] {
  const c = counts(b);
  return [
    { label: 'Assumptions', value: String(b.assumptions.length) },
    { label: 'Hold', value: String(c.holds), verdict: 'holds' },
    { label: 'Weak or break', value: String(c.weak + c.breaks), verdict: 'breaks' },
    { label: 'Could not test', value: String(c.cant), verdict: 'cant' },
  ];
}

function itemLabel(b: DBrief, id: string): string {
  if (id === 'chosen') return 'Date';
  const f = findLine(b, id);
  if (!f) return id;
  switch (f.k) {
    case 'assumptions':
    case 'risks':
      return f.it.text;
    case 'dates':
      return `${f.it.date} vs ${f.it.rival}`;
    default:
      return f.it.name;
  }
}

function lineConfidence(f: FoundLine): Confidence {
  if (f.k === 'places') return f.it.conf;
  const text = 'name' in f.it ? f.it.name : 'text' in f.it ? f.it.text : '';
  const extra = 'ev' in f.it ? f.it.ev : '';
  const why = f.k === 'assumptions' ? f.it.why : '';
  if (/Nigeria|Lagos|Accra/.test(text + extra + why)) return 'lower';
  if (f.k === 'audience' || ('k' in f.it && f.it.k === 'demo')) return 'medium';
  return 'high';
}

function endpointOf(f: FoundLine): string {
  const fixed: Partial<Record<FoundLine['k'], Exclude<EndpointKind, 'none'>>> = {
    dates: 'cmp',
    places: 'geo',
    shelf: 'cmp',
    grid: 'cmp',
    fan: 'cmp',
    topics: 'tag',
  };
  const k = 'k' in f.it && f.it.k !== 'none' ? f.it.k : fixed[f.k];
  return ENDPOINT[k ?? 'geo'];
}

/** Lines that carry a receipt: everything but risks and lines with no Qloo data behind them. */
function hasReceipt(f: FoundLine | undefined): f is FoundLine {
  if (!f || f.k === 'risks') return false;
  return !('k' in f.it) || f.it.k !== 'none';
}

function returnedOf(f: FoundLine, b: DBrief): string {
  switch (f.k) {
    case 'places':
      return `Lift ${f.it.lift.toFixed(1)}x. ${f.it.note}`;
    case 'grid':
      return `Lift ${f.it.vals.join(', ')} across ${b.grid?.cols.join(', ') ?? 'the cities'}`;
    case 'fan':
      return `Overlap ${f.it.before} before, ${f.it.after} after`;
    case 'shelf':
      return `Reader overlap ${f.it.ov}`;
    case 'topics':
      return f.it.ev;
    case 'dates':
      return `Shared audience ${f.it.overlap}`;
    case 'risks':
      return f.it.signal;
    default:
      return f.it.ev;
  }
}

function ruleOf(f: FoundLine): string {
  switch (f.k) {
    case 'assumptions':
      return f.it.why;
    case 'dates':
      return `Shared audience between your launch and the rival is ${f.it.overlap}. Above 60 is risky, 35 to 60 is moderate, below 35 is low. You supplied the rival's date.`;
    case 'places':
      return `Lift is the audience score for ${f.it.name} divided by the score for a neutral audience, taken from one ranking call so the scores can be compared. Above 1.5 is strong. Confidence is lower where Qloo has few entities for the title or its comps.`;
    case 'audience':
      return 'Highest affinity segment among the comps, as an index from 0 to 100.';
    case 'partners':
      return 'Brand, creator or act affinity with the segments the plan targets.';
    case 'grid':
      return 'Lift for each act in each route city, from one ranking call so the scores can be compared.';
    case 'fan':
      return 'Overlap between the fan base and your core audience, before and after the change in the scenario.';
    case 'shelf':
      return 'Share of readers of the comp title who also read your book.';
    case 'topics':
      return 'Tag weight in your audience divided by its weight in the audiences of the rival shows. Above 1 means the tag is more yours than theirs.';
    case 'risks':
      return '';
    default:
      return `Fit ${f.it.fit}. 75 and above is recommended, 50 to 74 is usable, below 50 is not recommended.`;
  }
}

function allLineIds(b: DBrief): string[] {
  return [...flat(b).keys()];
}

function liftBand(lift: number): Brief['places'][number]['band'] {
  if (lift >= 1.5) return 'strong';
  if (lift >= 1.2) return 'usable';
  return 'weak';
}

function overlapBand(overlap: number): Brief['dates'][number]['band'] {
  if (overlap >= 60) return 'high';
  if (overlap >= 35) return 'moderate';
  return 'low';
}

const ROUTE_WEIGHTS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
function routeScore(places: DPlace[]): number {
  let total = 0;
  let weights = 0;
  places.forEach((p, i) => {
    const w = ROUTE_WEIGHTS[Math.min(i, ROUTE_WEIGHTS.length - 1)] ?? 0.4;
    total += p.lift * w;
    weights += w;
  });
  return weights ? total / weights : 0;
}

const average = (values: number[]): number =>
  values.length ? values.reduce((x, y) => x + y, 0) / values.length : 0;

function heatLevel(v: number): number {
  if (v >= 1.5) return 3;
  if (v >= 1.3) return 2;
  if (v >= 1.1) return 1;
  return 0;
}

function toBrief(b: DBrief, category: Project['category']): Brief {
  const fit = (x: DBrief['s1'][number]) => ({
    id: x.id,
    name: x.name,
    fit: x.fit,
    evidence: x.ev,
    note: x.note,
    medium: x.medium,
  });
  const best = b.places.slice().sort((x, y) => y.lift - x.lift);
  const brief: Brief = {
    audience: b.audience.map((a) => ({
      id: a.id,
      name: a.name,
      affinity: a.aff,
      evidence: a.ev,
    })),
    assumptions: b.assumptions.map((a) => ({
      id: a.id,
      text: a.text,
      verdict: a.verdict,
      why: a.why,
      fix: a.fix,
      unstated: a.unstated,
      source: a.src,
    })),
    s1: b.s1.map(fit),
    s2: b.s2.map(fit),
    s3: b.s3.map(fit),
    s4: b.s4.map(fit),
    places: b.places.map((p) => ({
      id: p.id,
      name: p.name,
      lift: p.lift,
      band: liftBand(p.lift),
      date: p.date,
      audience: p.aud,
      confidence: p.conf,
      note: p.note,
    })),
    weeks: b.weeks.slice(),
    dates: b.dates.map((d) => ({
      id: d.id,
      date: d.date,
      week: d.wk,
      rival: d.rival,
      overlap: d.overlap,
      band: overlapBand(d.overlap),
      advice: d.rec,
    })),
    chosenDate: b.chosenDate,
    partners: b.partners.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      fits: p.fits,
      evidence: p.ev,
      draft: p.draft,
    })),
    risks: b.risks.map((r) => ({ ...r })),
    cannot: b.cannot.map((c) => ({ ...c })),
    groupLabels: b.aLabels.slice(),
    planned: b.planned.slice(),
    results: b.results
      ? {
          date: b.results.date,
          actual: b.results.a.slice(),
          secondary: b.results.t ? b.results.t.map((t) => ({ ...t })) : null,
          hold: b.results.hold,
        }
      : null,
    course: b.course
      ? {
          summary: b.course.summary,
          actions: b.course.actions.slice(),
          places: b.course.territories.slice(),
          stop: b.course.stop.slice(),
        }
      : null,
  };
  if (b.grid?.rows.length) {
    const rows = b.grid.rows.map((r) => ({
      id: r.id,
      name: r.name,
      tag: r.tag,
      lifts: r.vals.slice(),
      average: average(r.vals),
      levels: r.vals.map(heatLevel),
    }));
    const top = rows.reduce((a, r) => (r.average > a.average ? r : a));
    brief.grid = { cities: b.grid.cols.slice(), rows, bestRowId: top.id };
  }
  if (category === 'music' && b.places.length) {
    const score = routeScore(b.places);
    const bestScore = routeScore(best);
    brief.route = {
      score,
      bestScore,
      bestOrder: best.map((p) => p.name),
      isBestOrder: b.places.every((p, i) => p.id === best[i]?.id),
    };
  }
  if (b.shelf) {
    brief.shelf = b.shelf.map((s) => ({ id: s.id, name: s.name, overlap: s.ov, evidence: s.ev }));
  }
  if (b.bridge) brief.bridge = b.bridge.map(fit);
  if (b.topics) {
    brief.topics = b.topics.map((t) => ({
      id: t.id,
      name: t.name,
      ownership: t.kind,
      weight: t.w,
      evidence: t.ev,
    }));
  }
  if (b.fan) {
    brief.fan = b.fan.map((f) => ({
      id: f.id,
      name: f.name,
      before: f.before,
      after: f.after,
      evidence: f.ev,
      note: f.note,
    }));
  }
  return brief;
}

const pretty = (s: string): string => s.replace(/ \| /g, '. ');

function changesFor(o: DOutput, parent: DOutput | undefined): LineChange[] {
  if (!parent) return [];
  const fa = flat(parent.brief);
  const fb = flat(o.brief);
  return o.changed.map((lineId) => {
    if (lineId === 'chosen') {
      return {
        lineId,
        label: 'Date',
        before: parent.brief.chosenDate,
        after: o.brief.chosenDate,
      };
    }
    const label = findLine(o.brief, lineId)
      ? itemLabel(o.brief, lineId)
      : itemLabel(parent.brief, lineId);
    const before = fa.get(lineId);
    const after = fb.get(lineId);
    return {
      lineId,
      label,
      before: before === undefined ? null : pretty(before),
      after: after === undefined ? null : pretty(after),
    };
  });
}

interface Headline {
  headline: string;
  moves: Move[];
  stats: OutputStat[];
}

function headlineFor(
  r: Project,
  pack: DemoPack,
  o: DOutput,
  parent: DOutput | undefined,
): Headline {
  const b = o.brief;
  const c = counts(b);
  const n = b.assumptions.length;
  const moves: Move[] = [];
  const bad = b.assumptions
    .filter((a) => a.verdict === 'breaks' || a.verdict === 'weak')
    .sort((x, y) => (x.verdict === 'breaks' ? 0 : 1) - (y.verdict === 'breaks' ? 0 : 1));
  switch (o.kind) {
    case 'plan': {
      const first = bad[0];
      const headline =
        first && first.verdict === 'breaks'
          ? `The plan has a weak spot: ${lcf(first.text)}. Fix it before you spend.`
          : `The plan holds. ${pack.lead(b)}`;
      if (first) {
        moves.push({
          text: `Fix before spending: ${first.text}. ${first.fix || 'Test it first.'}`,
          lineId: first.id,
        });
      }
      const picks: Move[] = [];
      for (const [k, template] of pack.mv) {
        const x = topFit(b[k]);
        if (x) {
          picks.push({
            text: template.replace('{n}', x.name).replace('{f}', String(x.fit)),
            lineId: x.id,
          });
        }
      }
      moves.push(...picks.slice(0, first ? 2 : 3));
      return { headline, moves, stats: statsFor(b) };
    }
    case 'audit': {
      const unstated = b.assumptions.filter((a) => a.unstated).length;
      const first = bad[0];
      const headline =
        c.breaks && first
          ? `${c.breaks} of ${n} assumptions in your plan break. Start with: ${lcf(first.text)}.`
          : `Your plan holds up. ${c.weak} of ${n} assumptions are weak.`;
      for (const a of bad.slice(0, 3)) {
        moves.push({
          text: `${a.text}. ${a.fix || 'Test it before you commit spend.'}`,
          lineId: a.id,
        });
      }
      if (!moves.length) {
        moves.push({
          text: 'No fixes needed. Keep the plan as written.',
          lineId: b.assumptions[0]?.id ?? null,
        });
      }
      const stats = statsFor(b);
      stats.splice(1, 0, { label: 'Unstated', value: String(unstated) });
      return { headline, moves, stats };
    }
    case 'scenario': {
      const pc = parent ? counts(parent.brief) : c;
      const delta = c.weak + c.breaks - (pc.weak + pc.breaks);
      const label = o.title.replace('Scenario: ', '');
      const total = flat(b).size;
      let tail = 'The plan holds under this change.';
      if (delta > 0) {
        tail = `The plan gets weaker: ${delta} more assumption${delta > 1 ? 's are' : ' is'} weak or broken.`;
      } else if (delta < 0) {
        tail = `The plan gets stronger: ${-delta} fewer assumption${delta < -1 ? 's are' : ' is'} weak or broken.`;
      }
      for (const id of o.changed) {
        const a = b.assumptions.find((x) => x.id === id);
        if (a && (a.verdict === 'weak' || a.verdict === 'breaks') && moves.length < 3) {
          moves.push({
            text: `${a.text}. ${a.fix || 'Test it before you commit spend.'}`,
            lineId: a.id,
          });
        }
      }
      if (!moves.length) {
        moves.push({
          text: `${o.changed.length} lines changed. None of them needs action.`,
          lineId: o.changed[0] ?? null,
        });
      }
      const [, hold, weak] = statsFor(b);
      const stats: OutputStat[] = [
        { label: 'Lines changed', value: String(o.changed.length) },
        { label: 'Not rerun', value: String(total - o.changed.length) },
      ];
      if (hold) stats.push(hold);
      if (weak) stats.push(weak);
      return { headline: `${label}. ${tail}`, moves, stats };
    }
    case 'rescue': {
      const g = b.results?.g;
      if (!g || !b.course) throw new Error('A rescue output needs results and a course');
      for (const t of b.course.actions.slice(0, 3)) moves.push({ text: t, lineId: null });
      const stats: OutputStat[] = pack.res.stats(b, g).map((s) => ({ label: s.l, value: s.v }));
      if (b.results?.hold) {
        stats.push({ label: pack.res.holdShort, value: `${b.results.hold}%` });
      }
      return { headline: pack.res.head(b, g), moves, stats };
    }
    case 'date': {
      const sorted = b.dates.slice().sort((x, y) => x.overlap - y.overlap);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      const mid = sorted[1];
      if (!best || !worst) throw new Error('A date check needs rival dates');
      const verb = VERB[r.category];
      const headline =
        b.chosenDate === worst.date
          ? `Move off ${b.chosenDate}. ${verb} ${best.date} instead.`
          : `${verb} ${best.date}. Avoid ${worst.date}.`;
      moves.push({
        text: `${verb} ${best.date}. It shares the least audience (${best.overlap}) with ${best.rival}.`,
        lineId: best.id,
      });
      moves.push({
        text: `Avoid ${worst.date}. ${worst.rival} shares ${worst.overlap} of your audience.`,
        lineId: worst.id,
      });
      if (mid && mid !== best && mid !== worst) {
        moves.push({
          text: `${mid.date} against ${mid.rival} is the fallback at ${mid.overlap}.`,
          lineId: mid.id,
        });
      }
      const stats = b.dates.map((d) => ({
        label: `${d.date} vs ${d.rival}`,
        value: String(d.overlap),
      }));
      return { headline, moves, stats };
    }
    case 'partner': {
      const p = b.partners.find((x) => x.id === o.focusIds[0]) ?? b.partners[0];
      if (!p) throw new Error('A partner brief needs a partner');
      moves.push({ text: `Open with the evidence: ${p.ev}.`, lineId: p.id });
      moves.push({ text: `Aim it at ${p.fits}, the segment it fits.`, lineId: p.id });
      moves.push({
        text: 'Review the draft before it goes anywhere. Oraqul sends nothing.',
        lineId: null,
      });
      return {
        headline: `Approach ${p.name} first. ${p.ev}.`,
        moves,
        stats: [
          { label: 'Type', value: p.type },
          { label: 'Fits', value: p.fits },
        ],
      };
    }
  }
}

function confidenceFor(r: Project, pack: DemoPack, o: DOutput): Output['confidence'] {
  const b = o.brief;
  const c = counts(b);
  const n = b.assumptions.length;
  const viaComps = !r.qlooMatch || r.qlooMatch.startsWith('Matched by');
  const note = viaComps
    ? ` The ${pack.noun} is not in Qloo, so audience figures come from ${pack.fallback}.`
    : '';
  if (o.kind === 'date') {
    return {
      level: 'medium',
      why: `Dates come from ${o.src === 'calendar' ? 'the public calendar' : 'you'}. Qloo supplies how much each rival shares your audience.`,
    };
  }
  if (o.kind === 'partner') {
    return {
      level: 'high',
      why: 'Based on a direct Qloo affinity match for the segments the plan targets.',
    };
  }
  if (o.kind === 'rescue') {
    return {
      level: 'medium',
      why: `The numbers are yours. The new picks rest on Qloo data for ${pack.fallback}.`,
    };
  }
  let level: Output['confidence']['level'] = viaComps ? 'medium' : 'high';
  if (c.breaks >= 2 || c.cant >= 3) level = 'low';
  return {
    level,
    why: `${c.holds} of ${n} assumptions hold and ${c.cant} could not be tested.${note}`,
  };
}

function glanceFor(pack: DemoPack, r: Project, b: DBrief): GlanceRow[] {
  const rows: GlanceRow[] = [];
  for (const s of pack.sec) {
    const x = topFit(b[s.k]);
    if (x)
      rows.push({ label: s.one, name: x.name, value: String(x.fit), lineId: x.id, note: x.ev });
  }
  const top = b.places.slice().sort((x, y) => y.lift - x.lift)[0];
  if ((r.category === 'film' || r.category === 'games') && top) {
    rows.push({
      label: r.category === 'film' ? 'Top territory' : 'Top region',
      name: top.name,
      value: `${top.lift.toFixed(1)}x`,
      lineId: top.id,
      note: 'Highest lift over a neutral audience',
    });
  }
  const firstStop = b.places[0];
  if (r.category === 'music' && firstStop) {
    const score = routeScore(b.places);
    const best = routeScore(b.places.slice().sort((x, y) => y.lift - x.lift));
    rows.push({
      label: 'Route score',
      name: b.places.map((p) => p.name).join(', '),
      value: `${score.toFixed(2)}x`,
      lineId: firstStop.id,
      note:
        best > score + 0.005
          ? `The best order scores ${best.toFixed(2)}x`
          : 'This is the best order',
    });
  }
  const closest = b.shelf?.slice().sort((x, y) => y.ov - x.ov)[0];
  if (r.category === 'books' && closest) {
    rows.push({
      label: 'Closest comp',
      name: closest.name,
      value: String(closest.ov),
      lineId: closest.id,
      note: 'Share of readers who overlap',
    });
  }
  const own = b.topics?.filter((t) => t.kind === 'distinct').sort((x, y) => y.w - x.w)[0];
  if (r.category === 'podcasts' && own) {
    rows.push({
      label: 'Topic only you own',
      name: own.name,
      value: `${own.w}x`,
      lineId: own.id,
      note: 'Tag weight against rival shows',
    });
  }
  return rows;
}

const GROUP_NAME: Partial<Record<FoundLine['k'], string>> = {
  assumptions: 'Assumptions',
  audience: 'Audience',
  places: 'Places',
  dates: 'Rival dates',
  partners: 'Partners',
  shelf: 'Comp shelf',
  bridge: 'Adaptation bridge',
  topics: 'Topics',
  grid: 'Support act fit',
  fan: 'Fan base bridge',
};

function evidenceFor(pack: DemoPack, o: DOutput, moves: Move[]): EvidenceRow[] {
  const b = o.brief;
  let ids = allLineIds(b);
  if (o.focusIds.length) ids = o.focusIds;
  else if (o.kind === 'scenario' || o.kind === 'rescue') ids = o.changed;
  const driverIds = new Set(moves.map((m) => m.lineId));
  const rows: EvidenceRow[] = [];
  for (const id of ids) {
    const f = findLine(b, id);
    if (!hasReceipt(f)) continue;
    const section = pack.sec.find((s) => s.k === f.k);
    const verdict = f.k === 'assumptions' ? f.it.verdict : undefined;
    rows.push({
      lineId: id,
      label: itemLabel(b, id),
      group: section?.t ?? GROUP_NAME[f.k] ?? f.k,
      verdict,
      returned: returnedOf(f, b),
      driver: driverIds.has(id) || verdict === 'breaks' || verdict === 'weak',
    });
  }
  return rows;
}

function receiptsFor(r: Project, o: DOutput): Receipt[] {
  const b = o.brief;
  const receipts: Receipt[] = [];
  for (const id of allLineIds(b)) {
    const f = findLine(b, id);
    if (!hasReceipt(f)) continue;
    receipts.push({
      callId: uuidFrom(`call:${o.id}:${id}`),
      lineId: id,
      endpoint: endpointOf(f),
      input: { entities: [r.name, ...r.comps] },
      returned: returnedOf(f, b),
      rule: ruleOf(f),
      confidence: lineConfidence(f),
      calledAt: o.at,
      source: 'demo',
    });
  }
  return receipts;
}

/** Serialises a demo output the way the API will: everything the screens show, computed here. */
export function buildOutput(r: Project, o: DOutput, all: DOutput[]): Output {
  const pack = PACKS[r.category];
  const sameKind = all.filter((x) => x.kind === o.kind);
  const n = sameKind.findIndex((x) => x.id === o.id) + 1;
  const parent = o.parentId ? all.find((x) => x.id === o.parentId) : undefined;
  const { headline, moves, stats } = headlineFor(r, pack, o, parent);
  const confidence = confidenceFor(r, pack, o);
  const prefix = { plan: 'v', scenario: 'S', audit: 'A', rescue: 'R', date: 'D', partner: 'B' };
  const summary = [
    headline,
    ...moves.map((m, i) => `${i + 1}. ${m.text}`),
    `Confidence: ${confidence.level.charAt(0).toUpperCase()}${confidence.level.slice(1)}. ${confidence.why}`,
  ].join('\n');

  return outputSchema.parse({
    id: o.id,
    projectId: o.projectId,
    threadId: o.threadId,
    kind: o.kind,
    parentId: o.parentId,
    title: o.title,
    label: o.kind === 'plan' ? `v${n} · ${o.title}` : o.title,
    shortLabel: `${prefix[o.kind]}${n}`,
    kindLabel: kindLabel(pack, o.kind),
    createdBy: o.by,
    createdAt: o.at,
    headline,
    moves,
    confidence,
    stats,
    counts: counts(o.brief),
    summary,
    changes: changesFor(o, parent),
    focusIds: o.focusIds,
    dateSource: o.src,
    tabs: tabsFor(pack, o),
    sections: pack.sec.map((s) => ({ key: s.k, title: s.t, one: s.one })),
    glance: isPlanKind(o.kind) ? glanceFor(pack, r, o.brief) : [],
    brief: toBrief(o.brief, r.category),
    evidence: evidenceFor(pack, o, moves),
    receipts: receiptsFor(r, o),
    limits: `Confidence shows how much Qloo data sits behind a line. Qloo shows current taste, not history. ${pack.cov.none[0] ?? ''}. For titles and names Qloo does not know, Oraqul falls back to ${pack.fallback} at lower confidence.`,
    resultsCopy:
      o.kind === 'rescue'
        ? {
            dateLabel: pack.res.dateLabel,
            chartTitle: pack.res.chartA,
            chartNote: pack.res.chartSub,
            groupNoun: pack.res.aNoun,
            secondaryTitle: pack.res.chartT,
            holdShort: pack.res.holdShort,
            holdNote: pack.res.holdSub,
            placesTitle:
              r.category === 'film' ? 'Territories still to open' : 'Places still to plan',
          }
        : undefined,
  });
}

/** Line by line difference between two plan outputs, for `GET /projects/:id/compare`. */
export function compareBriefs(a: DBrief, b: DBrief): LineChange[] {
  const fa = flat(a);
  const fb = flat(b);
  const ids = [...new Set([...fa.keys(), ...fb.keys()])].filter((id) => fa.get(id) !== fb.get(id));
  return ids.map((lineId) => {
    const before = fa.get(lineId);
    const after = fb.get(lineId);
    return {
      lineId,
      label: findLine(b, lineId) ? itemLabel(b, lineId) : itemLabel(a, lineId),
      before: before === undefined ? null : pretty(before),
      after: after === undefined ? null : pretty(after),
    };
  });
}

export { isPlanKind };
