# LLM

How we call language models. What the agent may and may not do (the model never sets a number, the grounding check, the red team step, refusals) is in [agent.md](agent.md). Do not repeat those rules here.

## Stack

Vercel AI SDK (v7), called from the API. The provider and model are configuration, so changing either never touches code (`apps/api/src/llm/llm.ts`):

| Key | What it does |
|---|---|
| `LLM_PROVIDER` | `openai`, `google`, or `openai-compatible` (OpenRouter, Groq, Ollama and the like) |
| `LLM_API_KEY` | The provider's key. Empty runs the scripted router and planner, so the demo and every test run with no key |
| `LLM_MODEL` | The model for every role |
| `LLM_ROUTER_MODEL` | Optional: a faster model for the router |
| `LLM_BASE_URL` | Needed for `openai-compatible`; optional otherwise |
| `LLM_TIMEOUT_MS` | Per call, default 30000 |

`LlmModule` provides `LLM`: `model(role)` for `router` or `agent`, or null with no key. A new provider is one case in `providerFor`.

Today: Google Gemini, `gemini-3.5-flash-lite`. It answers the router in about a second on the free tier. `gemini-3.8-flash` read messages the same way but took 10 to 130 seconds per call there, and `gemini-2.5-flash` is no longer served to new keys (checked 2026-10-15).

## Conventions

- Structured output uses Zod schemas from `packages/schema`. Parse model output at the boundary like any other untrusted input ([typescript.md](../typescript.md)).
- Structured output uses `generateText` with `Output.object`. `generateObject` is deprecated in v7. Keep output schemas flat objects with nullable fields: not every provider accepts a union at the top level.
- The router (`apps/api/src/agent/router/`) reads with `ModelReader`; its prompt is `ROUTER_SYSTEM` in `model-reader.ts`. What it returns is checked in code (`decide.ts`): a value counts only when its quote is in the person's words. `FallbackReader` reads with the scripted router if the model call fails, so a quota error never stops a project.
- Chats are named from their first message by `ModelTitler` (`apps/api/src/agent/titler.ts`, prompt `TITLER_SYSTEM`) on the router model. `FallbackTitler` uses the scripted title, the message's opening line, if the call fails. Chats from before this have their names backfilled once with `pnpm --filter @oraqul/api db:backfill-thread-names` (`--dry-run` first lists the changes); it renames only chats still called "New chat", "First plan", "First check" or "First fix".
- The model plans one step at a time through the `Planner` interface (`apps/api/src/agent/types.ts`). `ModelPlanner` builds its output schema from the pack: only the pack's allowed tools, and `ask` and `consult` only where the agent may use them. `ScriptedPlanner` is the deterministic stand-in with the same shape. The category agents are placeholders for now and do not plan yet.
- Prompts live next to what they configure: category prompts in `packages/packs/src/<category>`, the router's in `model-reader.ts`.
- Calls run at temperature 0 with one retry. The router's token use is saved in `runs.tokens`.

## TODO

Prompt versioning, token and cost logging for the category agents, evals for prompt changes ([testing.md](../testing.md)).
