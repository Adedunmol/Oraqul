import type { Finding, LaunchLine, LaunchSection, LaunchSectionKey } from '@oraqul/schema';
import { normalise } from '../router/decide.js';
import { slug } from './brief.js';

const MAX_MOVES = 3;

/** The words the guarantees write, which differ by category. */
export interface DecisionWords {
  titles: Record<LaunchSectionKey, string>;
  /** The first move: where to open and in what order. */
  opening(home: string, others: string[], strongest: string | undefined): string;
  /** The first move when no city could be named as home. */
  openingAsPlanned(cities: string[]): string;
  /** What to add for cities Qloo could not rank. */
  unranked(cities: string[]): string;
  /** A city's role in plain words, from the verdict on it. */
  role(verdict: Finding['verdict']): string;
  /** The market line for a city with no reading. */
  unreadCity: string;
  /** The positioning line for a comp the writer passed over. */
  comp(name: string): string;
}

const mentions = (lines: LaunchLine[], name: string) =>
  lines.some((l) => normalise(l.text).includes(normalise(name)));

/**
 * The team's decisions always get an answer (PRD goal 2). A city Qloo could not rank is said
 * plainly, never left out.
 */
export function ensureDecisions(
  sections: LaunchSection[],
  input: {
    cities: string[];
    ranked: string[];
    findings: Finding[];
    /** The team's city in the film's country of origin, which anchors the premiere. */
    home: string | null;
    comps: string[];
  },
  words: DecisionWords,
): LaunchSection[] {
  const out = ensureCities(sections, input, words);
  return ensureComps(out, input.comps, words);
}

function ensureCities(
  sections: LaunchSection[],
  input: {
    cities: string[];
    ranked: string[];
    findings: Finding[];
    home: string | null;
  },
  words: DecisionWords,
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
      s = { key, title: words.titles[key], lines: [] };
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
      ? words.opening(home, others, strongest)
      : words.openingAsPlanned(input.cities);
    const thin = unranked.length ? words.unranked(unranked) : '';
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
            `Plan ${city} as ${words.role(tested.verdict)}.`,
            tested,
            city,
          )
        : line(`markets-${slug(city)}`, words.unreadCity, undefined, city),
    );
  }
  return out;
}

// Every comp the team named gets a line in Positioning, so none is passed over in silence.
function ensureComps(
  sections: LaunchSection[],
  comps: string[],
  words: DecisionWords,
): LaunchSection[] {
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
              text: words.comp(c),
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
