# Qloo

Qloo supplies the taste data. What we compute on top is in [spec §5](../product/spec.md).

## Status: unverified

Endpoint names, parameters, the auth header and the response shape came from the prototype and secondhand notes. **Nothing in `packages/engine/src/qloo` is confirmed.** Each stub is marked `TODO(verify)`. Before building on it:

1. Read Qloo's public docs.
2. Make real calls with our own key and record the responses in `packages/engine/fixtures`.
3. Update the client, remove the `TODO(verify)` markers, and note here what was confirmed.

## Open questions

From [PRD §9](../product/prd.md): coverage of Nigerian titles, artists and authors; Lagos against no location; whether location changes age and gender splits; podcast and game coverage; the quota header (reported near 10,000 calls a month); what may be shown on public share links.

## What exists

- `QlooClient` in `packages/engine/src/qloo/client.ts`. Base URL and key are passed in. One retry, then `QlooError`. Each call returns `{ data, receipt }`.
- `searchEntity` as the first stub.
- `pnpm --filter @oraqul/engine qloo:smoke` runs a live call. It skips cleanly without `QLOO_API_KEY` and `QLOO_BASE_URL`.

## Rules

- Every call produces a receipt ([spec §6](../product/spec.md), table `receipts`).
- Scores from separate calls are not comparable. Rival overlap, city ranking and scenario diffs must come from one call.
- Cache within a run. Respect `QLOO_CALL_BUDGET`.
- Only public entity names, place names and age bands go out.
- No harness, no starter kit, no sidecar. Everything goes through `QlooClient` straight to the hackathon API. Validation, tests and evals are ours, built around that client.

## TODO

Verify endpoints. Implement the remaining tools from [spec §4](../product/spec.md). Record fixtures.
