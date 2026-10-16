# Agent runtime

Oraqul's agents (not the coding agents that work on this repo, see `AGENTS.md`). Design is in [spec §3 to §5](../product/spec.md). This file is the working checklist. Code goes in `apps/api/src/agent` (runtime) and `packages/packs` (per category).

## Shape

One router, one front door (gate), one runtime with two paths, five category packs. A new category is a new pack, not new runtime code.

- **Plan pipeline (planned)** for build, audit, rescue, scenario, date and partner. Fixed steps in code, so a plan is repeatable. See [Plan pipeline](#plan-pipeline-planned).
- **Tool loop** (`runtime.ts`, built) for answers, clarifying questions and consults. The planner picks the next step; code runs it.

Decided 2026-10-16: plans must not run on the tool loop. A model choosing which tests a plan runs gives different tests for the same input, which breaks the promise that a plan was checked and makes golden runs meaningless.

## A category pack

Defined by `CategoryPack` in `packages/packs/src/types.ts`. Fill these per category (film, music, books, podcasts, games):

- [ ] System prompt
- [ ] Assumption checklist
- [ ] Assumption tests: for each kind of assumption, the tool calls that test it and the rule that turns their results into a verdict (used by the plan pipeline)
- [ ] Plan sections
- [ ] Tool allowlist
- [ ] Coverage lists (tests, thin, not supported)
- [ ] Scenarios (matcher and apply function)
- [ ] Results format
- [ ] Output schema

**Shared base prompt (planned).** The rules every agent follows live once in `packages/packs` as a preamble: cite a receipt for every claim, never set a number, a score or a verdict, say when a tool could not test something, refuse forecasts, pricing advice and sending (drafts only). A pack's `systemPrompt` adds only what is its own (how to read its inputs, its tone). Today Film repeats the shared rules inline; each pack is moved onto the preamble when the factory is built.

**Pack contract test (planned).** One test over all five packs: every required field is filled, every `toolAllowlist` entry is a tool in `packages/engine`, and `consults` only lists categories the spec allows (spec §3.4). A half filled pack fails the build.

The type holds the system prompt, assumption checklist, plan sections, tool allowlist, `consults` (other categories this agent may ask, only Books asks Film) and coverage lists. Add the rest as the runtime needs them. Every pack is filled with basics only; each category gets its deep pass later. `demoProjects` in `packages/packs/src/demo.ts` is one stand-in project per category that the runtime and evals use until projects live in Postgres. It is not served to anyone: there is no demo access without an account.

## Tools

Every tool returns `{ data, receipt }` (`ToolResult` in `packages/engine`). The model sees `data` and a receipt id. Tool list: [spec §4](../product/spec.md). Every Qloo call goes through `packages/engine`, which returns `{ data, call }`. The tool turns the call into a receipt with `toReceipt`, adding the rule and a confidence it computed from [spec §5](../product/spec.md).

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
| `category-agents.ts` | `CategoryAgent` per category. All five are placeholders today: one trace step and a message saying the agent is not connected yet, with no claims and no Qloo calls |
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
- **Limits.** `AGENT_MAX_STEPS` per agent, `QLOO_CALL_BUDGET` per run: `ToolContext` makes one `QlooClient` per run and the budget is that client's. Open decision: also cap a thread, which would need a count across its runs. Until decided, treat per run as the rule.

## Plan pipeline (planned)

Product behaviour is [spec §3.2](../product/spec.md). Every plan job runs the same steps, in this order, and only two of them call a model:

| Step | Who | What |
|---|---|---|
| 1. Read | Model, structured output | The input (message, files, project inputs, memory) into assumptions and anchors (comps, talent, tags, places). Each value carries its quote, checked by code as the router does. Audit reads the person's plan; rescue also reads their results |
| 2. Choose tests | Code | Each assumption is matched to the pack's assumption tests, which say which tools to call with which anchors. An assumption with no test is "could not test" (spec §5), never skipped silently |
| 3. Run tests | Code | Independent tool calls run in parallel through one `QlooClient`, inside the call budget. Each call becomes a receipt. A failed call is retried once, then its line is "could not test" |
| 4. Score | Code (`packages/engine`) | Lift, verdict, fit and confidence from the receipts' values (spec §5) |
| 5. Search | Code, then step 3 again | For what broke or is weak, candidates from the pack (other places, comps, segments) are tested the same way. Stops by the stop rule (spec §3.5) |
| 6. Write | Model | The brief's words, from the computed results only. Claims are structured (`{ text, receiptId, value }`) and numbers are filled in from the receipts, so the model never types a number |
| 7. Check | Code | Grounding check (every claim cites a receipt of this run or of the plan it builds on), then save the output and its receipts |

Each step is a `trace.step`, so the trace shows the same steps for every plan. A clarifying question (an ambiguous Qloo match, a missing anchor) pauses the pipeline as an ask does in the loop, and the answer resumes it at the step that asked. Scenario, date and partner are the same pipeline started from a saved plan, rerunning only the lines whose inputs changed. The red team step, when built, sits between 6 and 7.

Golden runs (testing.md) run this pipeline on recorded Qloo responses and expect the same verdicts every time. Only step 6's wording may differ between runs.

## Agent factory (planned)

Nothing yet builds a `CategoryAgent` from a pack; `category-agents.ts` maps every category to `PlaceholderAgent`. One function, `createCategoryAgent(pack)`, does it for all five: it picks the planner (model planner when `LLM_API_KEY` is set, else scripted), creates the run's `QlooClient` with its call budget, builds the run state, and runs the plan pipeline for a plan job and `advance()` from `runtime.ts` for an answer. A new category then adds a pack and nothing else. The Film agent is the first built on it.

## Handoff (planned)

`Handoff` is `{ category, mode, title }` today, so an agent never sees what the person said. It also carries:

- the project's inputs, kept on the project (`inputs`, spec §6) from the first message and the text of its attachments, so `newRunState` and `AgentContext.project` have what they expect;
- the message that started this run, and for a follow up the thread's recent history (see [Memory](#memory-planned)).

`RunService.post` passes both on for an active project; a message is no longer only saved. The router's `forRouter` text cap (`ATTACHMENT_CHARS`) applies to the agent too, so a long plan does not fill the model's context.

## Replies: a plan and not a plan (planned)

An agent's finish step has two kinds of reply. The product behaviour is in [spec §3.6](../product/spec.md); the runtime needs:

- **A way to say which kind it is.** `AgentReply` in `packages/schema` gets a `kind`: `plan` or `answer`. The model's word for it is not trusted alone: the runtime checks that a `plan` carries the brief and receipts a plan needs, and rejects it otherwise.
- **A plan** (build, audit, rescue, scenario, date, partner) writes an `outputs` row with its receipts and streams `output.created`.
- **An answer** is a `message` event with claims, no `outputs` row. Every claim still cites a receipt run in this run, and the grounding check applies unchanged.
- **When the agent cannot tell, it asks.** A `single` card, worded by the agent: "Do you want a plan for this, or just an answer?" The answer picks the kind and the run continues. The base prompt says to ask rather than draft a full plan nobody asked for.

## Follow ups (planned)

`post()` on an active project runs the project's start mode every time. A follow up gets its own job, decided by code from what the front door read and not by the model alone:

- The front door (`gate/`) already says whether a message is on topic. It grows to also read the job: scenario (typed "what if", or a pack's scenario matcher, spec §9.3), date, partner, a plain question (an answer reply), or a correction ("check my plan instead", "start fresh").
- A correction that changes the category or the mode asks first and then re routes the project, since the project's category and mode are saved on the project.
- A follow up reruns only the lines whose inputs changed (spec §3.5), through `applyScenario` once that tool exists.

## Memory (planned)

Product behaviour is [spec §3.7](../product/spec.md): three layers (chat, project, team), memory is context and never evidence, the person confirms what is saved and can see, edit and delete it. Today `AgentContext.history` lives inside one run and agent runs store no `state`, so the second message in a chat starts blank and a new chat knows nothing of the project or the team.

**Assembling it.** `buildMemory({ team, project, thread })` returns one bounded block per run, in this order: team items, project inputs and items, the current plan (or `from_output_id`) with its receipts by id, the thread's summary and recent messages. The block is labelled "context, not evidence" in the shared base prompt, and a hard character cap per layer drops the oldest items first. A `fresh` thread leaves out the project items and the plan; `team_memory` false leaves out the team items.

**Citing.** A claim may cite only receipts from this run or from an earlier plan's receipts by id. A memory item has no receipt, so the grounding check (`grounding.ts`) rejects a claim that cites one, and the runtime rejects a `finish` that sets a number from memory.

**Saving.** The planner may return a `remember` step with the fact and a suggested scope. The runtime turns it into a `single` card (this project, the whole team, not now) and stops `waiting`, as an ask step does. Only a yes writes a `memory_items` row. The agent never writes memory on its own.

**Seeing it.** The run emits `memory.used` with the item ids, stored on the run row, and the chat shows them as a "Using" line. Editing or deleting an item changes the next run, not past ones.

**Long chats.** When a thread passes a size limit its older messages are summarised into `threads.summary` by a model call that sees only those messages, and the summary replaces them in the block. The summary is context like any memory item.

**Other.** The gate also gets the project's title and the team's market, so "what about Lagos?" reads as on topic. A run still starts with an empty tool history: receipts from an earlier run are cited by id, not re run, unless an input changed.

## Stopping a run (planned)

There is no cancel today, and a restart marks a running run `error` (`onModuleInit` in `run.service.ts`). A cancel route stops the thread's active run, ends it with a new stop reason `cancelled`, and the web shows a Stop button while the agent works. Resume after a restart is not planned: runs live in one process, and the person asks again. Revisit if the API ever runs as more than one process.

## Demo mode

`QLOO_MODE=demo` (default) runs everything on hand-written data from `packages/engine/src/qloo/demo-fetch.ts`. Every receipt carries `source: 'demo'`, the trace says so, and the final message says "demo data". The `source` column is not on the `receipts` table yet; add it with persistence.

## MCP

`packages/mcp` registers the same tool objects from `packages/engine`. `pnpm --filter @oraqul/mcp build` then `node packages/mcp/dist/stdio.js` (demo data unless `QLOO_MODE=live`). Results are `{ data, receipt }` as JSON text.

## Build order

Each item is one feature, end to end (schema, API, web), in its own PR. Items 1 and 2 come before any real agent.

**Blockers before the Film agent (item 3).** These block the core promise, a receipt on every claim, so they are settled first:

- **Receipts are saved per run.** Nothing writes `receipts` today, and the table needs `output_id` and has no `run_id`, so an answer's receipts (no output) would have nowhere to go. Change the table as [spec §6](../product/spec.md) says, in item 1 or 2 with its migration.
- **The confidence rule is written** in [spec §5](../product/spec.md), with thresholds, before any agent sets confidence on a line.
- **The handoff carries the person's content** (item 1). Without it no agent can read what it is planning.
- **Evals gate the second category.** Film's golden runs, the grounding check and the refusal tests ([testing.md](../testing.md)) pass in CI before item 7 starts. Items marked *Planned* below are specified here and not built.

1. **Handoff carries the person's content** (see [Handoff](#handoff-planned)).
2. **Agent factory, shared base prompt and pack contract test** (see [Agent factory](#agent-factory-planned) and [A category pack](#a-category-pack)). Backend only, since no screen changes; it says so in its PR.
3. **Film agent: the plan pipeline for build, the tool loop for answers, and chat memory** (see [Replies](#replies-a-plan-and-not-a-plan-planned) and the chat layer of [Memory](#memory-planned)). Replaces the Film placeholder in `category-agents.ts`. Saves outputs and receipts (the `source` column on `receipts` comes with them). This PR changes output and receipt shapes, so check them against `packages/schema` before it merges, and split it into plan output and not a plan reply if it grows.
4. **Project and team memory**: `memory_items`, the memory lists, the new chat choice (continue or fresh), `remember` cards and the "Using" line (see [Memory](#memory-planned)). Needs item 3.
5. **Follow up jobs and typed corrections** (see [Follow ups](#follow-ups-planned)). Needs item 3.
6. **Stop a run** (see [Stopping a run](#stopping-a-run-planned)).
7. **Books, Music, Podcasts, Games** as packs on the same factory, each with its deep pass.

Also open: red team step, the remaining spec §4 tools, and the pack fields the spec lists that `CategoryPack` does not have yet (scenarios, results format, output schema), added as the agent that needs each is built.
