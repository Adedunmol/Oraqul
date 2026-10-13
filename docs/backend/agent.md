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

The type holds the system prompt, assumption checklist, plan sections, tool allowlist, `consults` (other categories this agent may ask, only Books asks Film) and coverage lists. Add the rest as the runtime needs them. Every pack is filled with basics only; each category gets its deep pass later. `demoProjects` in `packages/packs/src/demo.ts` is one demo project per category.

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

## How a run works (built, with demo data)

```
POST /projects/:id/threads {mode}  ->  router  ->  category agent  ->  tools  ->  finish
                                          |             |   ^
                                    confirm card     ask card (match, ...)  <-  POST /threads/:id/messages
                                                        |
                                                  consult (Books -> Film)
```

Code is in `apps/api/src/agent`:

| File | Role |
|---|---|
| `router.ts` | Spec §3.1. Category from the project, job from the start card, then a `confirm` question ("I read this as ... Is that right?", spec §9.2). No tools, no model. A model router comes with the category passes |
| `runtime.ts` | `advance(state, deps, answer?)`: the one loop. Runs until the agent finishes, asks, or hits a limit, then emits `run.stopped`. The answer resumes it |
| `types.ts` | `Step` (`tool`, `ask`, `consult`, `finish`), `HistoryItem`, `Planner` |
| `scripted-planner.ts` | Deterministic planner, used when `OPENAI_API_KEY` is empty |
| `openai-planner.ts` | Model planner, see [llm.md](llm.md) |
| `grounding.ts` | Rejects a finish whose claims cite receipts the run did not make |
| `thread-store.ts` | In-memory threads and event log. Postgres comes with accounts |
| `agent.service.ts`, `agent.controller.ts` | Per-thread Qloo client, routes: `GET /demo/projects`, `POST /projects/:id/threads`, `GET /threads/:id`, `POST /threads/:id/messages`, `GET /threads/:id/events` (SSE) |

The planner only chooses the next step. The runtime runs it, so receipts, limits, questions and consults stay in code:

- **Tool step.** Checked against the pack's allowlist. The tool runs, its receipt is stored and streamed as a `receipt` event, and the planner sees the data and the receipt id. A `QlooError` becomes a receipt with confidence `lower` and a "could not test" history item. A spent budget ends the run with `budget` and a message listing the calls made.
- **Ask step.** The question is stored as pending, a `question` event goes out, and the run stops with `waiting`. `POST /threads/:id/messages` must answer that question id with option ids on the card, or the API returns 400.
- **Consult step.** Only if the pack lists the target. A nested loop for the target pack runs with a 4 step cap and no questions, shares the run's receipts, and shows in the trace as `books→film`. Its claims come back to the caller, which can cite them.
- **Finish step.** Every receipt id in every claim must exist in the run. One retry, then the run stops with `error`. This is a first cut of the output validator: it does not yet check entity names or numbers in the text.
- **Limits.** `AGENT_MAX_STEPS` per agent, `QLOO_CALL_BUDGET` per thread.

A run has two stages: routing, then the agent loop. Trace steps map one to one to `trace.step` events with the agent name and `step` of `of`.

## Demo mode

`QLOO_MODE=demo` (default) runs everything on hand-written data from `packages/engine/src/qloo/demo-fetch.ts`. Every receipt carries `source: 'demo'`, the trace says so, and the final message says "demo data". The `source` column is not on the `receipts` table yet; add it with persistence.

## MCP

`packages/mcp` registers the same tool objects from `packages/engine`. `pnpm --filter @oraqul/mcp build` then `node packages/mcp/dist/stdio.js` (demo data unless `QLOO_MODE=live`). Results are `{ data, receipt }` as JSON text.

## TODO

Persist threads, runs, messages and receipts to Postgres (`runs.steps` is the trace). Guard the routes with sessions. A model router for unclear category or job. Red team step. Remaining spec §4 tools, scenarios, results format, output schema. `POST /threads/:id/messages` holds the request open while the agent runs; move to a background run if model calls get slow. Per-category deep passes: Film first, then Books, Music, Podcasts, Games.
