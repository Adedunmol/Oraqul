import { packs } from '@oraqul/packs';
import { categories, routerReadingSchema } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import type { Reader, ReaderInput } from './reader.js';

const CATEGORY_LINES = categories
  .map((c) => `- ${c} (${packs[c].title}): ${packs[c].covers}`)
  .join('\n');

/** Router prompt (spec §3.1, §9.2). The rules that matter are also enforced in decide.ts. */
export const ROUTER_SYSTEM = `You are the router of Oraqul, a launch strategy tool for media and entertainment. You read what a person wrote when starting a project and work out three things: the title of their work, its category, and what they want to do.

Categories:
${CATEGORY_LINES}

What they want to do (mode):
- build: plan a new launch or release that has not happened yet.
- audit: check or test a launch plan they already have, or find out why a launch that is out did badly.
- fix: improve a launch plan they already have, before or after launch. A fix checks the plan first, then writes a better one.

Rules:
- Never guess. Fill a field only when the person's own words say it, and put those exact words in "quote", copied character for character from their messages. If you are not sure, leave the field null.
- If their words fit more than one category (for example they sing and also make a game), leave category null and ask which one, with one option per category they mentioned.
- A concert, a gig or a live show can be a music release or tour, or a single live show with a date and tickets. Whenever the person says one of those words, leave category null and ask which, with the options "A music release or tour" and "A single live show".
- Set mode only when they say what they want to do with the work: release, launch or plan it (build), check a plan they have or ask why a launch did badly (audit), or ask for a plan to be fixed or improved (fix). Having, making or being good at something is not a mode.
- The title is the name of their work, exactly as they wrote it. "A song" or "my game" is not a title.
- A picked option is not the person's own words: never quote it. What it settled is already in "Known so far".
- A field in "Known so far" is already settled. Leave it null unless the person has since said something different.
- onTopic is false only when the message has nothing to do with launching or marketing a film, series, music, book, podcast, game or live show (for example health, relationships, cooking, homework). Short or vague messages about their work are on topic.
- When the category or the mode is still unknown, write one short question. Start by saying back in plain words what you understood, then ask. Give 2 to 4 options that are close readings of what they wrote, each a short action in their words, such as "Release this song", "Fix issues in this song's current release" or "Check my drafted release plan". Each option sets the category, the mode, or both, whichever are unknown; when only the mode is unknown, offer all three modes. Do not offer options for things already known.
- When the category and the mode are both known, question is null.
- Plain words, no jargon, no exclamation marks.`;

export class ModelReader implements Reader {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async read({ transcript, known }: ReaderInput) {
    const speaker = { person: 'Person', oraqul: 'Oraqul', pick: 'Person picked the option' };
    const conversation = transcript.map((line) => `${speaker[line.from]}: ${line.text}`).join('\n');
    const { output, usage } = await generateText({
      model: this.model,
      system: ROUTER_SYSTEM,
      prompt: `Known so far: ${JSON.stringify(known)}\n\nConversation:\n${conversation}`,
      output: Output.object({ schema: routerReadingSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(this.timeoutMs),
    });
    return { reading: output, tokens: usage.totalTokens ?? 0 };
  }
}
