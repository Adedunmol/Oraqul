# LLM

How we call language models. What the agent may and may not do (the model never sets a number, the grounding check, the red team step, refusals) is in [agent.md](agent.md). Do not repeat those rules here.

## Stack

Vercel AI SDK (v7) with OpenAI, called from the API. Keys: `OPENAI_API_KEY`, `OPENAI_MODEL` in `.env`. With no `OPENAI_API_KEY` the API uses the scripted planner (below), so the demo and every test run with no key.

## Conventions

- Structured output uses Zod schemas from `packages/schema`. Parse model output at the boundary like any other untrusted input ([typescript.md](../typescript.md)).
- Structured output uses `generateText` with `Output.object`. `generateObject` is deprecated in v7.
- The model plans one step at a time through the `Planner` interface (`apps/api/src/agent/types.ts`). `OpenAiPlanner` builds its output schema from the pack: only the pack's allowed tools, and `ask` and `consult` only where the agent may use them. `ScriptedPlanner` is the deterministic stand-in with the same shape.
- Prompts live next to what they configure: category prompts in `packages/packs/src/<category>`. The router has no prompt yet: it is code ([agent.md](agent.md)).

## TODO

Prompt style and versioning, model choice per step (router, category agent, red team), token and cost logging into `runs.tokens`, retry and timeout policy, evals for prompt changes ([testing.md](../testing.md)).
