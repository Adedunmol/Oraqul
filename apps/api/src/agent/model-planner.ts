import { tools } from '@oraqul/engine';
import { agentSystemPrompt } from '@oraqul/packs';
import { agentReplySchema, questionSchema } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import { type AgentContext, type Planner, STANDALONE_CONTEXT, type Step } from './types.js';

// The shared rules are in the base prompt; these are only about choosing a step.
const RULES = `Choose exactly one next step.
- Every claim in a finish step cites receipt ids from the history, and every sentence you write is backed by them.`;

// A standalone chat is a conversation, not a workflow: the pack's habit of finding the launch's
// lead title first does not apply, because there is no launch in it.
const FREE_RULES = `This is a free conversation. Answer the person's question directly. Do not look up the project's name or any title the person did not mention. Call a Qloo tool only when it grounds what you say about what an audience likes or where it is, using names the person wrote, and cite those receipts. When the question needs no Qloo data, finish with a plain answer from launch knowledge and no claims. Never mention lookups, databases or tools.`;

/** Model-backed planner. The prompt names the pack's tools only, and the schema allows only them. */
export class ModelPlanner implements Planner {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs: number,
  ) {}

  async next(context: AgentContext): Promise<Step> {
    const { output } = await generateText({
      model: this.model,
      // Without it a stalled call keeps the thread busy until the API restarts.
      abortSignal: AbortSignal.timeout(this.timeoutMs),
      system: `${agentSystemPrompt(context.pack)}\n\n${RULES}${context.context?.startsWith(STANDALONE_CONTEXT) ? `\n\n${FREE_RULES}` : ''}`,
      prompt: JSON.stringify({
        contextNotEvidence: context.context,
        project: context.project,
        job: context.job,
        question: context.consultQuestion,
        assumptionsToTest: context.pack.assumptionChecklist,
        history: context.history,
      }),
      output: Output.object({ schema: z.object({ step: stepSchema(context) }) }),
      // Which tool runs next is a decision, so it is the same for the same history.
      temperature: 0,
    });
    return output.step;
  }
}

function stepSchema(context: AgentContext) {
  const finish = z.object({ kind: z.literal('finish'), reply: agentReplySchema });
  const toolSteps = context.pack.toolAllowlist.map((name) =>
    z.object({ kind: z.literal('tool'), name: z.literal(name), input: tools[name].input }),
  );
  const ask = z.object({ kind: z.literal('ask'), question: questionSchema });
  const consults = context.pack.consults;
  const consult = z.object({
    kind: z.literal('consult'),
    category: z.enum(consults),
    question: z.string(),
  });

  const [firstTool, ...otherTools] = toolSteps;
  if (!firstTool) throw new Error(`The ${context.pack.category} pack allows no tools`);
  const options = [
    finish,
    firstTool,
    ...otherTools,
    ...(context.canAsk ? [ask] : []),
    ...(context.canAsk && consults.length > 0 ? [consult] : []),
  ];
  return z.union(
    options as [(typeof options)[number], (typeof options)[number], ...(typeof options)[number][]],
  );
}
