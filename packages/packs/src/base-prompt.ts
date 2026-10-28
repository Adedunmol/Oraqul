import type { CategoryPack } from './types';

/** The rules every category agent follows. A pack's own prompt adds only what is its own. */
export const BASE_PROMPT = `You are one of Oraqul's category agents. Oraqul plans launches in media and entertainment from Qloo taste data, and every claim carries a receipt.

Rules:
- Every claim cites a receipt from a tool call in this run, or from the plan this run builds on.
- Never set a number, a score, a verdict or a confidence level. Tools compute them; you explain them.
- If a tool could not test something, never fill it in from what you know. Give the closest thing a finding does show, call it close, and say what would sharpen it. A stand-in is never presented as the real thing.
- What you are told about the team, the project or earlier chats is context, not evidence. Never cite it as a receipt.
- Refuse forecasts, pricing advice, financial advice and arranging or brokering financing. Never quote a sponsorship fee, a price or the terms of a loan, and never say a team qualifies for funding: say which published criteria appear met and which are unknown.
- Never send anything. You may draft, and prepare it for a person to open in their own WhatsApp or email and send themselves.
- Plain words, no jargon, no exclamation marks.`;

export function agentSystemPrompt(pack: CategoryPack): string {
  return `${BASE_PROMPT}\n\n${pack.systemPrompt}`;
}

/**
 * Requests every agent refuses in code, before any model or Qloo call, with fixed words (spec
 * §10). The model is told the same in the base prompt; this holds when there is no model.
 */
export const REFUSALS: {
  kind: 'forecast' | 'pricing' | 'finance' | 'send' | 'asset';
  pattern: RegExp;
  reply: string;
}[] = [
  {
    kind: 'forecast',
    pattern:
      /\b(forecast|predict(ion)?s?|projections?|how much (will|would|could) (it|we|this)|how many (downloads|tickets|streams|copies|sales|views|units|listeners|wishlists|followers|people|plays|pre-?orders|saves)\b[^.?!\n]{0,30}\b(will|would|could)\b|box office (will|would)|(will|would) (it|this) (make|earn|gross|sell)|gross(es)? on (the )?opening|first weekend numbers)\b/i,
    reply:
      "I can't forecast sales, box office or viewing numbers. Qloo has taste data, not sales, and a forecast could not carry a receipt. I can test who the plan reaches and where. If you have your own tracking numbers, add them and I will compare the plan with them.",
  },
  {
    kind: 'pricing',
    pattern:
      /\b(what (price|should (we|i) charge)|how much should (we|i) charge|ticket price|pricing (advice|strategy)|set the price)\b/i,
    reply:
      "I can't advise on pricing. Qloo's taste data says nothing reliable about what people will pay, so any number would be a guess. I can test which audiences and partners fit the plan.",
  },
  {
    kind: 'send',
    pattern: /\b(send|email|post|dm|message) (it|this|the (brief|draft|email|pitch)|them)\b/i,
    reply:
      'I never send anything. I can prepare it and open it in your own WhatsApp or email for you to send.',
  },
  {
    kind: 'finance',
    pattern:
      /\b(?:financial advice|(?:arrange|broker|secure|get|negotiate|apply for|take out) (?:a |the |us |me )?(?:loan|financing|finance|funding|investment|investors?)\b|should (?:we|i) (?:borrow|take (?:a |the )?loan|raise (?:money|funds|capital)|invest)|will (?:we|i|it) (?:qualify|be approved|get (?:the )?(?:grant|loan|funding))|do (?:we|i) qualify)/i,
    reply:
      "I can't give financial advice or arrange or broker financing, and I can't say a team qualifies for any of it. I can find funds, grants and sponsorship programmes that are published right now, each with its source and the day it was read, and show which of their published criteria appear met and which are unknown. Confirm everything on the source page before applying.",
  },
  {
    kind: 'asset',
    // A verb that makes the thing, then the thing within a few words. "Write the trailer script"
    // and "a trailer shot list" are guides, which Oraqul does write.
    pattern:
      /\b(?:generate|make|create|design|produce|render|edit|animate|draw|shoot)\s+(?:me\s+|us\s+)?(?:(?:an?|the|our|my|some|new|short|full|\d+[- ]?(?:second|sec|s))\s+){0,3}(?:ads?|adverts?|trailers?|teasers?|posters?|images?|videos?|clips?|key art|artwork|logos?|banners?|thumbnails?)\b(?!\s+(?:scripts?|briefs?|shot|storyboards?|captions?|treatments?|guides?|copy|hooks?|ideas?|concepts?))/i,
    reply:
      "I don't make ads, trailers, images or video. I write what a team needs to make them: scripts, shot lists, key art briefs, caption packs and hook options, and a person makes the final creative. Ask for the creative kit for a territory and channel, for example “make the creative kit for Lagos on Instagram”.",
  },
];

/** The fixed refusal for a request no agent may fulfil, or null. */
export function refusalFor(text: string): string | null {
  return REFUSALS.find((r) => r.pattern.test(text))?.reply ?? null;
}
