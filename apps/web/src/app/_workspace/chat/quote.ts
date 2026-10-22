/** The longest passage a reply quotes, so a whole plan cannot ride along with one question. */
const QUOTE_MAX = 500;

/** A selection as a quote: one line of text, cut at a word when it is long. */
export function toQuote(selected: string): string {
  const flat = selected.replace(/\s+/g, ' ').trim();
  if (flat.length <= QUOTE_MAX) return flat;
  return `${flat.slice(0, QUOTE_MAX).replace(/\s+\S*$/, '')}…`;
}

/** The message as sent: the quoted passage as a `> ` line, a blank line, then the question. */
export function withQuote(quote: string | null, text: string): string {
  return quote ? `> ${quote}\n\n${text}` : text;
}

/** Splits a stored user message back into the passage it quoted and what was asked. */
export function splitQuote(text: string): { quote: string | null; body: string } {
  const match = /^> ([^\n]+)\n\n([\s\S]*)$/.exec(text);
  return match ? { quote: match[1] ?? null, body: match[2] ?? '' } : { quote: null, body: text };
}
