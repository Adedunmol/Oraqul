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

The type holds the first five fields today. Add the rest as the runtime needs them.

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

## TODO

Router input and output contract, loop implementation, how steps map to `trace.step` events, MCP exposure ([`packages/mcp`](../../packages/mcp/README.md)).
