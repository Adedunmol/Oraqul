import { cityNames } from '@oraqul/engine';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import { normalise } from '../router/decide.js';
import type { TranscriptLine } from '../router/reader.js';
import { type AgeBand, ageBands, bandsBetween, escapeRegExp } from './read.js';

const quote = z.string().min(1);
const said = <T extends z.ZodType>(value: T) => z.object({ value, quote });

/** What the model reads from a message sent after the plan exists. Values carry the person's words. */
export const followUpReadingSchema = z.object({
  /**
   * answer: a question about the plan. scenario: a what-if that changes places, comps or the
   * audience. date: rival releases to check against. partner: a brief for a partner.
   */
  job: z.enum(['answer', 'scenario', 'date', 'partner']),
  addPlaces: z.array(said(z.string().min(1))).max(6),
  dropPlaces: z.array(said(z.string().min(1))).max(6),
  addComps: z.array(said(z.string().min(1))).max(5),
  dropComps: z.array(said(z.string().min(1))).max(5),
  ages: z.array(said(z.enum(ageBands))).max(6),
  gender: said(z.enum(['male', 'female'])).nullable(),
  /** Rival releases: the title as written, and its opening date as YYYY-MM-DD. */
  rivals: z.array(z.object({ title: said(z.string().min(1)), date: said(z.iso.date()) })).max(6),
  /** The partner the person wants a brief for, as written. */
  partner: said(z.string().min(1)).nullable(),
});
export type FollowUpReading = z.infer<typeof followUpReadingSchema>;

/** A change a what-if makes to the plan's inputs. */
export interface Change {
  addPlaces: string[];
  dropPlaces: string[];
  addComps: string[];
  dropComps: string[];
  ages: AgeBand[];
  gender: 'male' | 'female' | null;
}

export type FollowUp =
  | { job: 'answer' }
  | { job: 'scenario'; change: Change }
  | { job: 'date'; rivals: { title: string; date: string }[] }
  | { job: 'partner'; partner: string | null };

export interface FollowUpInput {
  text: string;
  /** The chat before it, oldest first, so "and London?" can be read. */
  recent: TranscriptLine[];
  title: string;
}

export interface FollowUpReader {
  read(input: FollowUpInput): Promise<{ reading: FollowUpReading; tokens: number }>;
}

function inWords(quoteText: string, text: string): boolean {
  const q = normalise(quoteText);
  return q !== '' && normalise(text).includes(q);
}

/**
 * Keeps only what the person said, then code picks the job. The model's own job is used only when
 * no rule matches.
 */
export function decideFollowUp(reading: FollowUpReading, { text }: FollowUpInput): FollowUp {
  const values = (items: { value: string; quote: string }[]) =>
    items.flatMap((i) => (inWords(i.quote, text) ? [i.value.trim()] : []));
  const change: Change = {
    addPlaces: values(reading.addPlaces),
    dropPlaces: values(reading.dropPlaces),
    addComps: values(reading.addComps).filter((c) => inWords(c, text)),
    dropComps: values(reading.dropComps),
    ages: reading.ages.flatMap((a) => (inWords(a.quote, text) ? [a.value] : [])),
    gender: reading.gender && inWords(reading.gender.quote, text) ? reading.gender.value : null,
  };
  const rivals = reading.rivals.flatMap((r) =>
    inWords(r.title.quote, text) && inWords(r.date.quote, text)
      ? [{ title: r.title.value.trim(), date: r.date.value }]
      : [],
  );
  const partner =
    reading.partner && inWords(reading.partner.quote, text) ? reading.partner.value.trim() : null;
  const changed =
    change.addPlaces.length +
      change.dropPlaces.length +
      change.addComps.length +
      change.dropComps.length +
      change.ages.length >
      0 || change.gender !== null;

  if (rivals.length) return { job: 'date', rivals };
  if (/\bpartner|\boutreach\b|\bsponsor/i.test(text) && reading.job === 'partner') {
    return { job: 'partner', partner };
  }
  if (changed) return { job: 'scenario', change };
  if (reading.job === 'date') return { job: 'date', rivals: [] };
  if (reading.job === 'partner') return { job: 'partner', partner };
  return { job: 'answer' };
}

export const FOLLOW_UP_SYSTEM = `You read a message a person sent about their film or series launch plan, for Oraqul, a launch planner that tests every claim against Qloo taste data.

Rules:
- Never guess. Fill a field only from the person's own words, and put those exact words in "quote", copied character for character.
- job: "scenario" when they ask what happens if something changes (other cities, other comps, another age group or gender). "date" when they name rival releases and dates to check. "partner" when they want a brief or outreach for a partner brand or podcast. Otherwise "answer".
- addPlaces and dropPlaces: cities they want to add to or take out of the plan.
- addComps and dropComps: comparable films or series to add or remove, titles exactly as written.
- ages: map what they say about age to Qloo's bands (24_and_younger, 25_to_29, 30_to_34, 35_to_44, 45_to_54, 55_and_older).
- rivals: each rival title as written and its opening date as YYYY-MM-DD. Quote the date as they wrote it.
- partner: the partner's name as written, if they named one.`;

export class ModelFollowUpReader implements FollowUpReader {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async read({ text, recent, title }: FollowUpInput) {
    const speaker = { person: 'Person', oraqul: 'Oraqul', pick: 'Person picked the option' };
    const chat = recent.map((l) => `${speaker[l.from]}: ${l.text}`).join('\n');
    const { output, usage } = await generateText({
      model: this.model,
      system: FOLLOW_UP_SYSTEM,
      prompt: `Launch title: ${title}\n\nEarlier in the chat:\n${chat}\n\nMessage to read:\n${text}`,
      output: Output.object({ schema: followUpReadingSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { reading: output, tokens: usage.totalTokens ?? 0 };
  }
}

const DROP = /\b(drop|without|remove|skip|not|instead of|no)\s+$/i;

/** Scripted reader for runs with no model key: reads only what is plainly written. */
export class ScriptedFollowUpReader implements FollowUpReader {
  async read({ text }: FollowUpInput) {
    const before = (index: number) => text.slice(Math.max(0, index - 16), index);
    const places = cityNames().flatMap((city) => {
      const at = normalise(text).search(
        new RegExp(`(^|[^\\p{L}])${escapeRegExp(normalise(city))}([^\\p{L}]|$)`, 'u'),
      );
      if (at === -1) return [];
      return [{ city, drop: DROP.test(before(at + 1)) }];
    });
    const titles = [...text.matchAll(/["“]([^"”]{2,80})["”]/g)].flatMap((m) =>
      m[1] ? [{ title: m[1], at: m.index ?? 0 }] : [],
    );
    const dates = [...text.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].flatMap((m) =>
      m[1] ? [{ date: m[1], at: m.index ?? 0 }] : [],
    );
    const rivals = dates.flatMap(({ date, at }) => {
      const title = titles.filter((t) => t.at < at).at(-1);
      return title
        ? [
            {
              title: { value: title.title, quote: title.title },
              date: { value: date, quote: date },
            },
          ]
        : [];
    });
    const partner = text.match(/partner brief for ["“]?([^"”.,!?]+)/i)?.[1]?.trim();
    const ages = [...text.matchAll(/(\d{2})\s*(?:to|-|–)\s*(\d{2})/g)].flatMap((m) => {
      const [phrase, from, to] = m;
      return bandsBetween(Number(from), Number(to)).map((value) => ({ value, quote: phrase }));
    });
    const comps = rivals.length ? [] : titles;
    const reading: FollowUpReading = {
      job: rivals.length
        ? 'date'
        : partner
          ? 'partner'
          : /what if/i.test(text)
            ? 'scenario'
            : 'answer',
      addPlaces: places.filter((p) => !p.drop).map((p) => ({ value: p.city, quote: p.city })),
      dropPlaces: places.filter((p) => p.drop).map((p) => ({ value: p.city, quote: p.city })),
      addComps: comps
        .filter((t) => !DROP.test(before(t.at)))
        .map((t) => ({ value: t.title, quote: t.title })),
      dropComps: comps
        .filter((t) => DROP.test(before(t.at)))
        .map((t) => ({ value: t.title, quote: t.title })),
      ages,
      gender: null,
      rivals,
      partner: partner ? { value: partner, quote: partner } : null,
    };
    return { reading, tokens: 0 };
  }
}

/** Falls back to the scripted reader when the model fails. */
export class FallbackFollowUpReader implements FollowUpReader {
  constructor(
    private readonly primary: FollowUpReader,
    private readonly fallback: FollowUpReader,
    private readonly onError: (err: unknown) => void,
  ) {}

  async read(input: FollowUpInput) {
    try {
      return await this.primary.read(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.read(input);
    }
  }
}
