import { tools } from '@oraqul/engine';
import { agentReplySchema, questionSchema } from '@oraqul/schema';
import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import type { AgentContext, Planner, Step } from './types.js';

const RULES = `Choose exactly one next step.
- Never state a number, score or verdict that a tool did not return.
- Every claim in a finish step must cite receipt ids from the history, and every sentence you write must be backed by them.
- If a tool failed, say that line could not be tested. Do not fill it in from memory.
- Refuse forecasts, pricing advice and sending anything. You may draft.`;

/** Model-backed planner. The prompt names the pack's tools only, and the schema allows only them. */
export class ModelPlanner implements Planner {
  constructor(private readonly model: LanguageModel) {}

  async next(context: AgentContext): Promise<Step> {
    const { output } = await generateText({
      model: this.model,
      system: `${context.pack.systemPrompt}\n\n${RULES}`,
      prompt: JSON.stringify({
        project: context.project,
        job: context.job,
        question: context.consultQuestion,
        assumptionsToTest: context.pack.assumptionChecklist,
        history: context.history,
      }),
      output: Output.object({ schema: z.object({ step: stepSchema(context) }) }),
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
