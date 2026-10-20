# LLM

How we call language models. What the agent may and may not do (the model never sets a number, the grounding check, refusals) is in [agent.md](agent.md). Do not repeat those rules here.

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
| `LLM_WEB_SEARCH` | `on` (default) or `off`. Plans look up release timing, rival releases, who distributes and shows films like this, and market numbers through the writer's own provider search (OpenAI web search, Google Search grounding). Not available on OpenAI-compatible endpoints. The film's title and story are never sent, only its genre, country, format and cities |
| `LLM_WRITER_MODEL`, `LLM_WRITER_PROVIDER`, `LLM_WRITER_API_KEY`, `LLM_WRITER_BASE_URL`, `LLM_WRITER_TIMEOUT_MS` (default 180000), `LLM_WRITER_REASONING` (OpenAI only: `minimal`, `low` (default), `medium` or `high`; a plan took 7 minutes and 130K tokens on `gpt-6.1-sol` before it was set) | Optional. The step that writes plans and answers runs on its own model, even from another provider (for example the reader and query planner on Gemini, the writer on OpenAI). Empty values fall back to the settings above. A base url is not shared with a different provider |

`LlmModule` provides `LLM`: `model(role)` for `router`, `agent` or `writer`, or null with no key. A new provider is one case in `providerFor`.

**Models.** The reader, query planner and gate are short structured jobs and stay cheap (Gemini `gemini-3.5-flash-lite`, answering the router in about a second). The writer decides how good a plan is, so it can run on a stronger model from another provider:

| Writer | Time per plan | Rough cost | Use |
|---|---|---|---|
| `gpt-5.4-mini` (**default**) | about 2 minutes | about $0.04 | Strong audience work from the findings and enough launch knowledge |
| `gpt-6-astra` | about 5 minutes | about $2 | A little more specific |
| `gpt-6.1-sol` | about 7 minutes | about $0.50 | Deeper research, for plans that go to financiers |

Costs are rough and assume about 80% input tokens; check the provider's usage page. OpenAI's GPT-6 models are reasoning models: they ignore `temperature`, and `LLM_WRITER_REASONING` sets how hard they think (unset, a plan took 7 minutes and 130K tokens on Sol). Web research runs on the writer's model. It searches the industry by name ("Nollywood", not only "Nigeria"), runs one search per question and per diaspora city, and keeps only facts about that industry and those markets, so results vary a little between runs and a thin diaspora city can return nothing. Set the writer's key and model in `.env` ([.env.example](../../.env.example) has the block). A writer on another provider needs its own key, and the main key is never sent to it.

## Conventions

- Structured output uses Zod schemas from `packages/schema`. Parse model output at the boundary like any other untrusted input ([typescript.md](../typescript.md)).
- Structured output uses `generateText` with `Output.object`. `generateObject` is deprecated in v7. Keep output schemas flat objects with nullable fields: not every provider accepts a union at the top level.
- The router (`apps/api/src/agent/router/`) reads with `ModelReader`; its prompt is `ROUTER_SYSTEM` in `model-reader.ts`. What it returns is checked in code (`decide.ts`): a value counts only when its quote is in the person's words. `FallbackReader` reads with the scripted router if the model call fails, so a quota error never stops a project.
- Chats are named from their first message by `ModelTitler` (`apps/api/src/agent/titler.ts`, prompt `TITLER_SYSTEM`) on the router model. `FallbackTitler` uses the scripted title, the message's opening line, if the call fails.
- The model plans one step at a time through the `Planner` interface (`apps/api/src/agent/types.ts`). `ModelPlanner` builds its output schema from the pack: only the pack's allowed tools, and `ask` and `consult` only where the agent may use them. `ScriptedPlanner` is the deterministic stand-in with the same shape. Film, Music, Games and Podcasts do not use it for plans: they run the fixed launch pipeline, and the planner only serves an answer about a plan saved before findings. The Books agent is a placeholder.
- Prompts live next to what they configure: category prompts in `packages/packs/src/<category>`, the router's in `model-reader.ts`.
- Calls run at temperature 0 with one retry. The router's token use is saved in `runs.tokens`.
