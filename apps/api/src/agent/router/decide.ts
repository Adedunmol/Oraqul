import { packs } from '@oraqul/packs';
import type { Category, Question, RouterOption, RouterReading, StartMode } from '@oraqul/schema';
import { categories, startModes } from '@oraqul/schema';
import {
  CATEGORY_PROMPT,
  MODE_OPTIONS,
  MODE_PROMPT,
  OPTIONS_HINT,
  TITLE_HINT,
  TITLE_PROMPT,
} from './copy.js';

/** What the router knows so far. A field is set only from the person's own words or picks. */
export interface Known {
  title: string | null;
  category: Category | null;
  mode: StartMode | null;
}

/** What one option of an open question settles when picked. */
export interface Settles {
  label: string;
  category: Category | null;
  mode: StartMode | null;
}

export interface PendingQuestion {
  question: Question;
  settles: Record<string, Settles>;
}

export type RouterDecision =
  | { kind: 'off_topic' }
  | { kind: 'ask'; pending: PendingQuestion }
  | { kind: 'routed'; title: string; category: Category; mode: StartMode };

const MIN_OPTIONS = 2;

/** Lower case, one space, straight quotes: so a quote matches however the model spaced it. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”«»„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function quoted(quote: string, said: string): boolean {
  const q = normalise(quote);
  return q !== '' && normalise(said).includes(q);
}

/**
 * Keeps only what the person said: a value whose quote is not in their words is dropped, so the
 * router asks instead of guessing. A later quoted value replaces an earlier one.
 */
export function applyReading(known: Known, reading: RouterReading, said: string): Known {
  const next = { ...known };
  const { title, category, mode } = reading;
  if (title && quoted(title.quote, said) && quoted(title.value, said)) {
    next.title = title.value.trim();
  }
  if (category && quoted(category.quote, said)) next.category = category.value;
  if (mode && quoted(mode.quote, said)) next.mode = mode.value;
  return next;
}

/**
 * The router's next move from what it knows. The category and the mode come before the title,
 * because the options for them can carry both, and one question is asked at a time.
 */
export function decide(
  known: Known,
  reading: RouterReading | null,
  questionId: string,
): RouterDecision {
  if (reading && !reading.onTopic) return { kind: 'off_topic' };
  const { title, category, mode } = known;
  if (category === null || mode === null) {
    return { kind: 'ask', pending: choiceQuestion(known, reading, questionId) };
  }
  if (title === null) {
    return {
      kind: 'ask',
      pending: {
        question: {
          id: questionId,
          card: 'text',
          prompt: TITLE_PROMPT,
          options: [],
          hint: TITLE_HINT,
        },
        settles: {},
      },
    };
  }
  return { kind: 'routed', title, category, mode };
}

// Uses the model's own wording when its options settle what is missing, else fixed options.
function choiceQuestion(known: Known, reading: RouterReading | null, id: string): PendingQuestion {
  const useful = (reading?.question?.options ?? []).filter((o) => settlesMissing(known, o));
  if (reading?.question && useful.length >= MIN_OPTIONS) {
    return build(id, reading.question.prompt, useful);
  }
  if (known.category === null) {
    return build(
      id,
      CATEGORY_PROMPT,
      categories.map((c) => ({
        label: packs[c].title,
        description: packs[c].blurb,
        category: c,
        mode: null,
      })),
    );
  }
  return build(
    id,
    MODE_PROMPT,
    startModes.map((m) => ({ ...MODE_OPTIONS[m], category: null, mode: m })),
  );
}

function settlesMissing(known: Known, option: RouterOption): boolean {
  return (
    (known.category === null && option.category !== null) ||
    (known.mode === null && option.mode !== null)
  );
}

function build(id: string, prompt: string, options: RouterOption[]): PendingQuestion {
  const settles: Record<string, Settles> = {};
  const cardOptions = options.map((o, i) => {
    const optionId = `o${i + 1}`;
    settles[optionId] = { label: o.label, category: o.category, mode: o.mode };
    return { id: optionId, label: o.label, description: o.description };
  });
  return {
    question: { id, card: 'single', prompt, options: cardOptions, hint: OPTIONS_HINT },
    settles,
  };
}
