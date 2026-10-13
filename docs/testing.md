# Testing

What to test and why is in [spec §11](product/spec.md). This file maps it to tools and commands.

## Tools

- **Vitest** for packages and the API.
- **Playwright** for browser checks in `apps/web/e2e`.

## Commands

| Command | Runs |
|---|---|
| `pnpm test` | Unit tests in every package and the API (builds dependencies first) |
| `pnpm --filter @oraqul/api test:e2e` | API e2e with Nest's testing module. Database is stubbed, no Docker needed |
| `pnpm test:e2e` | Playwright against `pnpm dev` |
| `PW_CHANNEL=chrome pnpm test:e2e` | Same, using installed Chrome. Needed on macOS 13, where Playwright has no bundled Chromium |

## Where tests live

| Kind | Location | Status |
|---|---|---|
| Unit: scoring, verdicts, diffs | next to the code, `*.test.ts` (packages) or `*.spec.ts` (API) | scoring done |
| Contract: Qloo tools | `packages/engine`, using recorded responses in `packages/engine/fixtures` | not started |
| Live smoke | `pnpm --filter @oraqul/engine qloo:smoke`. Skips without a key | stub |
| Golden runs: plan, audit, rescue per category | `packages/eval/golden/<category>/` | not started |
| Grounding check | `packages/eval`. Every entity and number must trace to a receipt. Fails the build | not started |
| Refusal tests: forecast, pricing, send | `packages/eval` | not started |
| UI pass: every tab, every category | `apps/web/e2e` | smoke only |

## UI checks every page must pass

No "undefined" or "NaN" in the text, no horizontal scroll at 400px, correct in light and dark. `apps/web/e2e/smoke.spec.ts` shows the pattern.

## Rules

- Scoring and verdict thresholds are tested at the boundary on both sides (74 vs 75).
- Tests use recorded fixtures, never live Qloo, except the smoke script.
- A bug fix starts with a failing test.
