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
      receiptId: string;
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
  /** Set when this run is another agent's bounded question. */
  consultQuestion: string | undefined;
  /** Whether the agent may ask the user or consult another agent. False inside a consult. */
  canAsk: boolean;
  history: HistoryItem[];
  receipts: Receipt[];
}

export interface Planner {
  next(context: AgentContext): Promise<Step>;
}
