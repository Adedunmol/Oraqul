import { CALENDAR_RULES } from '@oraqul/packs';
import type {
  CalendarRow,
  CampaignGuide,
  Category,
  GuideKind,
  GuideLine,
  LaunchLine,
  LaunchPlan,
  Territory,
  TestAngle,
} from '@oraqul/schema';
import { buildKit } from './creative.js';

// A saved plan's calendar as actions a team can run. Code writes every one from the plan's own
// rows and the creative kit, so nothing here asks Qloo or a model. Each action is playbook; its
// guide may carry grounded lines from the kit, and those keep the findings they cite. They are
// guides the team adapts, not made assets (launch rules D8).

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The release date a plan's calendar was worked back from, or null when its rows carry no dates. */
export function releaseOf(rows: CalendarRow[]): string | null {
  const dated = rows.find((r) => r.from);
  if (!dated?.from) return null;
  const from = Date.parse(`${dated.from}T00:00:00Z`);
  return Number.isNaN(from) ? null : day(from - dated.at * WEEK_MS);
}

const VIDEO = /\b(trailer|teaser|clip|video|audiogram|gameplay)\b/i;
const IMAGE = /\b(key art|poster|cover|still)\b/i;
const NOT_CREATIVE = /\b(pitch|screener|pre-save|link)\b/i;

/**
 * Which part of the kit helps with a row. Video leads with hooks, an image with the key art brief,
 * a press pitch or a link has no creative to guide, and anything else is a post, so it gets captions.
 */
export function guideKindFor(asset: string | null): GuideKind | null {
  if (!asset) return 'captions';
  if (NOT_CREATIVE.test(asset)) return null;
  if (IMAGE.test(asset)) return 'keyart';
  if (VIDEO.test(asset)) return 'hooks';
  return 'captions';
}

const guideLine = (l: LaunchLine): GuideLine => ({
  id: l.id,
  text: l.text,
  kind: l.kind,
  findingIds: l.findingIds,
});

export interface ActionDraft {
  rowId: string | null;
  territory: string | null;
  channel: string;
  title: string;
  asset: string | null;
  startsOn: string | null;
  endsOn: string | null;
  week: number;
  guide: CampaignGuide | null;
  findingIds: string[];
  position: number;
}

/** The kit's section for one territory and channel, which several rows share. */
function kitSection(
  input: { category: Category; title: string; plan: LaunchPlan; release: string | null },
  territory: Territory,
  channel: string,
  kind: GuideKind,
): CampaignGuide {
  const sections = buildKit({ ...input, territory, channel });
  const lines = sections.find((s) => s.key === kind)?.lines ?? [];
  return { kind, lines: lines.map(guideLine) };
}

/** One action for each row of the plan's calendar, in the calendar's order. */
export function actionsFromPlan(input: {
  category: Category;
  title: string;
  plan: LaunchPlan;
}): ActionDraft[] {
  const { plan } = input;
  const release = releaseOf(plan.calendar);
  const kit = { ...input, release };
  const cache = new Map<string, CampaignGuide>();
  return plan.calendar.map((row, position) => {
    const territory = plan.territories.find((t) => t.name === row.territory);
    const kind = guideKindFor(row.asset);
    let guide: CampaignGuide | null = null;
    if (territory && kind) {
      const key = `${territory.name}|${row.channel}|${kind}`;
      guide = cache.get(key) ?? kitSection(kit, territory, row.channel, kind);
      cache.set(key, guide);
    }
    return {
      rowId: row.id,
      territory: row.territory,
      channel: row.channel,
      title: row.post,
      asset: row.asset,
      startsOn: row.from,
      endsOn: row.to,
      week: row.at,
      guide,
      findingIds: [...new Set(guide?.lines.flatMap((l) => l.findingIds) ?? [])],
      position,
    };
  });
}

export interface TestDraft {
  angles: [TestAngle, TestAngle];
  measure: string;
  conventions: string[];
}

/**
 * Two creative angles for one action's territory and channel. The first is the tone the audience's
 * themes point to when a finding names it, and a hook otherwise; the second is the place itself.
 * Each carries why. Nothing says which will win, and the measure is the plan's one signal.
 */
export function testFor(input: {
  category: Category;
  title: string;
  plan: LaunchPlan;
  territory: Territory;
  channel: string;
}): TestDraft {
  const { plan, territory, channel } = input;
  const kit = buildKit({ ...input, release: releaseOf(plan.calendar) });
  const lines = (key: string) => kit.find((s) => s.key === key)?.lines ?? [];
  const tone = lines('keyart').find((l) => l.kind === 'grounded');
  const hooks = lines('hooks');
  const first = tone ?? hooks[0];
  const place = hooks.at(-1);
  const angle = (
    id: 'a' | 'b',
    label: string,
    line: LaunchLine | undefined,
    fallback: string,
  ): TestAngle => ({
    id,
    label,
    text: line?.text ?? fallback,
    basis: line?.kind ?? 'playbook',
    findingIds: line?.findingIds ?? [],
  });
  const signal = plan.signal?.primary;
  const conventions = CALENDAR_RULES.ads.value.lines.filter((l) =>
    /three to five ads|conversion count/i.test(l),
  );
  return {
    angles: [
      angle(
        'a',
        tone ? 'Angle A: the audience’s tone' : 'Angle A: the strongest image',
        first,
        `Open on the strongest image of the release on ${channel}.`,
      ),
      angle(
        'b',
        `Angle B: ${territory.name} itself`,
        place,
        `Open on ${territory.name} itself, with the name on screen.`,
      ),
    ],
    measure: `Run both for ${territory.name} on ${channel} with the same budget and audience, and compare conversions toward ${signal ?? 'the one signal your plan uses'}.`,
    conventions,
  };
}
