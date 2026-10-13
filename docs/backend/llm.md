# LLM

How we call language models. What the agent may and may not do (the model never sets a number, the grounding check, the red team step, refusals) is in [agent.md](agent.md). Do not repeat those rules here.

## Stack

Vercel AI SDK with OpenAI, called from the API. Keys: `OPENAI_API_KEY`, `OPENAI_MODEL` in `.env`. Not installed yet.

## Conventions

- Structured output uses Zod schemas from `packages/schema`. Parse model output at the boundary like any other untrusted input ([typescript.md](../typescript.md)).
- Prompts live next to what they configure: category prompts in `packages/packs/src/<category>`, the router prompt in `apps/api/src/agent`.

## TODO

Prompt style and versioning, model choice per step (router, category agent, red team), token and cost logging into `runs.tokens`, retry and timeout policy, evals for prompt changes ([testing.md](../testing.md)).
