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
| `LLM_WEB_SEARCH` | `on` (default) or `off`. Plans look up release timing, rival releases, who distributes and shows films like this, and market numbers through the writer's own provider search (OpenAI web search, Google Search grounding). Not available on OpenAI-compatible endpoints. The film's title and story are never sent, only its genre, country, format and cities |
| `LLM_WRITER_MODEL`, `LLM_WRITER_PROVIDER`, `LLM_WRITER_API_KEY`, `LLM_WRITER_BASE_URL`, `LLM_WRITER_TIMEOUT_MS` (default 180000), `LLM_WRITER_REASONING` (OpenAI only: `minimal`, `low` (default), `medium` or `high`; a plan took 7 minutes and 130K tokens on `gpt-6.1-sol` before it was set) | Optional. The step that writes plans and answers runs on its own model, even from another provider (for example the reader and query planner on Gemini, the writer on OpenAI). Empty values fall back to the settings above. A base url is not shared with a different provider |

`LlmModule` provides `LLM`: `model(role)` for `router`, `agent` or `writer`, or null with no key. A new provider is one case in `providerFor`.

**Models for plans (checked 2026-10-18, one brief, live Qloo and web search).** The reader, query planner and gate are short structured jobs and stay cheap (Gemini `gemini-3.5-flash-lite`, or OpenAI `gpt-6-luna` at $0.10 / $0.50 per 1M tokens). The writer is the step that decides how good a plan is, so it gets a stronger model:

| Writer | Time per plan | Tokens per plan | Rough cost | What the plan looked like |
|---|---|---|---|---|
| `gpt-6.1-sol` (deeper, for plans that go to financiers) | about 7 minutes | about 150K | about $0.50 | Real December slate, named distributors, NFVCB classification, comps judged correctly (Gangs of Lagos streamed, Citation a Netflix drama) |
| `gpt-6-astra` | about 5 minutes | about 130K | about $2 | About the same as Sol, a little more specific |
| `gpt-5.4-mini` (**default**) | about 2 minutes | about 25K | about $0.04 | Strong audience work from the Qloo findings, and enough launch knowledge once the research prompt targets the industry and markets (below) |

Prices are OpenAI's ($2 / $10 for Sol, $10 / $50 for Astra, $0.75 / $4.50 for mini, per 1M tokens). The cost column assumes about 80% of tokens are input, so check OpenAI's usage page for real figures. The token counts include the reader, planner and web search. OpenAI's GPT-6 models are reasoning models: they ignore `temperature` (the SDK warns), and `LLM_WRITER_REASONING` sets how hard they think. The research step runs on the writer's model, so on mini its facts depend on the prompt: it searches the industry by name ("Nollywood", not only "Nigeria"), runs one search per question and per diaspora city, and keeps only facts about that industry and those markets. On the Third Bridge brief that gave the home market's rival releases with dates and distributors, the monthly box-office pattern, the classification rules and, for London, the UK distributor and chains; Houston and Atlanta returned nothing. Results vary a little between runs. Set the writer's key and model in `.env` ([.env.example](../../.env.example) has the block). A writer on another provider needs its own key, and the main key is never sent to it.

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
