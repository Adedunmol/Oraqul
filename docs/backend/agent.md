# Agent runtime

Oraqul's agents (not the coding agents that work on this repo, see `AGENTS.md`). Design is in [spec §3 to §5](../product/spec.md). Code goes in `apps/api/src/agent` (runtime) and `packages/packs` (per category).

## Shape

One router, one front door (gate), one runtime with two paths, five category packs. A new category is a new pack, not new runtime code.

- **Plan pipeline** for build, scenario, date and partner. Fixed steps in code, so a plan is repeatable. See [Plan pipeline](#plan-pipeline).
- **Tool loop** (`runtime.ts`, built) for answers, clarifying questions and consults. The planner picks the next step; code runs it.

Plans must not run on the tool loop. A model choosing which tests a plan runs gives different tests for the same input, which breaks the promise that a plan was checked and makes golden runs meaningless.

## A category pack

Defined by `CategoryPack` in `packages/packs/src/types.ts`. Fill these per category (film, music, books, podcasts, games):

- System prompt
- Assumption checklist
- Assumption tests: for each kind of assumption, the tool calls that test it and the rule that turns their results into a verdict (used by the plan pipeline)
- Plan sections
- Tool allowlist
- Coverage lists (tests, thin, not supported)
- Scenarios (matcher and apply function)
- Results format
- Output schema

**Shared base prompt.** The rules every agent follows live once in `BASE_PROMPT` (`packages/packs/src/base-prompt.ts`): cite a receipt for every claim, never set a number, a score, a verdict or a confidence level, say when a tool could not test something, treat memory as context and never evidence, and refuse forecasts, pricing advice and sending (drafts only). A pack's `systemPrompt` adds only what is its own (how to read its inputs, its tone), and `agentSystemPrompt(pack)` joins the two. The model planner's own rules are only about choosing a step.

**Pack contract test.** `packs.test.ts` checks all five packs: the text fields, assumption checklist, tool allowlist and title types are filled, every `toolAllowlist` entry is a tool in `packages/engine` and none repeats, a pack's prompt leaves the shared rules to the base prompt, and `consults` only lists categories the spec allows (spec §3.4). A half filled pack fails the build. Plan sections, assumption tests and coverage join the check with Film's deep pass, since no pack fills them yet.

The type holds the system prompt, assumption checklist, plan sections, tool allowlist, `consults` (other categories this agent may ask, only Books asks Film) and coverage lists. Add the rest as the runtime needs them. Every pack is filled with basics only; each category gets its deep pass later. `demoProjects` in `packages/packs/src/demo.ts` is one stand-in project per category that the runtime and evals use until projects live in Postgres. It is not served to anyone: there is no demo access without an account.

## Tools

Every tool returns `{ data, receipts }` (`ToolResult` in `packages/engine`): one receipt per Qloo call, and `data` names the receipt behind each item. The model sees `data` and the receipt ids. Tool list: [spec §4](../product/spec.md). Every Qloo call goes through `packages/engine`, which returns `{ data, call }`. The tool turns each call into a receipt with `toReceipt`, adding the rule and a confidence from `confidenceFor` ([spec §5.1](../product/spec.md#51-confidence)). Leave one out reruns live inside the tool (`tools/leave-one-out.ts`), so a tool's answer already carries its confidence.

## Rules that must hold

- Scores, verdicts and confidence are computed by code in `engine`. The model explains and never sets a number.
- Every entity the model names must appear in data Qloo returned in that run. A validator rejects the output otherwise and the step reruns.
- If Qloo errors after one retry, the line is "could not test". Never fill from the model.
- Agents do not call each other. Only exception: Books may ask Film one bounded question.
- Limits per run: max steps, max Qloo calls (`QLOO_CALL_BUDGET`), and a stop rule. Follow ups rerun only lines whose inputs changed.
- The red team step sees the finished brief and receipts, not the reasoning.
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
| `category-agents.ts` | `CategoryAgent`: `run(handoff, emit, resume?)` returns an `AgentRun` (stop reason, the state to resume from, receipts, the output if it made one, tokens, Qloo calls), and `replyLabel` checks a reply against the open card before a run starts. Film is the real agent; the other four are placeholders: one trace step and a message saying the agent is not connected yet |
| `film/` | The Film agent ([film-overview.md](film-overview.md)). `read.ts` reads the brief, `planner.ts` shapes the queries, `findings.ts` runs them and builds the findings, `writer.ts` writes the plan, `check.ts` checks every line, `pipeline.ts` runs the steps, `brief.ts` builds the audience and verdicts, `agent.ts` wires them to `CategoryAgent` |
| `output-store.ts` | Saves a run's receipts, and its output when it made a plan, in one transaction, and points the chat's `base_output_id` at the new plan |
| `run.service.ts` | Creates the draft project, posts messages (409 while a run is going), runs the router and then the category agent in the background, stores every event and streams it. On start up, runs left `running` by a stopped process are marked `error` |
| `thread-store.ts` | The transcript in `messages`: one row per stored event, `seq` in order. Turns rows into chat items for `GET /threads/:id` and back into events for a stream that joins late |
| `runtime.ts` | `advance(state, deps, answer?)`: the tool loop the real category agents will use. Runs until the agent finishes, asks, or hits a limit, then emits `run.stopped`. The answer resumes it |
| `types.ts` | `Step` (`tool`, `ask`, `consult`, `finish`), `HistoryItem`, `Planner` |
| `scripted-planner.ts` | Deterministic planner, used when `LLM_API_KEY` is empty |
| `model-planner.ts` | Model planner, see [llm.md](llm.md) |
| `grounding.ts` | Rejects a finish whose claims cite receipts the run did not make |

Routes are in `apps/api/src/projects` (spec §7) and are guarded by `SessionGuard` and `RolesGuard`: owners and editors write, viewers read. The guard finds the team from `:teamId`, `:projectId` or `:threadId`.

Each run segment is a `runs` row: the router's segments carry `agent: router` and its state; the category agent's carry the category and the job. A segment stops `finished`, `waiting` (on a card), or `error`; the stream ends each with `run.stopped`. The router's trace is "Reading your message", then "Handing this to the Music agent". When it routes, it fills in the project (name, category, mode, `status: active`), and emits `project.updated` with the chat's name. Every chat is named once, from its first message, by the titler (`agent/titler.ts`): a short summary from the router model, or the message's opening line cut to 48 characters when there is no model or the call fails. A chat stays "New chat" until its first message.

The tool loop is for conversation, not plans (see [Shape](#shape)). In it the planner only chooses the next step. The runtime runs it, so receipts, limits, questions and consults stay in code:

- **Tool step.** Checked against the pack's allowlist. The tool runs, its receipt is stored and streamed as a `receipt` event, and the planner sees the data and the receipt id. A `QlooError` becomes a receipt with confidence `lower` and a "could not test" history item. A spent budget ends the run with `budget` and a message listing the calls made.
- **Ask step.** The question is stored as pending, a `question` event goes out, and the run stops with `waiting`. The answer must name that question id and option ids on the card.
- **Consult step.** Only if the pack lists the target. A nested loop for the target pack runs with a 4 step cap and no questions, shares the run's receipts, and shows in the trace as `books→film`. Its claims come back to the caller, which can cite them.
- **Finish step.** Every receipt id in every claim must exist in the run. One retry, then the run stops with `error`. This is a first cut of the output validator: it does not yet check entity names or numbers in the text.
- **Limits.** `AGENT_MAX_STEPS` per agent, `QLOO_CALL_BUDGET` per run: `ToolContext` makes one `QlooClient` per run and the budget is that client's. A run is one `runs` row, so a run that resumes after a question gets a new client, budget and cache, and a consult shares its caller's client. There is no cap per thread or team; `runs.qloo_calls` keeps each run's count, so one can be added from it if the monthly quota needs it.

## Plan pipeline

Film's build job, in `film/pipeline.ts`; [film-overview.md](film-overview.md) is the step by step map. Product behaviour is [spec §3.2](../product/spec.md) and the Film tests are [spec §5.2](../product/spec.md#52-film-assumption-tests-build). Every reply runs two stages, findings and then the reply:

1. Read the brief (model, every value carries the words it came from, checked by code).
2. Find the comps with `resolveBundle`, settling same-name titles in code and proposing comps only below 3.
3. Pick the modules and shape the queries (model, bounded by code, spec §4.1).
4. Ground: run the queries and turn each result into a finding, streamed to the chat.
5. Write the plan (model, or templates with no key).
6. Check every line (spec §6.2), then save.

No model writes a number, verdict or confidence. Each step is a `trace.step`. A clarifying question pauses the pipeline as an ask does in the loop, and the answer resumes it at the step that asked. Scenario, date and partner are the same pipeline started from a saved plan. Golden runs ([testing.md](../testing.md)) run it on recorded Qloo responses and expect the same findings every time.

## Agent factory

`agent.module.ts` builds the agents: Film gets `FilmAgent` with the model reader (scripted when `LLM_API_KEY` is empty or the model fails) and a new `ToolContext` per run (`QLOO_MODE` picks demo or live Qloo, `QLOO_CALL_BUDGET` the budget). The rest stay placeholders. The general form below replaces this as each category gets its pipeline. One function, `createCategoryAgent(pack)`, does it for all five: it picks the planner (model planner when `LLM_API_KEY` is set, else scripted), creates the run's `QlooClient` with its call budget, builds the run state, and runs the plan pipeline for a plan job and `advance()` from `runtime.ts` for an answer. A new category then adds a pack and nothing else. It is built in the Film PR (item 3), with the pipeline it runs: before that a factory would have nothing to run, since plans may not fall back to the tool loop and the tool loop needs the `ProjectInput` the read step builds.

## Handoff

`Handoff` in `category-agents.ts` is what a category agent gets for one run:

- `category`, `mode` and `title`, from the router;
- `inputs`: the first message and its files, kept on the project (`projects.inputs`, spec §6) when the project is created;
- `message`: the message this run answers, which right after routing is the first message again, and on a gate card pick is the picked option;
- `recent`: the chat's last 8 lines, oldest first, ending with `message`; empty right after routing. The gate judges the same lines.
- `planId`: the plan the chat works on now (`threads.base_output_id`), null before the first plan.

**Resuming.** When the agent's last run in a chat stopped `waiting` on a card, the next message or card answer resumes that run with its saved `runs.state`, and the gate does not judge it. `replyLabel` checks the answer first, so a wrong option is a 400 before anything runs.

A file's text is cut to 8 000 characters (`ATTACHMENT_CHARS`) wherever it is kept or read, so a long plan does not fill a model's context. The gate gets only the category, mode and title, never the files. The structured `ProjectInput` (lead, comps, places) that `newRunState` and `AgentContext.project` take is not in the handoff: the plan pipeline's read step builds it from `inputs` and `message`.

## Replies: a plan and not a plan (partly built)

An agent's finish step has two kinds of reply. The product behaviour is in [spec §3.6](../product/spec.md). For Film, the kind comes from the job (see [Follow ups](#follow-ups)): a build, what-if, date check or partner brief is a plan, a question is an answer. The rest below is still to build for the general case:

- **A way to say which kind it is.** `AgentReply` in `packages/schema` gets a `kind`: `plan` or `answer`. The model's word for it is not trusted alone: the runtime checks that a `plan` carries the brief and receipts a plan needs, and rejects it otherwise.
- **A plan** (build, audit, rescue, scenario, date, partner) writes an `outputs` row with its receipts and streams `output.created`.
- **An answer** is a `message` event with claims, no `outputs` row. On a launch plan it is written from the plan's findings and passes the same line check as the plan (spec §6.2); each claim cites the calls behind its findings. Plans saved before findings still use the tool loop and the grounding check.
- **When the agent cannot tell, it asks.** A `single` card, worded by the agent: "Do you want a plan for this, or just an answer?" The answer picks the kind and the run continues. The base prompt says to ask rather than draft a full plan nobody asked for.

## Follow ups

Built for Film (`film/agent.ts`, `film/follow-up.ts`, `film/follow-ups.ts`). Once a chat has a plan (`threads.base_output_id`), a message is a follow up on it. The gate still judges whether it is on topic; the Film agent then reads the job, because only the category knows its jobs:

- **Refusals first.** A forecast, pricing advice or a request to send anything gets fixed words from `REFUSALS` in `packages/packs`, before any model or Qloo call (spec §10).
- **Reading.** The follow-up reader (model with quotes checked, or scripted) pulls out places and comps to add or drop, an age group or gender, rival titles with dates, and a partner's name. Code picks the job from those: rivals with dates make a date check, the word partner with a partner job makes a brief, any change makes a what-if, and only otherwise is the model's own job used.
- **Answer.** The tool loop (`runtime.ts`) with the plan and the recent chat as context labelled "context, not evidence". The plan's receipts can be cited by id (`RunState.prior`), new calls make new receipts, and the grounding check covers both. It never stops on a card. With no model key, a scripted planner says what the plan shows, cited, and suggests a what-if.
- **What-if (scenario).** The build pipeline starts from the plan's saved inputs (`outputs.inputs`) with the change applied, finds any new comp (asking which one if a name matches several), reruns the tests and saves a `scenario` output built on the plan, with "What changed" against it. It reruns every test, not only the changed lines: the plan's raw tool results are not saved, only its brief. `TODO`: rerun only what changed (spec §3.5).
- **Rival date check.** The rivals are found by exact name and scored against the comps with `compareAudiences`; the safest week is the one whose riskiest rival shares the least. Saved as a `date` output on the plan. Without dates it asks for them in the chat.
- **Partner brief.** The named partner (or the plan's top brand) is found as a brand or podcast, scored against the baseline with `lift`, and a draft is written by code from the computed fit. Saved as a `partner` output. Oraqul never sends it.

A date check or partner brief does not become the chat's current plan; a scenario does. Not built: corrections that change the category or mode ("check my plan instead", "start fresh").

## Memory (chat and project layers in use)

Product behaviour is [spec §3.7](../product/spec.md): three layers (chat, project, team), memory is context and never evidence, the person confirms what is saved and can see, edit and delete it. Built for Film: a run starts from the project's brief and files (`projects.inputs`), the chat's current plan and its receipts, and the chat's last 8 lines, and emits `memory.used` with those items, which the chat shows as one "Using" line. Not built: `memory_items`, team memory, `remember` cards, long-chat summaries and the continue-or-fresh choice for a new chat.

**Assembling it.** `buildMemory({ team, project, thread })` returns one bounded block per run, in this order: team items, project inputs and items, the current plan (or `from_output_id`) with its receipts by id, the thread's summary and recent messages. The block is labelled "context, not evidence" in the shared base prompt, and a hard character cap per layer drops the oldest items first. A `fresh` thread leaves out the project items and the plan; `team_memory` false leaves out the team items.

**Citing.** A claim may cite only receipts from this run or from an earlier plan's receipts by id. A memory item has no receipt, so the grounding check (`grounding.ts`) rejects a claim that cites one, and the runtime rejects a `finish` that sets a number from memory.

**Saving.** The planner may return a `remember` step with the fact and a suggested scope. The runtime turns it into a `single` card (this project, the whole team, not now) and stops `waiting`, as an ask step does. Only a yes writes a `memory_items` row. The agent never writes memory on its own.

**Seeing it.** The run emits `memory.used` with the item ids, stored on the run row, and the chat shows them as a "Using" line. Editing or deleting an item changes the next run, not past ones.

**Long chats.** When a thread passes a size limit its older messages are summarised into `threads.summary` by a model call that sees only those messages, and the summary replaces them in the block. The summary is context like any memory item.

**Other.** The gate also gets the project's title and the team's market, so "what about Lagos?" reads as on topic. A run still starts with an empty tool history: receipts from an earlier run are cited by id, not re run, unless an input changed.

## Demo mode

`QLOO_MODE=demo` (default) runs everything on hand-written data from `packages/engine/src/qloo/demo-fetch.ts`. Every receipt carries `source: 'demo'`, the trace says so, and the final message says "demo data".

## MCP

`packages/mcp` registers the same tool objects from `packages/engine`. `pnpm --filter @oraqul/mcp build` then `node packages/mcp/dist/stdio.js` (demo data unless `QLOO_MODE=live`). Results are `{ data, receipts }` as JSON text.
