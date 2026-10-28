import { cityNames } from '@oraqul/engine';
import { LAUNCH_TERMS } from '@oraqul/packs';
import type { LaunchPlan, Untested } from '@oraqul/schema';
import { unaccountedNames } from '../launch/check.js';

// Reads a saved plan the way a careful reviewer would, and reports what should never reach a
// reader. It does not repeat the pipeline's own check: it looks for the failures that check missed
// in QA (a name no finding holds, a market nobody confirmed, a dead end, a guessed launch, a stale
// event, a chosen comp read as high). Run on every live plan before it is trusted.

export type Severity = 'S1' | 'S2' | 'S3';

export interface QaFinding {
  rule: string;
  severity: Severity;
  where: string;
  text: string;
}

export interface QaInput {
  plan: Pick<
    LaunchPlan,
    'sections' | 'findings' | 'sources' | 'comps' | 'partners' | 'understanding'
  >;
  cannot: Pick<Untested, 'item' | 'ask'>[];
  /** What the person wrote, whose names and numbers any line may repeat. */
  briefText: string;
  /** The day the plan was made (YYYY-MM-DD), for events that have since passed. */
  today: string;
}

// Wording that states a limit and stops. A plan line says what is closest and what would help.
const DEAD_END =
  /\b(could not|couldn[’']t|cannot|unable to|no data|nothing came back|not enough data|too thin|limited data|not found)\b/i;
const JARGON = /\b(lift|affinity|cells|qloo|findings?|confidence|endpoint|receipt)\b/i;
// The old fallback planned a brief with nothing in it as "a typical Nollywood film" and the like.
const GUESSED =
  /\ba typical (?:nollywood|afrobeats|indie|trade book|interview podcast|live comedy|film|release|launch)\b/i;
// Words that make a choice sound like the team's own.
const YOURS = /\byour (?:comps?|comparable|book'?s readers)\b/i;

const lines = (plan: QaInput['plan']) =>
  plan.sections.flatMap((s) => s.lines.map((l) => ({ section: s.key, line: l })));

export function qaCheck(input: QaInput): QaFinding[] {
  const { plan } = input;
  const out: QaFinding[] = [];
  const add = (rule: string, severity: Severity, where: string, text: string) =>
    out.push({ rule, severity, where, text });

  // Every name in the whole run, so a name in no finding at all is a stranger.
  const known = [
    input.briefText,
    ...plan.findings.flatMap((f) => [f.text, ...f.entities.map((e) => e.name)]),
    ...plan.sources.map((s) => s.fact),
    ...plan.comps.map((c) => c.name),
    ...cityNames(),
    ...LAUNCH_TERMS,
  ].join(' . ');

  for (const { section, line } of lines(plan)) {
    const where = `${section}: ${line.text.slice(0, 70)}`;
    if (line.kind === 'grounded') {
      for (const name of unaccountedNames(line.text, known)) {
        add(
          'stranger-name',
          'S1',
          where,
          `A grounded line names ${name}, which no finding, page or brief holds.`,
        );
      }
      if (line.findingIds.length === 0 && line.sourceIds.length === 0) {
        add('uncited-grounded', 'S1', where, 'A grounded line cites nothing.');
      }
    }
    if (section !== 'gaps' && DEAD_END.test(line.text)) {
      add(
        'dead-end',
        'S2',
        where,
        'The line states a limit instead of the closest thing and what would help.',
      );
    }
    if (section !== 'gaps' && JARGON.test(line.text)) {
      add('jargon', 'S3', where, 'The line uses data jargon.');
    }
    if (GUESSED.test(line.text)) {
      add(
        'guessed-launch',
        'S1',
        where,
        'The line plans a typical launch the person never described.',
      );
    }
  }

  for (const a of plan.understanding?.assumed ?? []) {
    if (GUESSED.test(a.why) || GUESSED.test(a.value)) {
      add('guessed-launch', 'S1', `assumed ${a.what}`, `Assumed ${a.value}: ${a.why}`);
    }
  }

  const chosen = plan.comps.filter((c) => c.source !== 'you');
  if (chosen.length > 0) {
    for (const f of plan.findings.filter((x) => x.query === 'audience' || x.id === 'f-audience')) {
      if (f.confidence === 'high') {
        add(
          'chosen-comps-high',
          'S1',
          f.id,
          'An audience finding reads high though the comps were chosen by Oraqul.',
        );
      }
      if (YOURS.test(f.text)) {
        add('chosen-comps-yours', 'S2', f.id, 'The finding calls comps Oraqul chose "your" comps.');
      }
    }
    for (const c of chosen) {
      if (!c.why && !c.choice) {
        add('chosen-comp-unexplained', 'S2', c.name, 'A comp Oraqul chose has no reason shown.');
      }
    }
  }

  for (const p of plan.partners) {
    if (p.kind !== 'brand' || p.from === 'team') continue;
    const confirmed =
      !!p.market &&
      (p.check?.operates.some((o) => o.country === p.market) ||
        (p.check?.state === 'verified' && p.check.country === p.market));
    if (p.market && !confirmed) {
      add(
        'unconfirmed-market',
        'S1',
        p.name,
        `${p.name} shows the market ${p.market} with nothing confirming it.`,
      );
    }
    if (!p.market && !p.check?.note) {
      add(
        'partner-no-note',
        'S2',
        p.name,
        `${p.name} has no market and no note saying what to confirm.`,
      );
    }
  }

  for (const s of plan.sources) {
    if (s.eventDate && s.eventDate < input.today) {
      add(
        'past-event',
        'S1',
        s.id,
        `A web fact describes an event on ${s.eventDate}, which has passed.`,
      );
    }
  }

  for (const c of input.cannot) {
    if (!c.ask) add('gap-no-ask', 'S2', c.item, 'A gap has no next step for the person.');
  }

  return out;
}

export function summarise(found: QaFinding[]): Record<Severity, number> {
  return {
    S1: found.filter((f) => f.severity === 'S1').length,
    S2: found.filter((f) => f.severity === 'S2').length,
    S3: found.filter((f) => f.severity === 'S3').length,
  };
}
