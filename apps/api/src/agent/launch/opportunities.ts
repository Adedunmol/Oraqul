import { OPPORTUNITY_RULES, type OpportunityKind } from '@oraqul/packs';
import type {
  Finding,
  LaunchLine,
  LaunchSection,
  Opportunity,
  Output,
  Signal,
} from '@oraqul/schema';
import { slug } from './brief.js';

// What the evidence points to beyond the brief: nearby markets and areas of the team's own cities.
// Code reads findings the run already made, so this asks Qloo nothing. It never fills a quota: a
// kind with no finding yields nothing. Opportunities sit beside the plan and change none of it.

export const WORTH_GROUP = 'Worth a look';

export const isWorthLine = (line: Pick<LaunchLine, 'group'>) =>
  /^worth a look$/i.test((line.group ?? '').trim());

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

const line = (id: string, text: string, findingIds: string[], names: string[]): LaunchLine => ({
  id,
  kind: findingIds.length ? 'grounded' : 'playbook',
  text,
  findingIds,
  sourceIds: [],
  names,
  group: WORTH_GROUP,
});

export interface OpportunityInput {
  findings: Finding[];
  /** "Worth a look" cities that beat the weakest team city, strongest first. */
  worth: { place: string }[];
  /** The team's cities in order of strength, strongest first. */
  teamOrder: { place: string }[];
  signal: Signal | null;
}

export interface Opportunities {
  opportunities: Opportunity[];
  lines: LaunchLine[];
}

function build(
  kind: OpportunityKind,
  key: string,
  name: string,
  city: string | null,
  why: { text: string; findingIds: string[]; names: string[] },
  values: Record<string, string>,
): { opportunity: Opportunity; lines: LaunchLine[] } {
  const rule = OPPORTUNITY_RULES.kinds[kind].value;
  const id = `opp-${kind}-${key}`;
  const names = [name, ...(city ? [city] : [])];
  const lines = [
    line(`${id}-why`, why.text, why.findingIds, why.names),
    line(`${id}-limit`, fill(rule.limit, values), [], names),
    line(`${id}-test`, fill(rule.test, values), [], names),
    line(`${id}-measure`, fill(rule.measure, values), [], names),
  ];
  return {
    opportunity: {
      id,
      kind,
      name,
      city,
      findingIds: why.findingIds,
      lines: {
        why: lines[0]?.id ?? '',
        limit: lines[1]?.id ?? '',
        test: lines[2]?.id ?? '',
        measure: lines[3]?.id ?? '',
      },
    },
    lines,
  };
}

export function opportunitiesOf(input: OpportunityInput): Opportunities {
  const weakest = input.teamOrder.at(-1)?.place ?? 'your weakest city';
  const signal = input.signal?.primary ?? 'the one signal your plan uses';
  const out: Opportunities = { opportunities: [], lines: [] };
  const push = (made: { opportunity: Opportunity; lines: LaunchLine[] }) => {
    out.opportunities.push(made.opportunity);
    out.lines.push(...made.lines);
  };

  // Markets: only cities the shared heatmap call ranked above the team's weakest.
  const worth = input.findings.find((f) => f.id === 'f-worth-a-look');
  if (worth) {
    for (const { place } of input.worth) {
      if (!worth.entities.some((e) => e.name === place)) continue;
      push(
        build(
          'market',
          slug(place),
          place,
          null,
          {
            text: `${place} ranks above ${weakest} for this audience. Weigh it beside your cities, not instead of them.`,
            findingIds: [worth.id],
            names: [place, weakest],
          },
          { name: place, weakest, signal },
        ),
      );
    }
  }

  // Areas: the strongest area of each team city, from the neighbourhood reading of that city.
  for (const { place: city } of input.teamOrder) {
    const areas = input.findings.find((f) => f.id === `f-areas-${slug(city)}`);
    const top = areas?.entities[0];
    if (!areas || !top) continue;
    const second = areas.entities[1];
    push(
      build(
        'area',
        `${slug(city)}-${slug(top.name)}`,
        top.name,
        city,
        {
          text: `In ${city}, the audience is strongest around ${top.name}${second ? ` and ${second.name}` : ''}.`,
          findingIds: [areas.id],
          names: [city, top.name, ...(second ? [second.name] : [])],
        },
        { name: top.name, city, signal },
      ),
    );
  }
  return out;
}

/**
 * Puts the opportunity lines in the markets section in place of the writer's own Worth a look
 * lines, which say the same thing in one line for every city and carry no limit or test.
 */
export function withOpportunities(
  sections: LaunchSection[],
  found: Opportunities,
): LaunchSection[] {
  if (found.lines.length === 0) return sections;
  const replaces = found.opportunities.some((o) => o.kind === 'market');
  return sections.map((s) =>
    s.key === 'markets'
      ? {
          ...s,
          lines: [...(replaces ? s.lines.filter((l) => !isWorthLine(l)) : s.lines), ...found.lines],
        }
      : s,
  );
}

/**
 * The plan as the team's own, for an audit or fix that reads it back as text: what the evidence
 * pointed to beyond the brief is not the team's choice, so it must not become one.
 */
export function withoutOpportunities(output: Output): Output {
  if (!output.plan) return output;
  const sections = output.plan.sections.map((s) => ({
    ...s,
    lines: s.lines.filter((l) => !isWorthLine(l)),
  }));
  return { ...output, plan: { ...output.plan, sections } };
}
