import { filmPlan } from '@oraqul/packs';
import type { Finding, LaunchLine, LaunchSection } from '@oraqul/schema';
import { normalise } from '../router/decide.js';
import { slug } from './brief.js';
import { list } from './findings.js';
import { marketRole } from './writer.js';

const MAX_MOVES = 3;

const mentions = (lines: LaunchLine[], name: string) =>
  lines.some((l) => normalise(l.text).includes(normalise(name)));

/**
 * The team's decisions always get an answer (PRD goal 2): the bottom line names every city
 * they chose, in the order the findings support, and Markets has a line for each. A city Qloo
 * could not rank is said plainly, never left out. Written by code when the writer missed it.
 */
export function ensureDecisions(
  sections: LaunchSection[],
  input: {
    cities: string[];
    ranked: string[];
    findings: Finding[];
    /** The team's city in the film's country of origin, which anchors the premiere. */
    home: string | null;
    /** The comps the team named. */
    comps: string[];
  },
): LaunchSection[] {
  const out = ensureCities(sections, input);
  return ensureComps(out, input.comps);
}

function ensureCities(
  sections: LaunchSection[],
  input: {
    cities: string[];
    ranked: string[];
    findings: Finding[];
    home: string | null;
  },
): LaunchSection[] {
  if (input.cities.length === 0) return sections;
  const markets = input.findings.find((f) => f.id === 'f-markets');
  const unranked = input.cities.filter(
    (c) => !input.ranked.some((r) => normalise(r) === normalise(c)),
  );
  const line = (id: string, text: string, finding: Finding | undefined, group: string | null) =>
    ({
      id,
      kind: finding ? 'grounded' : 'playbook',
      text,
      findingIds: finding ? [finding.id] : [],
      sourceIds: [],
      names: [],
      group,
    }) satisfies LaunchLine;

  const out = sections.map((s) => ({ ...s, lines: [...s.lines] }));
  const section = (key: LaunchSection['key']) => {
    let s = out.find((x) => x.key === key);
    if (!s) {
      s = { key, title: filmPlan.SECTION_TITLES[key], lines: [] };
      out.splice(key === 'bottom-line' ? 0 : out.length, 0, s);
    }
    return s;
  };

  const bottom = section('bottom-line');
  if (input.cities.some((c) => !mentions(bottom.lines, c))) {
    const [strongest] = input.ranked;
    const home = input.home ?? strongest ?? input.cities[0];
    const others = input.cities.filter((c) => normalise(c) !== normalise(home ?? ''));
    const order = home
      ? `Premiere in ${home}, then open ${list(others)} within the same fortnight, so piracy and spoilers do not get there first.${strongest ? ` Put the most spend and community work into ${strongest}, where your audience is strongest.` : ''}`
      : `Open in ${list(input.cities)} as you planned.`;
    const thin = unranked.length
      ? ` Build ${list(unranked)} around the diaspora community and partner moves below.`
      : '';
    bottom.lines.unshift(
      line('bottom-line-cities', `${order}${thin}`, strongest ? markets : undefined, null),
    );
    bottom.lines = bottom.lines.slice(0, MAX_MOVES);
  }

  const marketLines = section('markets');
  for (const city of input.cities) {
    const has = marketLines.lines.some(
      (l) => (l.group && normalise(l.group) === normalise(city)) || mentions([l], city),
    );
    if (has) continue;
    const tested = input.findings.find((f) => f.id === `f-a-place-${slug(city)}`);
    const ranked = input.ranked.some((r) => normalise(r) === normalise(city));
    marketLines.lines.push(
      ranked && tested
        ? line(
            `markets-${slug(city)}`,
            `Plan ${city} as ${marketRole(tested.verdict)}.`,
            tested,
            city,
          )
        : line(
            `markets-${slug(city)}`,
            'Build the release here on the diaspora community: church and campus screenings, the music and brand partners below, and the cast at opening weekend.',
            undefined,
            city,
          ),
    );
  }
  return out;
}

/** Every comp the team named gets a line in Positioning, so none is passed over in silence. */
function ensureComps(sections: LaunchSection[], comps: string[]): LaunchSection[] {
  if (comps.length === 0) return sections;
  const positioning = sections.find((s) => s.key === 'positioning');
  if (!positioning) return sections;
  const missing = comps.filter((c) => !mentions(positioning.lines, c));
  if (missing.length === 0) return sections;
  return sections.map((s) =>
    s === positioning
      ? {
          ...s,
          lines: [
            ...s.lines,
            ...missing.map((c) => ({
              id: `positioning-comp-${slug(c)}`,
              kind: 'playbook' as const,
              text: `Pitch the film to buyers and press in the company of ${c}, one of the titles your audience already knows.`,
              findingIds: [],
              sourceIds: [],
              names: [c],
              group: 'Comps',
            })),
          ],
        }
      : s,
  );
}
