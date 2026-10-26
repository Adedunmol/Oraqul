import type {
  AffectedLine,
  Finding,
  FindingMove,
  LaunchPlan,
  NumberMove,
  PlanSource,
  RankMove,
  SourceMove,
} from '@oraqul/schema';

// Setting a fresh check beside what a plan saved, in code. A finding is `moved` or `unchanged` only
// when the plan already had it, and a page is `changed` only when the plan saved a fact from the
// same page. Anything else is `new` or not returned: the check may simply have asked a little
// differently, so a missing finding is never reported as a change.

/** A number moved when it differs by this share of what it was, or by this much from zero. */
export const MOVE_SHARE = 0.1;
export const MOVE_FROM_ZERO = 0.1;
const MAX_RANKS = 6;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function numberMoves(before: Finding, after: Finding): NumberMove[] {
  return Object.entries(after.numbers).flatMap(([key, now]) => {
    const was = before.numbers[key];
    if (was === undefined) return [];
    const gap = Math.abs(now - was);
    const moved = was === 0 ? gap >= MOVE_FROM_ZERO : gap / Math.abs(was) >= MOVE_SHARE;
    return moved ? [{ key, before: was, after: now }] : [];
  });
}

/** Names in either list whose place changed, strongest movers first, and names that came or went. */
function rankMoves(before: Finding, after: Finding): RankMove[] {
  const names = [...before.entities.map((e) => e.name), ...after.entities.map((e) => e.name)];
  const unique = names.filter((n, i) => names.findIndex((m) => sameName(m, n)) === i);
  const place = (list: Finding['entities'], name: string) => {
    const at = list.findIndex((e) => sameName(e.name, name));
    return at === -1 ? null : at + 1;
  };
  return unique
    .map((name) => ({
      name,
      before: place(before.entities, name),
      after: place(after.entities, name),
    }))
    .filter((r) => r.before !== r.after)
    .sort(
      (x, y) =>
        Math.abs((y.after ?? 99) - (y.before ?? 99)) - Math.abs((x.after ?? 99) - (x.before ?? 99)),
    )
    .slice(0, MAX_RANKS);
}

export function compareFindings(saved: Finding[], fresh: Finding[]): FindingMove[] {
  const moves: FindingMove[] = fresh.map((now) => {
    const was = saved.find((f) => f.id === now.id);
    if (!was) return { findingId: now.id, status: 'new', text: now.text, numbers: [], ranks: [] };
    const numbers = numberMoves(was, now);
    const ranks = rankMoves(was, now);
    return {
      findingId: now.id,
      status: numbers.length > 0 || ranks.length > 0 ? 'moved' : 'unchanged',
      text: now.text,
      numbers,
      ranks,
    };
  });
  for (const was of saved) {
    if (fresh.some((f) => f.id === was.id)) continue;
    moves.push({
      findingId: was.id,
      status: 'not-returned',
      text: was.text,
      numbers: [],
      ranks: [],
    });
  }
  return moves;
}

/** A page's address without the scheme, `www.` or a trailing slash, so the same page matches. */
export function pageKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

const words = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Matches fresh facts to the plan's saved sources by page. A page is the only thing matched on. */
export function compareSources(
  saved: PlanSource[],
  fresh: PlanSource[],
  today: string,
): SourceMove[] {
  const moves: SourceMove[] = [];
  const claimed = new Set<string>();
  for (const now of fresh) {
    const key = pageKey(now.url);
    const was = saved.find((s) => pageKey(s.url) === key);
    if (was) claimed.add(was.id);
    moves.push({
      status: !was ? 'new' : words(was.fact) === words(now.fact) ? 'same' : 'changed',
      title: now.title,
      url: now.url,
      before: was?.fact ?? null,
      after: now.fact,
      retrievedAt: now.retrievedAt ?? today,
    });
  }
  for (const was of saved) {
    if (claimed.has(was.id) || fresh.some((f) => pageKey(f.url) === pageKey(was.url))) continue;
    moves.push({
      status: 'not-found-again',
      title: was.title,
      url: was.url,
      before: was.fact,
      after: null,
      retrievedAt: null,
    });
  }
  return moves;
}

const MAX_AFFECTED = 12;

/** The plan's lines that rest on a finding that moved or a page that changed or went missing. */
export function affectedLines(
  plan: LaunchPlan,
  findings: FindingMove[],
  sources: SourceMove[],
): AffectedLine[] {
  const findingIds = new Set(
    findings
      .filter((f) => f.status === 'moved' || f.status === 'not-returned')
      .map((f) => f.findingId),
  );
  const urls = new Set(
    sources
      .filter((s) => s.status === 'changed' || s.status === 'not-found-again')
      .map((s) => pageKey(s.url)),
  );
  const sourceIds = new Set(plan.sources.filter((s) => urls.has(pageKey(s.url))).map((s) => s.id));
  return plan.sections
    .filter((s) => s.key !== 'gaps')
    .flatMap((s) => s.lines)
    .filter(
      (l) =>
        l.findingIds.some((id) => findingIds.has(id)) ||
        l.sourceIds.some((id) => sourceIds.has(id)),
    )
    .slice(0, MAX_AFFECTED)
    .map((l) => ({ lineId: l.id, group: l.group, text: l.text }));
}
