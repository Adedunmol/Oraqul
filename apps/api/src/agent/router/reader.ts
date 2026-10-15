import type { RouterReading } from '@oraqul/schema';
import type { Known } from './decide.js';

/**
 * One line of the conversation so far, as the router sees it. A `pick` is an option the person
 * chose on a card: the model wrote its words, so they never count as a quote.
 */
export interface TranscriptLine {
  from: 'person' | 'oraqul' | 'pick';
  text: string;
}

export interface ReaderInput {
  transcript: TranscriptLine[];
  known: Known;
}

/** Reads the conversation into title, category, mode and, if needed, one question. */
export interface Reader {
  read(input: ReaderInput): Promise<{ reading: RouterReading; tokens: number }>;
}

/** Everything the person said, which is all a quote may come from. */
export function personText(transcript: TranscriptLine[]): string {
  return transcript
    .filter((line) => line.from === 'person')
    .map((line) => line.text)
    .join('\n');
}
