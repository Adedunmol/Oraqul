import { cityNames } from '@oraqul/engine';
import { ASSET_OFFER, BAND_LABEL, type BudgetBand, bandCarries } from '@oraqul/packs';
import type {
  DroppedLine,
  Finding,
  LaunchLine,
  LaunchSection,
  LaunchSectionKey,
  PlanSource,
} from '@oraqul/schema';
import { normalise } from '../router/decide.js';
import type { AgeBand } from './read-core.js';
import type { WrittenLine, WrittenSection } from './writer.js';

const MAX_MOVES = 3;
// Shorter names are too likely to match an ordinary word ("Up", "Us").
const MIN_NAME = 4;

/** What differs by category: the section titles, the taste-claim words, the tag-only queries. */
export interface CheckRules {
  titles: Record<LaunchSectionKey, string>;
  tasteClaim: RegExp;
  /** Queries whose entities are ordinary words (theme tags), so they are not names to check. */
  tagOnly: readonly string[];
  /** Counts a category sells in, such as wishlists, that need a source like any money figure. */
  figureWords?: RegExp;
}

export interface CheckContext {
  rules: CheckRules;
  findings: Finding[];
  /** Facts found on the web for this plan, which a line may cite and state. */
  sources: PlanSource[];
  /** Every name the brief gives: the title, comps used, cities, cast, soundtrack, partners. */
  briefNames: string[];
  /** The person's own words, whose numbers any line may repeat. */
  briefText: string;
  teamCities: string[];
  teamAges: AgeBand[];
  /** The plan's sections: the core plus its modules. */
  allowed: LaunchSectionKey[];
  /** The budget band the plan is sized for. A band that cannot carry flagship partners drops them. */
  band?: BudgetBand | null;
  /** Flagship brands for the plan's market, which only a mid-size or major budget can carry. */
  flagships?: string[];
  /** Partners the team already signed, which are never dropped for budget. */
  teamPartners?: string[];
}

const has = (haystack: string, needle: string) => {
  const n = normalise(needle);
  return n.length > 0 && ` ${normalise(haystack)} `.includes(` ${n} `);
};

// A link, an email address or a phone number. Text from an upload or a web page can ask a model to
// put one in a plan, and nothing else in this check would stop it, so a line may carry one only if
// the person's own words or a page the line cites already contain it.
const CONTACT = /\bhttps?:\/\/\S+|\bwww\.\S+|[\w.+-]+@[\w-]+\.[\w.-]+|\+\d[\d\s().-]{7,}\d/gi;

// Words a marketing team would not use, and talk about the measurement instead of the move.
const JARGON =
  /\b(lift|index(?:es)?|indexing|affinity|cells|qloo|findings?|could not be (?:tested|ranked|measured)|not enough data|limited (?:market )?(?:testing )?data|low confidence)\b/i;

// Money, sales or audience sizes: facts that need a source, never the model's memory.
const MARKET_FIGURE =
  /[₦$£€]\s?\d|\b\d[\d,.]*\s?(billion|million|bn|thousand|admissions|tickets|screens)\b/i;

// "T-4 weeks", "8 weeks", "90 days": the plan's own schedule, not a claim about the data.
const TIMING = /\bT\s?[-–]\s?\d+\b|\b\d+\s?(?:weeks?|days?|months?|hours?)\b/gi;

// Every name a finding returned. Theme tags are ordinary words ("community"), so they are out.
function dictionaryOf(findings: Finding[], tagOnly: readonly string[]): string[] {
  return [
    ...new Set(
      findings
        .filter((f) => !tagOnly.includes(f.query))
        .flatMap((f) => [...f.entities.map((e) => e.name), f.context.city ?? ''])
        .filter((n) => n.length >= MIN_NAME),
    ),
  ];
}

/**
 * A line that names something Qloo returned is grounded and cites it, rather than dropped. The
 * team's cities alone do not ground a line: every plan names them.
 */
export function citeWhatIsNamed(written: WrittenLine, ctx: CheckContext): WrittenLine {
  const resolved = resolveCitations(written, ctx);
  // A line that cites findings rests on them, whatever kind the writer gave it.
  const line: WrittenLine =
    resolved.kind === 'playbook' && resolved.findingIds.length
      ? { ...resolved, kind: 'grounded' }
      : resolved;
  const named = dictionaryOf(ctx.findings, ctx.rules.tagOnly).filter(
    (n) => names(line.text, n) && !ctx.teamCities.some((c) => same(c, n)),
  );
  if (named.length === 0) return asKind(line);
  const extra = ctx.findings
    .filter((f) => f.entities.some((e) => named.some((n) => same(n, e.name))))
    .map((f) => f.id)
    .filter((id) => !line.findingIds.includes(id));
  // Each name needs one finding; the first that has it is enough.
  const needed = named.flatMap((n) => {
    if (
      line.findingIds.some((id) =>
        ctx.findings.find((f) => f.id === id)?.entities.some((e) => same(e.name, n)),
      )
    )
      return [];
    const first = extra.find((id) =>
      ctx.findings.find((f) => f.id === id)?.entities.some((e) => same(e.name, n)),
    );
    return first ? [first] : [];
  });
  const findingIds = [...new Set([...line.findingIds, ...needed])];
  return asKind({ ...line, findingIds });
}

// A line with no finding behind it is a playbook line, whatever the writer called it.
function asKind(line: WrittenLine): WrittenLine {
  return { ...line, kind: line.findingIds.length ? 'grounded' : 'playbook' };
}

// "f-a-place-houston" and "f-place-houston" are the same finding to a reader, and to us.
const canon = (id: string) => id.toLowerCase().replace(/^f-a-/, 'f-').replace(/-a-/g, '-');

// Models garble ids: a web source in the finding list, or a finding id with a segment dropped.
// Put each id where it belongs and drop one that matches nothing, instead of dropping a whole
// line for a typo. A line left with no citation still has to pass as a playbook line.
function resolveCitations(line: WrittenLine, ctx: CheckContext): WrittenLine {
  const asSource = (id: string) => ctx.sources.find((src) => src.id === id)?.id;
  const asFinding = (id: string) =>
    ctx.findings.find((f) => f.id === id || canon(f.id) === canon(id))?.id;
  const sourceIds = [
    ...new Set([
      ...line.sourceIds.flatMap((id) => asSource(id) ?? []),
      ...line.findingIds.flatMap((id) => asSource(id) ?? []),
    ]),
  ];
  const findingIds = [
    ...new Set([
      ...line.findingIds.flatMap((id) => (asSource(id) ? [] : (asFinding(id) ?? []))),
      ...line.sourceIds.flatMap((id) => (asSource(id) ? [] : (asFinding(id) ?? []))),
    ]),
  ];
  return { ...line, findingIds, sourceIds };
}

// A name written as a name: same case, whole words. So "Industry" the series, not the word.
const names = (text: string, name: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escapeName(name)}($|[^\\p{L}\\p{N}])`, 'u').test(
    text.replace(/[’‘]/g, "'"),
  );

function escapeName(text: string): string {
  return text.replace(/[’‘]/g, "'").replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const numbers = (text: string) =>
  [...text.matchAll(/(?<![\p{L}\d])-?\d+(?:[.,]\d+)*(?![\p{L}\d])/gu)].map((m) =>
    Number(m[0].replace(/,/g, '')),
  );

// A flagship the team did not name already. A signed partner is theirs, whatever the budget.
function flagshipIn(line: WrittenLine, ctx: CheckContext): string | null {
  const signed = new Set((ctx.teamPartners ?? []).map((p) => normalise(p)));
  return (
    (ctx.flagships ?? []).find((name) => !signed.has(normalise(name)) && names(line.text, name)) ??
    null
  );
}

/** The line check (spec §6.2). Returns why a line fails, or null. */
export function checkLine(
  section: LaunchSectionKey,
  line: WrittenLine,
  ctx: CheckContext,
): string | null {
  if (!ctx.allowed.includes(section)) return 'It is in a section this plan does not have.';
  if (!line.text.trim()) return 'It is empty.';
  // "endpoint" alone is an ordinary word ("the campaign's endpoint"), so only a call's is flagged.
  if (/\b(receipts?|call ids?)\b|\b(?:api|qloo) endpoints?\b|\/v2\//i.test(line.text)) {
    return 'It mentions receipts or calls, which belong in the Evidence tab.';
  }
  if (JARGON.test(line.text)) {
    return 'It uses data jargon or talks about what was measured; the plan speaks plainly.';
  }
  if (ASSET_OFFER.test(line.text)) {
    return 'It offers to make the ad, trailer, image or video; Oraqul writes the guide or script and a person makes it.';
  }
  const flagship = ctx.band && !bandCarries(ctx.band, 'A') ? flagshipIn(line, ctx) : null;
  if (flagship) {
    return `It proposes ${flagship}, a flagship partner that a ${BAND_LABEL[ctx.band as BudgetBand].toLowerCase()} budget cannot carry.`;
  }
  const dictionary = dictionaryOf(ctx.findings, ctx.rules.tagOnly);
  const webCited = line.sourceIds.map((id) => ctx.sources.find((src) => src.id === id));
  const unknown = line.sourceIds.find((_, i) => !webCited[i]);
  if (unknown) return `It cites ${unknown}, which is not a web source of this plan.`;
  const sourced = webCited.filter((src): src is PlanSource => src !== undefined);
  // A figure is fine when a page it cites states it. The same goes for a date or a name.
  const sourceText = sourced.map((src) => src.fact).join(' ');

  const contact = line.text
    .match(CONTACT)
    ?.find((c) => !ctx.briefText.includes(c) && !sourceText.includes(c));
  if (contact) {
    return `It carries ${contact}, a link or contact detail that neither the brief nor a page it cites contains.`;
  }

  if (line.kind === 'playbook') {
    // Launch practice may name anything the model knows: distributors, regulators, rival
    // releases, neighbourhoods. What it may not do is claim taste, or invent a market figure.
    if (line.findingIds.length) return 'A playbook line cites a finding; it should be grounded.';
    if (ctx.rules.tasteClaim.test(line.text)) {
      return 'It claims what an audience likes without citing a finding.';
    }
    const figure = (text: string) =>
      MARKET_FIGURE.test(text) || (ctx.rules.figureWords?.test(text) ?? false);
    if (figure(line.text) && !figure(sourceText)) {
      return 'It states a market figure with no source.';
    }
    // A line that cites a page may use only the page's own numbers.
    const off =
      sourced.length > 0
        ? numbers(line.text.replace(TIMING, '')).find(
            (n) => !numbers(sourceText).includes(n) && !numbers(ctx.briefText).includes(n),
          )
        : undefined;
    if (off !== undefined) return `It states ${off}, a number the page it cites does not.`;
  } else {
    if (line.findingIds.length === 0) return 'A grounded line cites no finding.';
    const cited = line.findingIds.map((id) => ctx.findings.find((f) => f.id === id));
    const missing = line.findingIds.find((_, i) => !cited[i]);
    if (missing) return `It cites ${missing}, which is not a finding of this run.`;
    const found = cited.filter((f): f is Finding => f !== undefined);
    const allowed = [
      ...ctx.briefNames,
      ...found.flatMap((f) => [
        ...f.entities.map((e) => e.name),
        ...(f.context.city ? [f.context.city] : []),
        ...f.context.tags,
      ]),
    ];
    const inText = (n: string) => found.some((f) => has(f.text, n));
    // `names` are what the line recommends because of the audience, so each must be in a
    // finding it cites. Other names in the text (a distributor, a regulator) are launch knowledge.
    const named = [...line.names, ...dictionary.filter((n) => names(line.text, n))];
    const outside = named.find((n) => !allowed.some((a) => same(a, n)) && !inText(n));
    if (outside) return `It names ${outside}, which the findings it cites do not.`;
    if (
      MARKET_FIGURE.test(line.text) &&
      !found.some((f) => MARKET_FIGURE.test(f.text)) &&
      !MARKET_FIGURE.test(sourceText)
    ) {
      return 'It states a market figure the findings it cites do not.';
    }
    // Any figure this run's findings state may be repeated: an age group from one finding is as
    // true in a line that cites another. What may not appear is a figure from nowhere.
    const known = new Set([
      ...ctx.findings.flatMap((f) => [...Object.values(f.numbers), ...numbers(f.text)]),
      ...numbers(sourceText),
      ...numbers(ctx.briefText),
      ...named.flatMap(numbers),
    ]);
    const stray = numbers(line.text.replace(TIMING, '')).find((n) => !known.has(n));
    if (stray !== undefined) return `It states ${stray}, a number the findings it cites do not.`;
    // An index or a lift is not a share of people, so a percent must come from a finding's text.
    if (/%|\bper ?cent\b/i.test(line.text) && !found.some((f) => /%|\bper ?cent\b/i.test(f.text))) {
      return 'It turns an index or a lift into a percentage.';
    }
  }

  // Worth a look is only for the cities ranked beside the team's (spec §5.2).
  if (
    line.group &&
    /^worth a look$/i.test(line.group.trim()) &&
    !line.findingIds.includes('f-worth-a-look')
  ) {
    return 'Worth a look is for alternative cities, from the Worth a look finding only.';
  }

  if (section === 'bottom-line') return checkBottomLine(line, ctx);
  return null;
}

// The team's decisions are constraints: no city they did not choose in the bottom line.
function checkBottomLine(line: WrittenLine, ctx: CheckContext): string | null {
  const cities = [
    ...cityNames(),
    ...ctx.findings
      .filter((f) => f.query === 'markets')
      .flatMap((f) => f.entities.map((e) => e.name)),
  ];
  const other = cities.find((c) => has(line.text, c) && !ctx.teamCities.some((t) => same(t, c)));
  if (other && ctx.teamCities.length) {
    return `It puts ${other}, a city the team did not choose, in the bottom line. Alternatives go under Worth a look.`;
  }
  return null;
}

/** Checks every line, gives each kept one an id, and keeps the drops so none is silent. */
export function checkSections(
  written: WrittenSection[],
  ctx: CheckContext,
): { sections: LaunchSection[]; dropped: DroppedLine[] } {
  const dropped: DroppedLine[] = [];
  const kept = new Map<LaunchSectionKey, LaunchLine[]>();
  for (const section of written) {
    const lines = kept.get(section.key) ?? [];
    for (const written of section.lines) {
      const line = citeWhatIsNamed(written, ctx);
      const why =
        section.key === 'bottom-line' && lines.length >= MAX_MOVES
          ? 'The bottom line has at most three moves.'
          : lines.some((l) => normalise(l.text) === normalise(line.text))
            ? 'It repeats an earlier line in the section.'
            : checkLine(section.key, line, ctx);
      if (why) {
        dropped.push({ section: section.key, text: line.text, why });
        continue;
      }
      lines.push({ ...line, id: `${section.key}-${lines.length + 1}` });
    }
    kept.set(section.key, lines);
  }
  const sections = ctx.allowed.flatMap((key) => {
    const lines = kept.get(key);
    return lines?.length ? [{ key, title: ctx.rules.titles[key], lines }] : [];
  });
  return { sections, dropped };
}

// A name can arrive with a tell-apart in brackets, such as a year or an address, and Qloo's own
// names carry brackets too ("Dominion Chapel Houston (DCH)"). Compared without them.
const bare = (name: string) => name.replace(/\s*\([^)]*\)/g, '').trim();

function same(a: string, b: string): boolean {
  return normalise(bare(a)) === normalise(bare(b));
}
