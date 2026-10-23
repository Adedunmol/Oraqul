import type { StartMode } from '@oraqul/schema';

// Words the router says itself. They are product copy (spec §9.2), kept in code so the model can
// never change what a refusal or a fixed question says.

export const OFF_TOPIC_REPLY =
  "Oraqul works on launches for films, series, music, books, podcasts, games and live shows, so I can't help with that here. Tell me about a launch you're working on.";

export const CATEGORY_PROMPT = 'Which category is this in?';
export const MODE_PROMPT = 'What would you like to do?';
export const TITLE_PROMPT = 'What is it called?';
export const TITLE_HINT = 'A working title is fine. Type it in the message box below.';
export const OPTIONS_HINT = 'None of these? Type what you mean in the message box below.';

export const MODE_OPTIONS: Record<StartMode, { label: string; description: string }> = {
  build: { label: 'Make a plan', description: 'A new launch, planned from what you tell me.' },
  audit: {
    label: 'Check my plan',
    description: 'Test the assumptions in a plan you have, or find out why a launch fell short.',
  },
  fix: {
    label: 'Fix my plan',
    description: 'Before or after launch. I check it, then write a better one.',
  },
};

const READINGS: Record<StartMode, string> = {
  build: 'a new launch plan',
  audit: 'a check of your plan',
  fix: 'a fix for your plan',
};

export function readingLine(mode: StartMode, title: string, categoryTitle: string): string {
  return `Reading this as ${READINGS[mode]} for “${title}” (${categoryTitle}).`;
}
