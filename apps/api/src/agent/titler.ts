import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import type { Llm } from '../llm/llm.js';

export const THREAD_TITLER = Symbol('THREAD_TITLER');

/** A chat's name until its first message is read. */
export const UNNAMED_THREAD = 'New chat';

const SCRIPTED_CHARS = 48;
const MODEL_CHARS = 60;

/** The first message of a chat: its text and the names of any files sent with it. */
export interface FirstMessage {
  text: string;
  files: string[];
}

export interface Titler {
  title(message: FirstMessage): Promise<string>;
}

export const TITLER_SYSTEM = `You name chats in Oraqul, a launch strategy tool for media and entertainment. Read the first message of a chat and write a short title that sums up what it is about.

Rules:
- 3 to 6 words, sentence case, in the person's own terms.
- Keep the name of their work if they give one.
- No quotes, no emoji, no full stop at the end.
- Never add facts the message does not say.`;

/** The opening line or sentence, cut at a word so a list stays readable. */
export function scriptedTitle({ text, files }: FirstMessage): string {
  const line = text.trim().split(/\n|(?<=[.!?])\s/)[0] ?? '';
  const words = clean(line);
  if (words) return cap(sentenceCase(words), SCRIPTED_CHARS);
  return files[0] ? cap(files[0], SCRIPTED_CHARS) : UNNAMED_THREAD;
}

export class ScriptedTitler implements Titler {
  async title(message: FirstMessage): Promise<string> {
    return scriptedTitle(message);
  }
}

export class ModelTitler implements Titler {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async title(message: FirstMessage): Promise<string> {
    const files = message.files.map((name) => `[Attached file: ${name}]`);
    const { output } = await generateText({
      model: this.model,
      system: TITLER_SYSTEM,
      prompt: `First message:\n${[message.text, ...files].filter(Boolean).join('\n')}`,
      output: Output.object({ schema: z.object({ title: z.string() }) }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    const title = clean(output.title);
    // An empty title would leave the chat looking unnamed for good, so read it the scripted way.
    return title ? cap(title, MODEL_CHARS) : scriptedTitle(message);
  }
}

/** Tries the model first; on any failure names the chat the scripted way, so a run never waits on it. */
export class FallbackTitler implements Titler {
  constructor(
    private readonly primary: Titler,
    private readonly fallback: Titler,
    private readonly onFailure: (err: unknown) => void,
  ) {}

  async title(message: FirstMessage): Promise<string> {
    try {
      return await this.primary.title(message);
    } catch (err) {
      this.onFailure(err);
      return this.fallback.title(message);
    }
  }
}

/** The model titler when a model is configured, else the scripted one. */
export function createTitler(llm: Llm | null, onFailure: (err: unknown) => void): Titler {
  const scripted = new ScriptedTitler();
  if (!llm) return scripted;
  return new FallbackTitler(
    new ModelTitler(llm.model('router'), llm.timeoutMs),
    scripted,
    onFailure,
  );
}

function clean(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“‘]+|["'”’]+$/g, '')
    .replace(/[.,;:!?]+$/, '')
    .trim();
}

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function cap(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
