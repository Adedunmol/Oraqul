import { packs } from '@oraqul/packs';
import {
  type Answer,
  type Attachment,
  type AuditReport,
  attachmentSchema,
  type Brief,
  type Category,
  type Job,
  type LaunchPlan,
  type Move,
  type OverallConfidence,
  type Receipt,
  type RefreshReport,
  type StartMode,
  type StopReason,
  type ThreadEvent,
} from '@oraqul/schema';
import { z } from 'zod';
import type { TranscriptLine } from './router/reader.js';

// A file's text is kept whole, up to what an upload allows. Each reader cuts it to what its model
// should see: the router and a build read the start, an audit reads a whole plan (spec §3.1).
export const ATTACHMENT_CHARS = 8_000;
export const PLAN_CHARS = 40_000;

/** Something the person sent, with the text of each file as uploaded. */
export const saidSchema = z.object({ text: z.string(), files: z.array(attachmentSchema) });
export type Said = z.infer<typeof saidSchema>;

export function said(text: string, attachments: Attachment[]): Said {
  return { text, files: attachments };
}

/** The same message with each file's text cut to `chars`. */
export function cutFiles(message: Said, chars: number): Said {
  return {
    ...message,
    files: message.files.map((f) =>
      f.text === undefined ? f : { ...f, text: f.text.slice(0, chars) },
    ),
  };
}

/** What the router hands a category agent for one run (spec §3.1, agent.md Handoff). */
export interface Handoff {
  category: Category;
  mode: StartMode;
  title: string;
  /** The first message and its files, kept on the project as `inputs`. */
  inputs: Said;
  /** The message this run answers. Right after routing it is the first message again. */
  message: Said;
  /** The last lines of the chat, oldest first. Empty right after routing. */
  recent: TranscriptLine[];
  /** The plan this chat works on now (`threads.base_output_id`). Null before the first plan. */
  planId: string | null;
  /**
   * A standalone chat inside the project: it knows only the category and the project's name, with
   * no brief, plan or memory, so wild questions stay out of the project's own notes.
   */
  fresh?: boolean;
  /** What the project remembers, for a chat that uses it. Context, never evidence. */
  memory?: string[];
}

/** A plan output ready to save. Every number in it was computed by code. */
export interface NewOutput {
  kind: Job;
  title: string;
  brief: Brief;
  /** The launch plan, for outputs built on findings. Null for the older brief shape. */
  plan: LaunchPlan | null;
  /** The audit report, for an audit. Null for every other kind. */
  report: AuditReport | null;
  /** What a check on a saved plan found changed, for a `refresh`. Unset for every other kind. */
  refresh?: RefreshReport | null;
  headline: string;
  moves: Move[];
  confidence: OverallConfidence;
  /** What it was built from, so a follow up can rerun it. Opaque outside the agent that made it. */
  inputs: object | null;
  /**
   * The ids of the run's calls this output rests on, so a run that makes a report and then a plan
   * shows each its own evidence. Unset means every call the run made.
   */
  callIds?: string[];
}

/** What the person sent to a card the agent left open: a card answer, or text typed instead. */
export type Reply = Answer | { kind: 'typed'; text: string };

/** The reply does not fit the open card. The request is refused before any run starts. */
export class ReplyError extends Error {}

export interface AgentRun {
  reason: StopReason;
  /** Set when the run stopped `waiting`, and handed back with the reply to resume it. */
  state: object | null;
  /** Every receipt the run made. Line receipts carry their `lineId`. */
  receipts: Receipt[];
  /** The run's last output, the one the chat works on next. */
  output: NewOutput | null;
  /** Outputs made before `output` in the same run, oldest first: the audit a fix is written from. */
  earlier?: NewOutput[];
  tokens: number;
  qlooCalls: number;
}

/** One agent per category (spec §3.2). Each emits its own events and says why it stopped. */
export interface CategoryAgent {
  run(
    handoff: Handoff,
    emit: (event: ThreadEvent) => void,
    resume?: { state: unknown; reply: Reply },
  ): Promise<AgentRun>;
  /**
   * Checks a reply against the card the run left open in `state`, before the run resumes.
   * Returns the words the folded card shows, or throws `ReplyError`.
   */
  replyLabel(state: unknown, reply: Reply): string;
}

const WORK: Record<StartMode, string> = {
  build: 'plan',
  audit: 'report on your plan',
  fix: 'fixed plan',
};

/**
 * Stands in for the categories whose agent is not built yet. It makes no Qloo calls and no
 * claims, so it says plainly that nothing was tested.
 */
export class PlaceholderAgent implements CategoryAgent {
  async run(handoff: Handoff, emit: (event: ThreadEvent) => void): Promise<AgentRun> {
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
    return { reason: 'finished', state: null, receipts: [], output: null, tokens: 0, qlooCalls: 0 };
  }

  replyLabel(): string {
    throw new ReplyError('No question is waiting');
  }
}

export const CATEGORY_AGENTS = Symbol('CATEGORY_AGENTS');

export type CategoryAgents = Record<Category, CategoryAgent>;

export function placeholderAgents(): CategoryAgents {
  const agent = new PlaceholderAgent();
  return { film: agent, music: agent, books: agent, podcasts: agent, games: agent, shows: agent };
}
