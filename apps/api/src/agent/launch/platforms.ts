import { cityCountry } from '@oraqul/engine';
import { platformsNamed, suggestPlatforms } from '@oraqul/packs';
import type { Category, Question } from '@oraqul/schema';
import type { LaunchRead } from './read-core.js';

export { platformsNamed };

// Lines that only say where a thing is published ("Where it is published: Spotify, Apple, YouTube")
// are not the campaign's platforms, whatever they name.
const PUBLISH_LINE = /^[ \t>*-]*where it is published\b.*$/gim;

/** The platforms the Guide's "Channels we already use:" line names. */
export function channelsFrom(text: string): string[] {
  const line = text.match(/\bchannels we already use\s*:\s*([^\n]+)/i)?.[1];
  return line ? platformsNamed(line) : [];
}

/**
 * The platforms a brief picks for the campaign: the "Channels we already use:" line when there is
 * one, else any platform it names outside a "where it is published" line. Empty when it names
 * none, and then the platform card is asked.
 */
export function platformsChosen(text: string): string[] {
  const own = channelsFrom(text);
  return own.length ? own : platformsNamed(text.replace(PUBLISH_LINE, ''));
}

/** The id of the question that asks which platforms to plan the campaign on. */
export const platformQuestionId = (category: string) => `${category}.platforms`;

/** Asked after the budget band and before any research, once, when the brief names no platform. */
export function platformQuestion(category: Category, country: string | null): Question {
  return {
    id: platformQuestionId(category),
    card: 'multi',
    prompt: country
      ? `Which platforms should the campaign run on in ${country}? I will plan only the ones you pick.`
      : 'Which platforms should the campaign run on? I will plan only the ones you pick.',
    options: suggestPlatforms(category, country).map((p) => ({
      id: p.name,
      label: p.name,
      description: p.use,
    })),
    hint: 'Or type the platforms you want, or press “You choose”.',
  };
}

/** The market a platform card is about: the release's country, else the first city's. */
export function marketOf(read: Pick<LaunchRead, 'country' | 'places'>): string | null {
  if (read.country) return read.country;
  const city = read.places[0];
  return city ? cityCountry(city) : null;
}

/** The platforms a card answer or a typed reply gives. Nothing named means the first three offered. */
export function platformsFromAnswer(
  optionIds: readonly string[] | null,
  typed: string | null,
  asked: Question | null,
): string[] {
  const offered = asked?.options.map((o) => o.id) ?? [];
  const picked = offered.filter((id) => optionIds?.includes(id));
  if (picked.length) return picked;
  const named = typed
    ? platformsNamed(typed).filter((n) => offered.includes(n) || !offered.length)
    : [];
  return named.length ? named : offered.filter((n) => n !== 'WhatsApp').slice(0, 3);
}

/** Said to the writer, so a plan that mentions a platform mentions one the team chose. */
export function platformLine(platforms: string[]): string {
  return `Platforms the team chose: ${platforms.join(', ')}. Plan the campaign on these only, and do not propose posting on any other platform.`;
}
