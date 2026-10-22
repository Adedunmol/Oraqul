import type { ToolData } from '@oraqul/engine';
import type { CategoryPack } from '@oraqul/packs';
import type {
  AgentReply,
  Answer,
  Category,
  Claim,
  Job,
  ProjectInput,
  Question,
  Receipt,
  ToolName,
} from '@oraqul/schema';

/** What the planner chooses next. The runtime, not the planner, runs it. */
export type Step =
  | { kind: 'tool'; name: ToolName; input: Record<string, unknown> }
  | { kind: 'ask'; question: Question }
  | { kind: 'consult'; category: Category; question: string }
  | { kind: 'finish'; reply: AgentReply };

/** Everything a planner may look at. Receipt ids are the call ids of the tool calls. */
export type HistoryItem =
  | {
      kind: 'tool';
      name: ToolName;
      input: Record<string, unknown>;
      data: ToolData;
      /** One per Qloo call the tool made. `data` names the one behind each item. */
      receiptIds: string[];
    }
  | {
      kind: 'failed';
      name: ToolName;
      input: Record<string, unknown>;
      reason: string;
      /** Missing when the call never went out (not allowed, bad input). */
      receiptId?: string;
    }
  | { kind: 'answer'; question: Question; answer: Answer }
  | { kind: 'consult'; category: Category; question: string; message: string; claims: Claim[] }
  | { kind: 'rejected'; reason: string };

export interface AgentContext {
  /** `film`, or `books→film` inside a consult. */
  agent: string;
  pack: CategoryPack;
  project: ProjectInput;
  job: Job;
  /** Another agent's bounded question, or the person's question when the run answers about a plan. */
  consultQuestion: string | undefined;
  /** Whether the agent may ask the user or consult another agent. False inside a consult. */
  canAsk: boolean;
  history: HistoryItem[];
  receipts: Receipt[];
  /** Receipts of the plan this run answers about. A claim may cite them by id. */
  prior: Receipt[];
  /** The plan and the chat as text. Context, never evidence. */
  context: string | null;
}

/** Starts the context of a standalone chat, so the planner talks instead of running a workflow. */
export const STANDALONE_CONTEXT = 'STANDALONE CHAT.';

export interface Planner {
  next(context: AgentContext): Promise<Step>;
}
