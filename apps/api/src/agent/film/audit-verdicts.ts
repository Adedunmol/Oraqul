import type {
  Confidence,
  Finding,
  FindingEntity,
  ReportItem,
  ReportSubject,
  Verdict,
} from '@oraqul/schema';
import { normalise } from '../router/decide.js';
import { ageLabel, slug } from './brief.js';
import type { Grounded } from './findings.js';
import type { FilmRead } from './read.js';
import type { WrittenLine } from './writer.js';

// Spec §5.3. A named partner or artist is tested by where Qloo ranks it among the candidates it
// ranked in one call. Starting values, `TODO(verify)` on a live run before a report leads with them.
const MIN_RANKED = 3;
const ARTIST_TOP = 3;

/** An item before code has checked its fix line. */
export interface DraftItem extends Omit<ReportItem, 'fix'> {
  fix: WrittenLine | null;
}

const same = (a: string, b: string) => normalise(a) === normalise(b);

// "Nike" and "Nike Inc" are the same brand to a reader.
const sameName = (a: string, b: string) => {
  const x = normalise(a);
  const y = normalise(b);
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
};

/** Where the plan says something: its sentence, and the file or message it is in. */
export function sourceOf(text: string, needle: RegExp | string): string | null {
  const pattern =
    typeof needle === 'string'
      ? new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(needle)}($|[^\\p{L}\\p{N}])`, 'iu')
      : needle;
  const parts = text.split(/\[File: ([^\]\n]+)\]\n/);
  const blocks = [
    { label: 'Your message', body: parts[0] ?? '' },
    ...Array.from({ length: Math.floor((parts.length - 1) / 2) }, (_, i) => ({
      label: parts[1 + i * 2] ?? 'File',
      body: parts[2 + i * 2] ?? '',
    })),
  ];
  for (const block of blocks) {
    const sentence = block.body.split(/(?<=[.!?])\s+|\n+/).find((s) => pattern.test(s));
    if (sentence) return `${block.label}: “${shorten(sentence.trim())}”`;
  }
  return null;
}

function shorten(sentence: string): string {
  return sentence.length > 110 ? `${sentence.slice(0, 107).trimEnd()}...` : sentence;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Top third holds, the middle third is weak, the bottom third breaks. Fewer than three candidates
 * is no basis for a rank, so it is not tested.
 */
export function rankVerdict(position: number, ranked: number): Verdict {
  if (ranked < MIN_RANKED) return 'cant';
  if (position <= Math.ceil(ranked / 3)) return 'holds';
  if (position > ranked - Math.floor(ranked / 3)) return 'breaks';
  return 'weak';
}

const asConfidence = (c: Confidence | undefined): Confidence => c ?? 'lower';

/**
 * Turns what a plan says into items, each tested by the findings of this run. The age, gender,
 * place and comps beliefs were already tested by the grounding step; partners and artists are
 * tested here from the ranked lists it asked for. Verdicts come from values Qloo returned and
 * rules in the spec, never from a model (hard rule 1).
 */
export function testPlan(input: { read: FilmRead; text: string; grounded: Grounded }): DraftItem[] {
  const { read, text, grounded } = input;
  const findings = grounded.findings;
  const byId = (id: string) => findings.find((f) => f.id === id);
  const items: DraftItem[] = [];

  for (const a of grounded.brief.brief.assumptions) {
    const finding = byId(`f-${a.id}`);
    const subject: ReportSubject = a.id.startsWith('a-place')
      ? 'place'
      : a.id === 'a-age'
        ? 'age'
        : a.id === 'a-gender'
          ? 'gender'
          : 'comps';
    const placeName =
      subject === 'place' ? read.places.find((p) => a.id === `a-place-${slug(p)}`) : null;
    items.push({
      id: a.id,
      subject,
      claim: a.text,
      source: a.unstated
        ? null
        : subject === 'place' && placeName
          ? sourceOf(text, placeName)
          : subject === 'age'
            ? sourceOf(text, /\b\d{2}\s*(?:to|-|–)\s*\d{2}\b|\baged?\b|\b(?:under|over)\s*\d{2}\b/i)
            : subject === 'gender'
              ? sourceOf(text, /\b(women|female|men|male)\b/i)
              : null,
      unstated: a.unstated,
      verdict: a.verdict,
      confidence: asConfidence(finding?.confidence),
      findingIds: finding ? [finding.id] : [],
      why: a.why,
      fix:
        a.verdict === 'weak' || a.verdict === 'breaks'
          ? fixFor(a.id, subject, placeName, grounded)
          : null,
    });
  }

  const brandFindings = findings.filter((f) => f.query === 'brands');
  for (const partner of read.partners) {
    const hit = brandFindings
      .map((f) => ({ f, at: f.entities.findIndex((e) => sameName(e.name, partner)) }))
      .find((h) => h.at !== -1);
    const claim = `${partner} is the right partner for this launch`;
    const source = sourceOf(text, partner);
    const id = `a-partner-${slug(partner)}`;
    if (!hit) {
      items.push({
        id,
        subject: 'partner',
        claim,
        source,
        unstated: false,
        verdict: 'cant',
        confidence: 'lower',
        findingIds: [],
        why: 'Qloo did not rank this brand against others, so there was nothing to compare it with.',
        fix: null,
      });
      continue;
    }
    const position = hit.at + 1;
    const total = hit.f.entities.length;
    const verdict = rankVerdict(position, total);
    items.push({
      id,
      subject: 'partner',
      claim,
      source,
      unstated: false,
      verdict,
      confidence: verdict === 'cant' ? 'lower' : asConfidence(hit.f.confidence),
      findingIds: [hit.f.id],
      why:
        verdict === 'cant'
          ? `Only ${total} brands were ranked, too few to say where ${partner} stands.`
          : `${partner} ranks ${position} of ${total} among the brands asked about${hit.f.context.city ? ` in ${hit.f.context.city}` : ''}.`,
      fix: verdict === 'weak' || verdict === 'breaks' ? fixPartner(partner, hit.f) : null,
    });
  }

  const musicFindings = findings.filter((f) => f.query === 'music');
  for (const artist of read.soundtrack) {
    const hit = musicFindings
      .map((f) => ({ f, at: f.entities.findIndex((e) => sameName(e.name, artist)) }))
      .find((h) => h.at !== -1);
    const id = `a-artist-${slug(artist)}`;
    const claim = `${artist} suits the audience`;
    const source = sourceOf(text, artist);
    if (!hit) {
      items.push({
        id,
        subject: 'artist',
        claim,
        source,
        unstated: false,
        verdict: 'cant',
        confidence: 'lower',
        findingIds: [],
        why: 'This artist is not among the ones Qloo ranked for the audience, which is not a test of the artist.',
        fix: null,
      });
      continue;
    }
    const position = hit.at + 1;
    const verdict: Verdict = position <= ARTIST_TOP ? 'holds' : 'weak';
    items.push({
      id,
      subject: 'artist',
      claim,
      source,
      unstated: false,
      verdict,
      confidence: asConfidence(hit.f.confidence),
      findingIds: [hit.f.id],
      why: `${artist} ranks ${position} among the artists the audience likes most${hit.f.context.city ? ` in ${hit.f.context.city}` : ''}.`,
      fix: verdict === 'weak' ? fixArtist(artist, hit.f) : null,
    });
  }

  if (read.window) {
    items.push({
      id: 'a-window',
      subject: 'other',
      claim: `The release window is ${read.window}`,
      source: sourceOf(text, read.window),
      unstated: false,
      verdict: 'cant',
      confidence: 'lower',
      findingIds: [],
      why: 'Qloo has taste data, not release calendars. Timing is checked with the rival date check.',
      fix: null,
    });
  }
  return items;
}

const line = (
  text: string,
  kind: WrittenLine['kind'],
  findingIds: string[],
  names: string[],
): WrittenLine => ({ kind, text, findingIds, sourceIds: [], names, group: null });

/**
 * What to do about a belief that is weak or breaks. A team's choices are constraints, so a fix
 * reorders them or adds a stronger option beside them. It never says to drop one (spec §5.2).
 */
function fixFor(
  id: string,
  subject: ReportSubject,
  place: string | null | undefined,
  grounded: Grounded,
): WrittenLine | null {
  const has = (fid: string) => grounded.findings.some((f) => f.id === fid);
  if (subject === 'place' && place) {
    const strongest = grounded.brief.teamOrder[0];
    if (!strongest || same(strongest.place, place) || !has('f-markets')) return null;
    return line(
      `Keep ${place}, and open it after ${strongest.place}, where your comps’ audience is strongest.`,
      'grounded',
      ['f-markets', `f-${id}`],
      [place, strongest.place],
    );
  }
  if (subject === 'age') {
    const best = Object.entries(grounded.brief.ages).sort((a, b) => b[1] - a[1])[0];
    if (!best || !has('f-audience')) return null;
    return line(
      `Keep your age group, and lead the creative with people ${ageLabel(best[0]).toLowerCase()}, the strongest part of it.`,
      'grounded',
      ['f-audience'],
      [],
    );
  }
  if (subject === 'gender')
    return line('Do not narrow the campaign by gender.', 'playbook', [], []);
  if (subject === 'comps') {
    return line('Add or swap comps so no single title carries the result.', 'playbook', [], []);
  }
  return null;
}

function fixPartner(partner: string, finding: Finding): WrittenLine | null {
  const better = finding.entities.find((e: FindingEntity) => !sameName(e.name, partner));
  if (!better) return null;
  return line(
    `Keep ${partner}, and approach ${better.name} as well: your comps’ audience likes it more.`,
    'grounded',
    [finding.id],
    [partner, better.name],
  );
}

function fixArtist(artist: string, finding: Finding): WrittenLine | null {
  const better = finding.entities.filter((e) => !sameName(e.name, artist)).slice(0, 2);
  if (better.length === 0) return null;
  return line(
    `Keep ${artist}, and look at ${better.map((e) => e.name).join(' and ')} first: they rank higher with your comps’ audience${finding.context.city ? ` in ${finding.context.city}` : ''}.`,
    'grounded',
    [finding.id],
    [artist, ...better.map((e) => e.name)],
  );
}
