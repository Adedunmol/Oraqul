# Agent runtime

Oraqul's agents (not the coding agents that work on this repo, see `AGENTS.md`). Design is in [spec §3 to §5](../product/spec.md). This file is the working checklist. Code goes in `apps/api/src/agent` (runtime) and `packages/packs` (per category).

## Shape

One router, one runtime loop, five category packs. A new category is a new pack, not new runtime code.

Loop: plan the steps, call tools, record each call as a receipt, test each assumption, search for better options, red team, package.

## A category pack

Defined by `CategoryPack` in `packages/packs/src/types.ts`. Fill these per category (film, music, books, podcasts, games):

- [ ] System prompt
- [ ] Assumption checklist
- [ ] Plan sections
- [ ] Tool allowlist
- [ ] Coverage lists (tests, thin, not supported)
- [ ] Scenarios (matcher and apply function)
- [ ] Results format
- [ ] Output schema

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

In the tool loop the planner only chooses the next step. The runtime runs it, so receipts, limits, questions and consults stay in code:

- **Tool step.** Checked against the pack's allowlist. The tool runs, its receipt is stored and streamed as a `receipt` event, and the planner sees the data and the receipt id. A `QlooError` becomes a receipt with confidence `lower` and a "could not test" history item. A spent budget ends the run with `budget` and a message listing the calls made.
- **Ask step.** The question is stored as pending, a `question` event goes out, and the run stops with `waiting`. The answer must name that question id and option ids on the card.
- **Consult step.** Only if the pack lists the target. A nested loop for the target pack runs with a 4 step cap and no questions, shares the run's receipts, and shows in the trace as `books→film`. Its claims come back to the caller, which can cite them.
- **Finish step.** Every receipt id in every claim must exist in the run. One retry, then the run stops with `error`. This is a first cut of the output validator: it does not yet check entity names or numbers in the text.
- **Limits.** `AGENT_MAX_STEPS` per agent, `QLOO_CALL_BUDGET` per thread.

## Demo mode

`QLOO_MODE=demo` (default) runs everything on hand-written data from `packages/engine/src/qloo/demo-fetch.ts`. Every receipt carries `source: 'demo'`, the trace says so, and the final message says "demo data". The `source` column is not on the `receipts` table yet; add it with persistence.

## MCP

`packages/mcp` registers the same tool objects from `packages/engine`. `pnpm --filter @oraqul/mcp build` then `node packages/mcp/dist/stdio.js` (demo data unless `QLOO_MODE=live`). Results are `{ data, receipt }` as JSON text.

## TODO

The real category agents on the tool loop, starting with Film, then Books, Music, Podcasts, Games; they replace the placeholders in `category-agents.ts`. Saving outputs and receipts (the `source` column on `receipts` comes with them). Typed corrections ("check my plan instead", "start fresh"). Red team step. Remaining spec §4 tools, scenarios, results format, output schema.
