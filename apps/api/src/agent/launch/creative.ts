import { CREATIVE, channelStyle } from '@oraqul/packs';
import type {
  Category,
  Finding,
  LaunchLine,
  LaunchPlan,
  LaunchSection,
  LaunchSectionKey,
  Move,
  Output,
  OverallConfidence,
  Receipt,
  Territory,
} from '@oraqul/schema';
import { slug } from './brief.js';
import { type CheckContext, checkLine } from './check.js';
import type { LaunchConfig } from './config.js';
import type { FollowUpDeps } from './follow-ups.js';
import type { LaunchInputs, PlanRun } from './pipeline.js';
import type { LaunchRead } from './read-core.js';
import { codeLine } from './signal.js';
import { releaseDate } from './text.js';
import type { WrittenLine } from './writer.js';

export const KIT_SECTIONS = ['hooks', 'scripts', 'shots', 'keyart', 'captions'] as const;

/** The territory and channel a message names, from the plan's own territories and the rule library. */
export function kitTarget(
  text: string,
  plan: LaunchPlan,
): { territory: Territory; channel: string } | null {
  const lower = text.toLowerCase();
  const territory =
    plan.territories.find((t) => lower.includes(t.name.toLowerCase())) ?? plan.territories[0];
  if (!territory) return null;
  const channel =
    territory.channels.find((c) => lower.includes(c.name.toLowerCase()))?.name ??
    territory.channels[0]?.name ??
    'the lead channel';
  return { territory, channel };
}

const grounded = (id: string, text: string, finding: Finding, group: string): LaunchLine => ({
  id,
  kind: 'grounded',
  text,
  findingIds: [finding.id],
  sourceIds: [],
  names: finding.entities.map((e) => e.name),
  group,
});

const names = (items: string[]) => {
  const last = items.at(-1);
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${last}` : (last ?? '');
};

/**
 * The guides for one territory on one channel: hooks, a script outline, a shot list, a key art
 * brief and a caption pack. Written by code from the plan's findings and the rule library; a
 * person makes the final creative. Lines that cite a finding name only what the finding returned.
 */
export function buildKit(input: {
  category: Category;
  title: string;
  plan: LaunchPlan;
  territory: Territory;
  channel: string;
  release: string | null;
}): LaunchSection[] {
  const { category, title, plan, territory, channel, release } = input;
  const group = `${territory.name} · ${channel}`;
  const id = (key: string, n: number) => `${key}-${slug(territory.name)}-${slug(channel)}-${n}`;
  const rule = CREATIVE[category].value;
  const style = channelStyle(channel);
  const when = release ? `on ${release}` : 'soon';
  const line = (key: string, n: number, text: string) => codeLine(id(key, n), text, group);

  const themes = plan.findings.find((f) => f.query === 'themes' && f.entities.length > 0);
  const places = plan.findings.find(
    (f) =>
      f.entities.length > 0 &&
      f.context.city?.toLowerCase() === territory.name.toLowerCase() &&
      ['cinemas', 'venues', 'community', 'bookshops'].includes(f.query),
  );

  const first = rule.shots[0] ?? 'The strongest image';
  const hooks: LaunchLine[] = [
    line('hooks', 1, `Hook one: open on this, in the first two seconds. ${first}`),
    line(
      'hooks',
      2,
      'Hook two: open on the question this release answers, as text on screen over the first shot.',
    ),
    line(
      'hooks',
      3,
      `Hook three: open on ${territory.name} itself, the street, the room or the screen it will play on, with the name on screen.`,
    ),
  ];
  const scripts: LaunchLine[] = [
    line(
      'scripts',
      1,
      `Script outline for ${title} on ${channel}, 25 seconds, ${style}. 0 to 3 seconds: the hook you picked. 3 to 10: who it is for and the one thing that sets it apart. 10 to 20: ${rule.proof}. 20 to 25: the ask, with the date ${when}.`,
    ),
    line(
      'scripts',
      2,
      `Record two versions of the opening and post the one that keeps people watching longest. Write the final words yourself in the voice of ${territory.name}.`,
    ),
  ];
  const shots: LaunchLine[] = rule.shots.map((shot, i) =>
    line('shots', i + 1, `Shot ${i + 1}: ${shot}`),
  );
  const keyart: LaunchLine[] = [
    line(
      'keyart',
      1,
      `Key art brief: one image, the title ${title}, and at most one line of text. Say what the image must show, what to avoid and where it will be seen, then hand it to a designer. Oraqul does not draw it.`,
    ),
    ...(themes
      ? [
          grounded(
            id('keyart', 2),
            `Take the tone from ${names(themes.entities.slice(0, 3).map((e) => e.name))}.`,
            themes,
            group,
          ),
        ]
      : []),
  ];
  const captions: LaunchLine[] = [
    line(
      'captions',
      1,
      `Caption one: “${title} opens ${when} in ${territory.name}. Who are you taking?” Put the link in the first line.`,
    ),
    line(
      'captions',
      2,
      'Caption two: a question, not a pitch. Ask what the place has to do with the story.',
    ),
    ...(places
      ? [
          grounded(
            id('captions', 3),
            `Tag the places that rank highest with this audience in ${territory.name}: ${names(places.entities.slice(0, 3).map((e) => e.name))}.`,
            places,
            group,
          ),
        ]
      : []),
    line(
      'captions',
      4,
      'Use two or three tags: the title, the city and the genre. Check them before posting; Oraqul does not know which are trending.',
    ),
  ];

  const by: Record<(typeof KIT_SECTIONS)[number], LaunchLine[]> = {
    hooks,
    scripts,
    shots,
    keyart,
    captions,
  };
  return KIT_SECTIONS.map((key) => ({
    key,
    title: KIT_TITLE[key],
    lines: by[key],
  }));
}

const KIT_TITLE: Record<(typeof KIT_SECTIONS)[number], string> = {
  hooks: 'Hook options',
  scripts: 'Scripts',
  shots: 'Shot lists',
  keyart: 'Key art briefs',
  captions: 'Caption packs',
};

/** A creative kit: guides for one territory and channel, saved as an output on the plan. */
export async function runCreativeKit<R extends LaunchRead>(
  deps: Pick<FollowUpDeps<R>, 'emit' | 'config'>,
  plan: Output,
  inputs: LaunchInputs<R>,
  text: string,
  title: string,
): Promise<PlanRun> {
  const source = plan.plan;
  const config: LaunchConfig<R> = deps.config;
  const target = source ? kitTarget(text, source) : null;
  if (!source || !target) {
    deps.emit({
      type: 'message',
      body: 'The creative kit is written per territory, and this plan has none yet. Plan with at least one city and ask again.',
      claims: [],
    });
    return { reason: 'finished', state: null, receipts: [], output: null, tokens: 0 };
  }
  deps.emit({
    type: 'trace.step',
    agent: config.category,
    step: 1,
    of: 2,
    text: `Writing the guides for ${target.territory.name} on ${target.channel}`,
  });
  const sections = buildKit({
    category: config.category,
    title,
    plan: source,
    territory: target.territory,
    channel: target.channel,
    release: releaseDate(inputs.read.window),
  });

  // The same line check as a plan: a kit line that fails is dropped and recorded.
  const ctx: CheckContext = {
    rules: config.rules,
    findings: source.findings,
    sources: [],
    briefNames: [title, ...inputs.read.places, ...source.comps.map((c) => c.name)],
    briefText: text,
    teamCities: inputs.read.places,
    teamAges: inputs.read.ages,
    allowed: [...KIT_SECTIONS] as LaunchSectionKey[],
  };
  const dropped: LaunchPlan['dropped'] = [];
  const kept = sections.map((s) => ({
    ...s,
    lines: s.lines.filter((l) => {
      const why = checkLine(s.key, l as WrittenLine, ctx);
      if (why) dropped.push({ section: s.key, text: l.text, why });
      return !why;
    }),
  }));
  const lines = kept.flatMap((s) => s.lines);
  const cited = new Set(lines.flatMap((l) => l.findingIds));
  const findings = source.findings.filter((f) => cited.has(f.id));

  // A grounded line shows the receipt of the call behind its finding.
  const receipts: Receipt[] = lines.flatMap((l) => {
    const f = findings.find((x) => x.id === l.findingIds[0]);
    const call = f && plan.receipts.find((r) => f.callIds.includes(r.callId));
    return call ? [{ ...call, lineId: l.id, rule: f?.why ? `${f.why}.` : call.rule }] : [];
  });

  const kit: LaunchPlan = {
    ...source,
    scope: 'narrow',
    sections: kept,
    findings,
    sources: [],
    dropped,
    writer: 'template',
    understanding: null,
    review: null,
    process: null,
    signal: null,
    territories: [],
    calls: [],
    partners: [],
  };
  const headline = `Creative kit for ${target.territory.name} on ${target.channel}: guides for the team that makes the final creative.`;
  const moves: Move[] = [
    { text: 'Pick one hook and test it against the other two.', lineId: null },
    {
      text: 'Hand the key art brief and the shot list to the person who makes them.',
      lineId: null,
    },
    { text: 'Write the final words yourself, in the voice of the city.', lineId: null },
  ];
  const confidence: OverallConfidence = findings.length
    ? {
        level: findings.some((f) => f.confidence === 'lower') ? 'low' : 'medium',
        why: 'Only the tone and the places come from Qloo; the rest is launch craft.',
      }
    : { level: 'medium', why: 'Built from launch craft and the plan, with no new Qloo claim.' };

  deps.emit({ type: 'message', body: headline, claims: [] });
  return {
    reason: 'finished',
    state: null,
    receipts,
    output: {
      kind: 'creative',
      title: `Creative kit: ${target.territory.name} · ${target.channel}`,
      brief: plan.brief,
      plan: kit,
      report: null,
      headline,
      moves,
      confidence,
      inputs,
    },
    tokens: 0,
  };
}
