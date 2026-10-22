import { generateText, type LanguageModel } from 'ai';
import type { TranscriptLine } from '../router/reader.js';

export const CHAT_SUMMARIZER = Symbol('CHAT_SUMMARIZER');

/** Raw lines a chat keeps once it has outgrown `FOLD_AT`. The rest are folded into the summary. */
export const KEEP_LINES = 20;
/** Unsummarised lines at which the older ones are folded down. */
export const FOLD_AT = 40;
const MAX_SUMMARY = 1800;

export interface ChatSummarizer {
  summarize(input: { previous: string | null; lines: TranscriptLine[] }): Promise<string>;
}

export const SUMMARY_SYSTEM = `You fold the older part of a chat into a short summary so a later reply can pick up where the chat is. You get the summary so far (if any) and the lines being folded in.

Keep: what the person is trying to do, decisions and changes they made, what Oraqul concluded and any question still open. Drop pleasantries and repeats. Write plain sentences in the past tense, under 220 words, with no headings. Never add anything the lines do not say, and never write a number, score or verdict about an audience unless a line says it.`;

const name = (l: TranscriptLine) => (l.from === 'person' ? 'Person' : 'Oraqul');

export class ModelChatSummarizer implements ChatSummarizer {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async summarize({ previous, lines }: { previous: string | null; lines: TranscriptLine[] }) {
    const { text } = await generateText({
      model: this.model,
      system: SUMMARY_SYSTEM,
      prompt: [
        'Summary so far:',
        previous ?? 'none',
        '',
        'Lines to fold in:',
        ...lines.map((l) => `${name(l)}: ${l.text}`),
      ].join('\n'),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return text.trim().slice(0, MAX_SUMMARY);
  }
}

/** With no model: the person's own opening words, newest kept, so something is carried forward. */
export class ScriptedChatSummarizer implements ChatSummarizer {
  async summarize({ previous, lines }: { previous: string | null; lines: TranscriptLine[] }) {
    const said = lines
      .filter((l) => l.from === 'person')
      .map((l) => `${l.text.replace(/\s+/g, ' ').slice(0, 140)}`);
    const joined = [previous, said.length ? `The person also said: ${said.join(' / ')}` : '']
      .filter(Boolean)
      .join(' ');
    return joined.slice(-MAX_SUMMARY);
  }
}

export class FallbackChatSummarizer implements ChatSummarizer {
  constructor(
    private readonly primary: ChatSummarizer,
    private readonly fallback: ChatSummarizer,
    private readonly onError: (err: unknown) => void,
  ) {}

  async summarize(input: { previous: string | null; lines: TranscriptLine[] }) {
    try {
      return await this.primary.summarize(input);
    } catch (err) {
      this.onError(err);
      return this.fallback.summarize(input);
    }
  }
}

/** How many of the oldest unsummarised lines to fold in, or 0 when the chat is not long yet. */
export function toFold(unsummarised: number): number {
  return unsummarised > FOLD_AT ? unsummarised - KEEP_LINES : 0;
}
