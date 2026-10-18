import { packs } from '@oraqul/packs';
import type { Category, RouterReading, StartMode } from '@oraqul/schema';
import { personText, type Reader, type ReaderInput } from './reader.js';

// The router without a model: used when no key is set, in tests, and when the model call fails.
// It takes only what is plainly written and asks about everything else. It cannot tell an
// off-topic message from an unclear one, so it asks for the category instead of refusing.

const CATEGORY_WORDS: [Category, RegExp][] = [
  ['film', /\b(films?|movies?|series|documentar(?:y|ies)|tv shows?|miniseries|feature)\b/i],
  ['music', /\b(songs?|singles?|albums?|eps?|mixtapes?|tours?|tracks?|concerts?)\b/i],
  ['books', /\b(books?|novels?|memoirs?|audiobooks?|poetry|publish(?:ing|er)?)\b/i],
  ['podcasts', /\bpodcasts?\b/i],
  ['games', /\b(games?|gaming|dlc)\b/i],
];

// Checked in this order: "fix the release" is a fix even though it says release.
const MODE_WORDS: [StartMode, RegExp][] = [
  ['fix', /\b(fix|rescue|relaunch|rebuild|redo)\b/i],
  // A launch that missed is first a question of why, so without a word asking for a fix it is an audit.
  [
    'audit',
    /\b(check|audit|review|test)\b[^.?!\n]{0,20}\bplan\b|\bwhy (?:did|has|have|was|were)\b[^.?!\n]{0,60}\b(?:fail\w*|flop\w*|underperform\w*|miss\w*|sell|sold)\b|\b(?:underperform\w*|flopp?(?:ed)?|missed|sold (?:under|badly|poorly))\b/i,
  ],
  [
    'build',
    /\b(plan (?:the|a|my|our) (?:launch|release)|launch(?:ing)?|releas(?:e|ing)|premier(?:e|ing))\b/i,
  ],
];

const QUOTED_TITLE = /["“]([^"”\n]{1,80})["”]/;
const NAMED_TITLE = /\b(?:titled|called|named)\s+([^,.!?\n"“”]{1,60})/i;

export class ScriptedReader implements Reader {
  async read({ transcript }: ReaderInput): Promise<{ reading: RouterReading; tokens: number }> {
    const said = personText(transcript);
    const found = CATEGORY_WORDS.flatMap(([category, re]) => {
      const match = said.match(re);
      return match ? [{ category, quote: match[0] }] : [];
    });
    const single = found.length === 1 ? found[0] : undefined;
    const modeMatch = MODE_WORDS.map(([mode, re]) => ({ mode, match: said.match(re) })).find(
      (m) => m.match,
    );
    const titleMatch = said.match(QUOTED_TITLE) ?? said.match(NAMED_TITLE);
    const title = titleMatch?.[1]?.trim();

    const reading: RouterReading = {
      onTopic: true,
      title: title && titleMatch ? { value: title, quote: titleMatch[0] } : null,
      category: single ? { value: single.category, quote: single.quote } : null,
      mode: modeMatch?.match ? { value: modeMatch.mode, quote: modeMatch.match[0] } : null,
      question:
        found.length > 1
          ? {
              prompt: 'Which of these is it?',
              options: found.slice(0, 4).map(({ category }) => ({
                label: packs[category].title,
                description: packs[category].blurb,
                category,
                mode: null,
              })),
            }
          : null,
    };
    return { reading, tokens: 0 };
  }
}
