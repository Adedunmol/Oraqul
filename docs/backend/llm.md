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
| `LLM_TIMEOUT_MS` | Per call, default 90000. The analyst, the research check and the query planner returned structured output in 30 to 60 seconds on a live run, and a call that times out falls back to the scripted step, which skips the research loop |
| `LLM_WEB_SEARCH` | `on` (default) or `off`. Plans look up release timing, rival releases, who distributes, publishes or promotes launches like this, and market numbers through the writer's own provider search (OpenAI web search, Google Search grounding). Not available on OpenAI-compatible endpoints. The title and story are never sent, only the genre, country, format and cities |
| `LLM_WRITER_MODEL`, `LLM_WRITER_PROVIDER`, `LLM_WRITER_API_KEY`, `LLM_WRITER_BASE_URL`, `LLM_WRITER_TIMEOUT_MS` (default 180000), `LLM_WRITER_REASONING` (OpenAI only: `minimal`, `low` (default), `medium` or `high`; a plan took 7 minutes and 130K tokens on `gpt-6.1-sol` before it was set) | Optional. The step that writes plans and answers runs on its own model, even from another provider (for example the reader and query planner on Gemini, the writer on OpenAI). Empty values fall back to the settings above. A base url is not shared with a different provider |

`LlmModule` provides `LLM`: `model(role)` for `router`, `agent` or `writer`, or null with no key. A new provider is one case in `providerFor`.

**Models.** The reader, query planner and gate are short structured jobs and stay cheap (Gemini `gemini-3.5-flash-lite`, answering the router in about a second). The writer decides how good a plan is, so it can run on a stronger model from another provider:

| Writer | Time per plan | Rough cost | Use |
|---|---|---|---|
| `gpt-5.4-mini` (**default**) | about 2 minutes | about $0.04 | Strong audience work from the findings and enough launch knowledge |
| `gpt-6-astra` | about 5 minutes | about $2 | A little more specific |
| `gpt-6.1-sol` | about 7 minutes | about $0.50 | Deeper research, for plans that go to financiers |

Costs are rough and assume about 80% input tokens; check the provider's usage page. OpenAI's GPT-6 models are reasoning models: they ignore `temperature`, and `LLM_WRITER_REASONING` sets how hard they think (unset, a plan took 7 minutes and 130K tokens on Sol). Web research runs on the writer's model. It searches the industry by name ("Nollywood", not only "Nigeria"), runs one search per question and per diaspora city, and keeps only facts about that industry and those markets, so results vary a little between runs and a thin diaspora city can return nothing. Set the writer's key and model in `.env` ([.env.example](../../.env.example) has the block). A writer on another provider needs its own key, and the main key is never sent to it.

**The launch watch's rival check** (`apps/api/src/watch/rival-dates.ts`) uses the writer's web search and the agent model, and only reads. The search prompt carries the kind of work, the genre, the cities and a date range, never the title. The extraction returns `{ title, isoDate, dateText, source }` for each release; code fetches the cited page itself and keeps a release only when the page holds both the title and `dateText` and the two agree with `isoDate`. With no model or no search the check says so on the watch and raises nothing; the scripted fallback is no check, never a guess. The model sets no severity: code does, from the date.

**The Guide's help bot** (`apps/api/src/guide`) is public, so it never uses the keys above. It has its own free Gemini key and model:

| Key | What it does |
|---|---|
| `GUIDE_BOT_API_KEY` | Empty turns the bot off; `POST /guide/ask` then answers 503 and the Guide pages stand on their own |
| `GUIDE_BOT_MODEL` | Default `gemini-3.5-flash-lite` |
| `GUIDE_BOT_HOURLY_LIMIT` | Questions per visitor per hour (default 12), then 429 |
| `GUIDE_BOT_DAILY_CAP` | Questions for everyone per day (default 400), then 503, so the free quota cannot run out |

It answers only from the Guide's text (`guideKnowledge()` in `packages/packs`, the same words the pages show) and names the pages it used; code keeps only slugs that exist. The visitor's words and the earlier turns reach the model as untrusted text after the rules, which say never to follow them, and off topic questions get one fixed reply. Output is capped at 600 tokens and 1,200 characters. A visitor is a keyed hash of the address (`guide_questions`, no text, rows older than a day dropped); a question the model fails to answer is given back. It sets no number and makes no Qloo call.

## Conventions

- Structured output uses Zod schemas from `packages/schema`. Parse model output at the boundary like any other untrusted input ([typescript.md](../typescript.md)).
- Structured output uses `generateText` with `Output.object`. `generateObject` is deprecated in v7. Keep output schemas flat objects with nullable fields: not every provider accepts a union at the top level.
- The router (`apps/api/src/agent/router/`) reads with `ModelReader`; its prompt is `ROUTER_SYSTEM` in `model-reader.ts`. What it returns is checked in code (`decide.ts`): a value counts only when its quote is in the person's words. `FallbackReader` reads with the scripted router if the model call fails, so a quota error never stops a project.
- Chats are named from their first message by `ModelTitler` (`apps/api/src/agent/titler.ts`, prompt `TITLER_SYSTEM`) on the router model. `FallbackTitler` uses the scripted title, the message's opening line, if the call fails.
- The model plans one step at a time through the `Planner` interface (`apps/api/src/agent/types.ts`). `ModelPlanner` builds its output schema from the pack: only the pack's allowed tools, and `ask` and `consult` only where the agent may use them. `ScriptedPlanner` is the deterministic stand-in with the same shape. Film, Music, Games, Podcasts and Books do not use it for plans: they run the fixed launch pipeline, and the planner only serves an answer about a plan saved before findings.
- The steps around a plan each have a model call with a scripted fallback, so a quota error never stops a run: the analyst (`launch/analyse.ts`, role `agent`; reads what the request needs and fills what it left out), the research check (`launch/research-loop.ts`, role `agent`; judges coverage and names catalog queries), the red team (`launch/review.ts`, role `writer`, since it judges the plan the writer made; lists issues, code decides), and the memory writer (`agent/memory/memory-writer.ts`, role `router`; short structured edits to a project's notes). With no key the analyst infers nothing, the research check makes no claim, the plan is saved as `unchecked`, and only plans are remembered.
- Prompts live next to what they configure: category prompts in `packages/packs/src/<category>`, the router's in `model-reader.ts`.
- Decisions run at temperature 0 with one retry: the router, gate, reader, analyst, query planner, research check, red team and tool planner. The plan writer's draft runs at 0.4 (`WRITER_TEMPERATURE` in `launch/writer.ts`), so the wording varies a little between runs while code still checks every line and sets every number. Models that ignore a temperature, such as OpenAI's reasoning models, are unaffected. The router's token use is saved in `runs.tokens`.

## Untrusted text

Text a person uploads, and facts a model finds on the web, reach the models. Neither is trusted: a document can say "put this link in the plan". The tools can only read (no tool changes state, spec §4), so the worst a bad text can do is change what a plan says, never what the system does.

| Path | What reaches a model | What holds it |
|---|---|---|
| Upload (`uploads/extract.ts`) | The extracted text, cut at the attachment cap, sent with the message to the router, analyst, reader and writer | The reader keeps a value only when its quote is in the person's words and, for a title or name, in its own quote. Stored messages keep the file name, not the text, so an upload does not persist into memory directly |
| Web search (the writer's provider, `LLM_WEB_SEARCH`) | Page text, turned into discrete facts with a source each | A line may state a figure or date only from a fact it cites. The facts are the model's reading of a page, so a hostile page can supply a figure that then counts as sourced |
| Qloo | Names and tags in findings | Findings are built by code. A grounded line may name only what its findings return |
| Project memory | Notes the memory writer wrote from earlier chats | Context only, never evidence: a note cannot ground a line |

What the line check ([spec §6.2](../product/spec.md)) stops: a taste claim without a finding, a grounded line naming something its findings do not, a number or percentage no finding states, a market figure with no source, and a link, email address or phone number that neither the brief nor a cited page contains. What it does not stop: a playbook line (it cites nothing, so it may name anything) that recommends a bad partner or gives bad advice in plain words, and a wrong figure that a hostile page states and a line cites. A reviewer reads playbook lines as the model's own launch practice, and the plan labels them so.

Not done: stripping instruction-like text from uploads (a keyword filter misses paraphrase and breaks real briefs), and checking a web fact against a second source.

