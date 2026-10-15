import { packs } from '@oraqul/packs';
import type { Category, StartMode, StopReason, ThreadEvent } from '@oraqul/schema';

/** What the router hands a category agent once it knows the project (spec §3.1). */
export interface Handoff {
  category: Category;
  mode: StartMode;
  title: string;
}

/** One agent per category (spec §3.2). Each emits its own events and says why it stopped. */
export interface CategoryAgent {
  run(handoff: Handoff, emit: (event: ThreadEvent) => void): Promise<StopReason>;
}

const WORK: Record<StartMode, string> = {
  build: 'plan',
  audit: 'check of your plan',
  rescue: 'relaunch plan',
};

/**
 * Stands in until each category's real agent is built on the tool loop in runtime.ts. It makes
 * no Qloo calls and no claims, so it says plainly that nothing was tested.
 */
export class PlaceholderAgent implements CategoryAgent {
  async run(handoff: Handoff, emit: (event: ThreadEvent) => void): Promise<StopReason> {
    const pack = packs[handoff.category];
    emit({
      type: 'trace.step',
      agent: handoff.category,
      step: 1,
      of: 1,
      text: `The ${pack.title} agent is a placeholder for now`,
    });
    emit({
      type: 'message',
      body: `The ${pack.title} agent isn't connected yet, so there is no ${WORK[handoff.mode]} for “${handoff.title}” to show. Nothing was tested against Qloo.`,
      claims: [],
    });
    return 'finished';
  }
}

export const CATEGORY_AGENTS = Symbol('CATEGORY_AGENTS');

export type CategoryAgents = Record<Category, CategoryAgent>;

export function placeholderAgents(): CategoryAgents {
  const agent = new PlaceholderAgent();
  return { film: agent, music: agent, books: agent, podcasts: agent, games: agent };
}
