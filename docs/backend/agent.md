# Agent runtime

Oraqul's agents (not the coding agents that work on this repo, see `AGENTS.md`). Design is in [spec §3 to §5](../product/spec.md). Code goes in `apps/api/src/agent` (runtime) and `packages/packs` (per category).

## Shape

One router, one front door (gate), one runtime with two paths, five category packs. A new category is a new pack, not new runtime code.

- **Plan pipeline** for build, audit, fix, scenario, date and partner. Fixed steps in code, so a plan is repeatable. See [Plan pipeline](#plan-pipeline).
- **Tool loop** (`runtime.ts`, built) for answers, clarifying questions and consults. The planner picks the next step; code runs it.

Plans must not run on the tool loop. A model choosing which tests a plan runs gives different tests for the same input, which breaks the promise that a plan was checked and makes golden runs meaningless.

## A category pack

Defined by `CategoryPack` in `packages/packs/src/types.ts`. Every category fills:

- Title, blurb and `covers` (what the router offers and matches)
- System prompt and assumption checklist
- Tool allowlist and `consults` (other categories this agent may ask; only Books asks Film)
- `qloo`: the Qloo entity types it tests
- `coverage`: tests, thin and not supported lists
- `baselines`: mass-market names a candidate is scored against in the same call

Film, Music, Games and Podcasts keep their depth next to the pack, not in the type: `packages/packs/src/<category>/catalog.ts` (the query catalog), `modules.ts` (module rules, budget convention, taste words) and `plan.ts`, exported as `filmPlan`, `musicPlan`, `booksPlan`, `gamesPlan` and `podcastsPlan`. The versioned launch rules (timeline, signal, channels, budget bands, partner tiers) are in `packages/packs/src/rules/`. What both share is in `packages/packs/src/launch.ts` (section titles, `TASTE_CLAIM`, brand categories, music scenes). Scenarios, results format and the output schema from [spec §3.2](../product/spec.md) live in the launch runtime (`apps/api/src/agent/launch`) and `packages/schema`, not in the pack.

**Shared base prompt.** The rules every agent follows live once in `BASE_PROMPT` (`packages/packs/src/base-prompt.ts`): cite a receipt for every claim, never set a number, a score, a verdict or a confidence level, say when a tool could not test something, treat memory as context and never evidence, and refuse forecasts, pricing advice and sending (drafts only). A pack's `systemPrompt` adds only what is its own (how to read its inputs, its tone), and `agentSystemPrompt(pack)` joins the two. The model planner's own rules are only about choosing a step.

**Pack contract test.** `packs.test.ts` checks all five packs: the text fields, assumption checklist, tool allowlist and `qloo` titles are filled, every `toolAllowlist` entry is a tool in `packages/engine` and none repeats, a pack's prompt leaves the shared rules to the base prompt, and `consults` only lists categories the spec allows (spec §3.4). `modules.test.ts` in the Film, Music, Games, Podcasts and Books folders pins module choice.

Film, Music, Games, Podcasts and Books each have their deep pass (catalog, modules, launch config). `demoProjects` in `packages/packs/src/demo.ts` is one stand-in project per category that the runtime and evals use until projects live in Postgres. It is not served to anyone: there is no demo access without an account.

## Tools

Every tool returns `{ data, receipts }` (`ToolResult` in `packages/engine`): one receipt per Qloo call, and `data` names the receipt behind each item. The model sees `data` and the receipt ids. Tool list: [spec §4](../product/spec.md). Every Qloo call goes through `packages/engine`, which returns `{ data, call }`. The tool turns each call into a receipt with `toReceipt`, adding the rule and a confidence from `confidenceFor` ([spec §5.1](../product/spec.md#51-confidence)). Leave one out reruns live inside the tool (`tools/leave-one-out.ts`), so a tool's answer already carries its confidence.

## Rules that must hold

- Scores, verdicts and confidence are computed by code in `engine`. The model explains and never sets a number.
- The model may pick which catalog queries run in a later research round, never what a query asks beyond the catalog and the plan's checked parameters. Code validates every pick, runs the query and makes the findings.
- Every entity the model names must appear in data Qloo returned in that run. A validator rejects the output otherwise and the step reruns.
- If Qloo errors after one retry, the line is "could not test". Never fill from the model.
- Agents do not call each other. Two exceptions, both bounded. Books asks the Film side one question about the first screen title the team named (`filmConsult` in `books/findings.ts`, a fixed step). And the research check may pick a consult from the offers code makes (`LaunchConfig.consults`, run by `launch/consult.ts`): Film offers its soundtrack artists to the Music side, Books its other screen titles to the Film side, Games its named collabs (an artist, film or series, asked of whichever side Qloo says it belongs to) and Podcasts its guests (measured only if Qloo knows them as artists). Music offers none: its brief names no screen titles. A consult runs the other side's own tests (audience skew and city ranking) on one named entity, costs about three Qloo calls, and returns findings with receipts. The model chooses among the offers; it cannot add one. The generic tool loop can also consult.
- Limits per run: max steps and max Qloo calls (`QLOO_CALL_BUDGET`). The stop rule and rerunning only the lines whose inputs changed are not built: a what-if reruns every query.
- A model reviews a draft plan but sets no number: it lists issues and code decides. The stress test of the audience is still the leave one out rerun in `engine` (spec §3.3).
- The agent refuses forecasts, pricing advice and sending anything. Drafts only.

## How a run works

```
POST /teams/:teamId/projects  ->  draft project + first chat  ->  router  ->  category agent
            (first message)                                        |    ^           (placeholder)
                                                         single / text card
                                                                   |    |
                                             POST /threads/:id/messages (pick or typed text)
```

The request that starts a run returns as soon as the message is saved. The run goes on in the background and the web follows it on `GET /threads/:id/events`. Runs live in the API process, so the API runs as one process.

Code is in `apps/api/src/agent`:

| File | Role |
|---|---|
| `router/` | Spec §3.1. Reads the title, category and mode from the conversation (`ModelReader`, or `ScriptedReader` with no key or when the model fails). `decide.ts` keeps only values whose quote is in the person's words, refuses off-topic messages with fixed copy, and asks one card at a time: category and mode first, then the title. `router.ts` is one turn: a pick on the card settles what the option names with no model call; typed text is added to the conversation and everything is read again. Its state is plain JSON in `runs.state` |
| `gate/` | The front door for an active project. Every message goes through `gateSegment` in `run.service.ts` before a category agent sees it. A model (`ModelGate`, role `router`) returns `on_topic`, `off_topic` or `unclear`, and code decides: `off_topic` gets the fixed `OFF_TOPIC_REPLY` and no agent run; `unclear` asks a `single` card of two or three close readings (a follow up we mistook for something new, or a nearby idea the agent can use), whose pick goes straight to the agent; `on_topic` passes. With no model key, or when the call fails, `ScriptedGate` passes everything, since it cannot tell the cases apart. The gate is one run row (`agent: gate`) per message, and an open card is kept in its `state` |
| `category-agents.ts` | `CategoryAgent`: `run(handoff, emit, resume?)` returns an `AgentRun` (stop reason, the state to resume from, receipts, the output if it made one, tokens, Qloo calls), and `replyLabel` checks a reply against the open card before a run starts. All five are real agents, each a `LaunchAgent` in `launch/agent.ts` configured by a `LaunchConfig` (`film/config.ts`, `music/config.ts`, `games/config.ts`, `podcasts/config.ts`, `books/config.ts`). `PlaceholderAgent` (one trace step and a message saying the agent is not connected) remains as the base `placeholderAgents()` spreads, for a category a test builds no agent for |
| `launch/` | The runtime Film, Music, Games, Podcasts and Books share: `agent.ts` (`LaunchAgent`, job dispatch), `pipeline.ts` (build and the `askQloo` / `writePlan` stages), `audit.ts`, `fix.ts`, `follow-up.ts` and `follow-ups.ts`, `findings.ts` and `brief.ts` (findings, audience, verdicts), `writer.ts`, `check.ts`, `decisions.ts`, `research.ts`, `results.ts`. See [film-overview.md](film-overview.md). Optional hooks a category may use: `LaunchConfig.codeSections.timeline` (a section code builds whole, with `today`), `LaunchConfig.applyChange` (the part of a what-if only that category reads, such as a collab), `GroundSpec.standInPlaces` (cities ranked as the team's when it named none), `CheckRules.figureWords` (counts that need a source), `WriteInput.today` and `Voice.yourPlaces` |
| `film/` | What is Film's own: `config.ts` (`filmLaunch`), `read.ts` (brief reader), `planner.ts` (query shaping), `findings.ts` (Film's queries), `writer.ts` (prompts and templates), `check.ts` and `decisions.ts` (Film's rules), `audit-verdicts.ts`, `agent.ts` (`FilmAgent`). The other files here (`pipeline.ts`, `audit.ts`, `fix.ts`, `follow-up.ts`, `brief.ts` and similar) are thin wrappers that keep Film's signatures over `launch/` |
| `output-store.ts` | Saves a run's receipts, and its outputs when it made a plan or a report, in one transaction (a fix saves two, each the child of the one before, and each with the calls it rests on), and points the chat's `base_output_id` at the last |
| `run.service.ts` | Creates the draft project, posts messages (409 while a run is going), runs the router and then the category agent in the background, stores every event and streams it. On start up, runs left `running` by a stopped process are marked `error` |
| `thread-store.ts` | The transcript in `messages`: one row per stored event, `seq` in order. Turns rows into chat items for `GET /threads/:id` and back into events for a stream that joins late |
| `runtime.ts` | `advance(state, deps, answer?)`: the tool loop the real category agents will use. Runs until the agent finishes, asks, or hits a limit, then emits `run.stopped`. The answer resumes it |
| `types.ts` | `Step` (`tool`, `ask`, `consult`, `finish`), `HistoryItem`, `Planner` |
| `scripted-planner.ts` | Deterministic planner, used when `LLM_API_KEY` is empty |
| `model-planner.ts` | Model planner, see [llm.md](llm.md) |
| `grounding.ts` | Rejects a finish whose claims cite receipts the run did not make |

Routes are in `apps/api/src/projects` (spec §7) and are guarded by `SessionGuard` and `RolesGuard`: owners and editors write, viewers read. The guard finds the team from `:teamId`, `:projectId` or `:threadId`.

Each run segment is a `runs` row: the router's segments carry `agent: router` and its state; the category agent's carry the category and the job. A segment stops `finished`, `waiting` (on a card), `stopped` (the person pressed Stop: `POST /threads/:id/cancel` aborts the thread's run, which unwinds at its next emitted event, saves no output and says so) or `error`; the stream ends each with `run.stopped`. The router's trace is "Reading your message", then "Handing this to the Music agent". When it routes, it fills in the project (name, category, mode, `status: active`), and emits `project.updated` with the chat's name. Every chat is named once, from its first message, by the titler (`agent/titler.ts`): a short summary from the router model, or the message's opening line cut to 48 characters when there is no model or the call fails. A chat stays "New chat" until its first message.

The tool loop is for conversation, not plans (see [Shape](#shape)). In it the planner only chooses the next step. The runtime runs it, so receipts, limits, questions and consults stay in code:

- **Tool step.** Checked against the pack's allowlist. The tool runs, its receipt is stored and streamed as a `receipt` event, and the planner sees the data and the receipt id. A `QlooError` becomes a receipt with confidence `lower` and a "could not test" history item. A spent budget ends the run with `budget` and a message listing the calls made.
- **Ask step.** The question is stored as pending, a `question` event goes out, and the run stops with `waiting`. The answer must name that question id and option ids on the card.
- **Consult step.** Only if the pack lists the target, and only in this generic loop: Books lists `film`. Its launch pipeline does not use this step; it runs the Film tests on a named screen title as a fixed step (spec §3.4). A nested loop for the target pack runs with a 4 step cap and no questions, shares the run's receipts, and shows in the trace as `books→film`. Its claims come back to the caller, which can cite them.
- **Finish step.** Every receipt id in every claim must exist in the run. One retry, then the run stops with `error`. This is a first cut of the output validator: it does not yet check entity names or numbers in the text.
- **Limits.** `AGENT_MAX_STEPS` per agent, `QLOO_CALL_BUDGET` per run: `ToolContext` makes one `QlooClient` per run and the budget is that client's. A run is one `runs` row, so a run that resumes after a question gets a new client, budget and cache, and a consult shares its caller's client. There is no cap per thread or team; `runs.qloo_calls` keeps each run's count, so one can be added from it if the monthly quota needs it.

## Plan pipeline

Film's build job, in `launch/pipeline.ts` (the audit and the fix reuse its stages: [film-overview.md](film-overview.md#the-audit-and-the-fix)); [film-overview.md](film-overview.md) is the step by step map. Product behaviour is [spec §3.2](../product/spec.md) and the Film tests are [spec §5.2](../product/spec.md#52-film-assumption-tests-build). Every reply runs two stages, findings and then the reply:

1. Read the brief (model, every value carries the words it came from, checked by code).
2. Analyse the request (`launch/analyse.ts`, model with a scripted fallback that infers nothing): what was asked, goals, constraints, the checks a good answer must pass, and values the person left unsaid. `applyAnalysis` fills only empty fields, and only with a city in the city table or a Qloo age band; each fill is returned as an assumption on the plan. This runs before the questions a build may ask, so a brief with a country but no city plans instead of asking. A full build may ask two: the minimum (a description and a market), then once for the budget band when the brief states none (`launch/band.ts`; the answer is a band, never more of the brief, and a what-if keeps it).
3. Find the comps with `resolveBundle`, settling same-name titles in code and proposing comps only below 3.
4. Pick the modules and shape the queries (model, bounded by code, spec §4.1).
5. Ground: run the queries and turn each result into a finding, streamed to the chat. A query Qloo answers with nothing is asked again with its narrowest filter dropped (release years, then age band, then city; never a place list's city, never a list with nothing left to shape it), at most twice. The finding says it is the wider read and is never above medium confidence.
6. Check the research (`launch/research-loop.ts`, model with a scripted fallback that makes no claim): the model says, for each check the analyst set, whether the findings cover it, and may name up to three catalog queries the first round did not run. Code keeps a coverage claim only when a real finding above low confidence backs it, keeps only queries on the catalog's unrun list, and skips the round when fewer than 12 Qloo calls are left. The extra queries run on the first round's brief, so the audience and cities are not asked twice. The model may also pick from two more lists code builds: empty queries that can be asked another way (`Grounded.misses`: the same anchors without the genre tag, the release country or the popularity band, never with nothing left to shape the list), and consults to another side (see Rules). A retried finding says how it was asked and is never above medium confidence. The check and what it sends out take turns, at most three times (`MAX_RESEARCH_ROUNDS`): after each batch the model judges the findings again, and the loop ends when every check that needs evidence is covered, nothing unrun is left, the model names nothing more, or the Qloo calls run low. Each turn is a trace step that says how many checks are still open.
6a. Check the rival dates (`launch/clash.ts`): `Rivals: Title on YYYY-MM-DD` in the brief is read by form, each rival is scored against the comps in one `scoreRivals` call, and the result is the finding `f-clash` (cited by plan lines), `brief.dates` and a receipt per date. `runDateCheck` shares the scoring. The seeded partners for each city's market are added to the brands Qloo ranks (`partners.ts`, one `resolveBundle` call, a flagship only when the band can carry it).
7. Rank the evidence in code (`launch/evidence.ts`): each check's findings by confidence and affinity. The writer gets them as "What each check rests on".
8. Write the plan (model, or templates with no key), then check every line (spec §6.2). A line that fails is dropped and goes back to the writer with its reason.
9. Red team (`launch/review.ts`, model on the writer role, none with no key): compares the request, the chat, the checks and the draft. The model lists issues, each against a check, with a type, a fix and whether it blocks; code decides pass or fail from the list alone and never from the model's own verdict. A blocking issue sends the draft back to the writer with the issues, after up to three more catalog queries when the issue names one on the unrun list and enough Qloo calls are left. At most three drafts. Nothing is saved before this ends: the plan is saved once, passed, or flagged with the open issues and what the person could give to settle them. With no key the plan is saved as `unchecked`. A fix is not reviewed, since the audit it is written from already tested the plan. When the loop ends flagged and an issue needs something only the person can settle, the red team may set `ask` on any issue it raises (blocking or not), and the first blocking one's question is used, else the first one's. The plan is still saved (flagged); then one `single` card follows, "One thing would settle this plan", with "Leave it as it is" as its option. Leaving it ends the run with no new work. Typing an answer makes the plan again with it, as a new version. It is asked at most once, and a fix never asks.

After the draft loop code fills the rest of the plan (`launch/direction.ts`, `territories.ts`, `partners.ts`, `signal.ts`): the rules version, the band, the signal and target, one territory per city (home first, then the diaspora cities), the direction calls and the partners by tier. Four sections are code-written and the writer never sees them: Timeline (`beatsSection` from the rule library for Film and Music, the kind profiles for the others), What to measure (`measureSection`), Channels (`channelsSection`) and the existing Budget split and To sharpen. `withSharedModules` adds Channels and Creative briefs to every full plan. Rules: [launch-rules.md](../product/launch-rules.md).

The creative kit is a follow up job (`launch/creative.ts`, asked for in plain words, read by `askedCreative`): it builds Hook options, Scripts, Shot lists, Key art briefs and Caption packs for one territory and channel from the plan's findings and the rule library, checks every line with `checkLine`, and saves an output of kind `creative`. A request to generate an ad, trailer, image or video is refused in fixed words (`REFUSALS.asset`).

No model writes a number, verdict or confidence. Each step is a `trace.step`; a research round, a retry and a consult each say what they ask and why. The plan saves `process`: every research round (what was open, what was asked, retried and consulted, and whether Qloo had an answer), the number of drafts, and every line the check removed with its draft. A clarifying question pauses the pipeline as an ask does in the loop. The answer starts the build again with the answer added to the brief: the up front question runs before any Qloo call, so nothing is lost, and the settle question follows a saved plan. Scenario, date and partner are the same pipeline started from a saved plan. Golden runs ([testing.md](../testing.md)) run it on recorded Qloo responses and expect the same findings every time.

## Agent factory

`agent.module.ts` builds the agents: Film gets `FilmAgent`, Music gets `MusicAgent`, Games gets `GamesAgent`, Podcasts gets `PodcastsAgent` and Books gets `BooksAgent`, each with its own model reader (scripted when `LLM_API_KEY` is empty or the model fails) and a new `ToolContext` per run (`QLOO_MODE` picks demo or live Qloo, `QLOO_CALL_BUDGET` the budget). For an answer about a plan saved before findings, the agent gets a `ModelPlanner` with a key, or a `PlanSummaryPlanner` without. There is no `createCategoryAgent(pack)` yet: a new category is a pack plus a launch config and its own agent wiring in `agent.module.ts`.

## Handoff

`Handoff` in `category-agents.ts` is what a category agent gets for one run:

- `category`, `mode` and `title`, from the router;
- `inputs`: the first message and its files, kept on the project (`projects.inputs`, spec §6) when the project is created;
- `message`: the message this run answers, which right after routing is the first message again, and on a gate card pick is the picked option;
- `recent`: the newest lines of the chat that fit about 40 lines, oldest first, ending with `message`; empty right after routing. The gate judges the same lines.
- `fresh` and `memory`: a standalone chat, and what the project remembers for a chat that uses it (see [Memory](#memory)).
- `planId`: the plan the chat works on now (`threads.base_output_id`), null before the first plan.

**Resuming.** When the agent's last run in a chat stopped `waiting` on a card, the next message or card answer resumes that run with its saved `runs.state`, and the gate does not judge it. `replyLabel` checks the answer first, so a wrong option is a 400 before anything runs.

A file's text is kept whole on the project (an upload allows 200 000 characters), and each reader cuts it to what its model should see: the router and a build read the first 8 000 characters of each file (`ATTACHMENT_CHARS`, `cutFiles`), so a long brief does not fill a model's context, and an audit or a fix reads up to 40 000 (`PLAN_CHARS`), since the plan is the thing being tested. The gate gets only the category, mode and title, never the files. The structured `ProjectInput` (lead, comps, places) that `newRunState` and `AgentContext.project` take is not in the handoff: the plan pipeline's read step builds it from `inputs` and `message`.

## Replies: a plan, a report and an answer

The product behaviour is in [spec §3.6](../product/spec.md). The kind comes from the job (see [Follow ups](#follow-ups)), not from a flag on the reply: `AgentReply` in `packages/schema` is only `message` and `claims`.

- **A plan** (build, scenario, and the plan a fix writes) or **a report** (audit) writes an `outputs` row with its receipts and streams `output.created`. A fix writes two in one run, the report and then the plan whose parent it is, so a run returns its last output as `output` and the ones before it as `earlier`.
- **An answer** is a `message` event with claims, no `outputs` row. On a launch plan it is written from the plan's findings and passes the same line check as the plan (spec §6.2); each claim cites the calls behind its findings. Plans saved before findings use the tool loop and the grounding check.
- **Not built:** a `kind` on the reply, and the "Do you want a plan for this, or just an answer?" card. A message in a chat with a plan is read as a follow up, and one without a plan starts the project's job.

A date check or partner brief does not become the chat's current plan; a scenario does. Not built: corrections that change the category or mode ("check my plan instead", "start fresh").

## Versions

Every saved plan carries `outputs.versions`: the writer model (null when the template writer ran), a hash of the system prompts the pipeline sends (`promptVersion`, `agent/versions.ts`), the commit the server was built from (`CODE_VERSION`, `dev` when unset) and the Qloo host (`demo` in demo mode). A drop in quality can then be pinned to a change, and two plans are compared fairly only when these match.

## Memory

Product behaviour is [spec §3.7](../product/spec.md): two layers (chat, project), memory is context and never evidence, the person can see, rewrite and forget what the project remembers. There is no team layer.

**Reading it.** `RunService` builds the `Handoff` for each message. A chat that uses project memory gets `memory`: the project's `plan` items first, then its key points and decisions (`MemoryStore.lines`). A standalone chat (`threads.fresh`) gets none, and `fresh: true` on the handoff sends it to `runStandalone` (`launch/follow-ups.ts`) on the tool loop with no plan, brief or notes, knowing only the category and the project's name. Unlike every other run, it drops a made up citation from the reply instead of failing the run (`runLoop` in `runtime.ts`, matched by `STANDALONE_CONTEXT`), and its prompt does not ask for launch knowledge to be labelled. The gate also treats basic questions about the project's own subject as on topic. The notes are put in the follow-up planner's context, the answer writer's chat block and the red team's context, each labelled as the project's notes. The base prompt tells every model that notes are context, not evidence.

**The chat.** `recentLines` returns the thread's summary as a first line ("Earlier in this chat, in short: …"), then the newest lines after it that fit about 40 lines and 12 000 characters (`withinChars`), after filtering out trace, output and context rows in SQL so they cannot crowd the real lines out. Once more than 40 lines are not summarised, `RunService.summarise` folds all but the newest 20 into `threads.summary` (`summary/chat-summarizer.ts`, role `router`; with no key it keeps the person's own words) and moves `threads.summarized_through` to the last line folded, after the run has stopped. The gate, the follow-up reader, the analyst and the answer writer read the same lines.

**Writing it.** After a run that finished in a chat that uses project memory, `RunService.remember` runs before the run stops, so the reply can say what was kept (a failure is logged and never fails the run):

1. Each saved plan, scenario, audit or fix is remembered by code as a `plan` item (`MemoryStore.rememberPlan`): a newer output from the same chat replaces that chat's item, one from another chat adds a second.
2. The memory writer (`memory/memory-writer.ts`, role `router`) reads the notes kept and the exchange and returns add, update and remove operations. `checkOps` keeps an operation only when it is safe: an update or remove names a note that exists, a repeat is dropped, text is at most 280 characters, and the project keeps at most 30 notes. With no model key no notes are written; plans are still remembered.

When notes were added or changed the chat gets a quiet "Remembered: …" line under the reply (a `memory.used` event whose items have the source `saved`). A standalone chat writes nothing.

**Citing.** A claim may cite only receipts from this run or from an earlier plan's receipts by id. A memory item has no receipt, so the grounding check (`grounding.ts`) rejects a claim that cites one.

## Demo mode

`QLOO_MODE=demo` (default) runs everything on hand-written data from `packages/engine/src/qloo/demo-fetch.ts`. Every receipt carries `source: 'demo'`, the trace says so, and the final message says "demo data".

## MCP

`packages/mcp` registers the same tool objects from `packages/engine`. `pnpm --filter @oraqul/mcp build` then `node packages/mcp/dist/stdio.js` (demo data unless `QLOO_MODE=live`). Results are `{ data, receipts }` as JSON text.
