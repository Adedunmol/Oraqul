# Testing

What to test and why is in [spec §11](product/spec.md). This file maps it to tools and commands.

## Tools

- **Vitest** for packages and the API.
- **Playwright** for browser checks in `apps/web/e2e`.

## Commands

| Command | Runs |
|---|---|
| `pnpm test` | Unit tests in every package and the API (builds dependencies first). API specs that touch SQL (codes, login limit, account linking) run against PGlite, a real Postgres in process with the repo's migrations, so no Docker is needed |
| `pnpm --filter @oraqul/api test:e2e` | API e2e with Nest's testing module. Sign in is stubbed, and the team routes run on PGlite with the real guards. No Docker needed |
| `pnpm test:e2e` | Playwright against `pnpm dev` |
| `PW_CHANNEL=chrome pnpm test:e2e` | Same, using installed Chrome. Needed on macOS 13, where Playwright has no bundled Chromium |

## Where tests live

| Kind | Location | Status |
|---|---|---|
| Unit: scoring, verdicts, diffs | next to the code, `*.test.ts` (packages) or `*.spec.ts` (API) | scoring done |
| Unit: tools, with demo data | `packages/engine/src/tools/tools.test.ts` | done |
| Unit: Qloo client and endpoint groups | `packages/engine/src/qloo/*.test.ts`, with a faked `fetch`. Qloo is never called | done |
| Runtime: router, question and resume, consult, budget, grounding, failure | `apps/api/src/agent/runtime.spec.ts`, with the scripted planner and demo data | done |
| API: thread routes, and 401 without a session | `apps/api/test/agent.e2e-spec.ts` | done |
| API: sign in routes, cookie flags, login 429 | `apps/api/test/auth.e2e-spec.ts`, services stubbed | done |
| Teams: role matrix over HTTP, last owner, invite accept | `apps/api/test/teams.e2e-spec.ts` | done |
| Teams SQL: `RolesGuard` matrix, last owner rule, invites, personal team | `apps/api/src/auth/roles.guard.spec.ts`, `apps/api/src/teams/*.spec.ts`, `users.service.spec.ts` | done |
| Auth SQL: codes, login limit, account linking | `apps/api/src/auth/*.service.spec.ts`, on PGlite via `apps/api/test/test-database.ts` | done |
| MCP: list and call tools | `packages/mcp/src/server.test.ts`, in memory transport | done |
| Contract: Qloo tools | `packages/engine`, parsing recorded responses in `packages/engine/fixtures`. Written with the first tools | not started |
| Live smoke | `pnpm --filter @oraqul/engine qloo:smoke`. Skips without a key. Records the fixtures and answers the open questions in [backend/qloo.md](backend/qloo.md) | written, not yet run with a key |
| Golden runs: plan, audit, rescue per category | `packages/eval/golden/<category>/` | not started |
| Grounding check | `packages/eval`. Every entity and number must trace to a receipt. Fails the build | not started |
| Refusal tests: forecast, pricing, send | `packages/eval` | not started |
| UI pass: every tab, every category | `apps/web/e2e` | smoke, sign in and error states for `/projects`, `/team`, `/invite/[token]` |

The Playwright run reuses a dev server already on :3000. Stop your own `pnpm dev` first, or the error state tests find a live API and fail.

## UI checks every page must pass

No "undefined" or "NaN" in the text, no horizontal scroll at 400px, correct in light and dark. `apps/web/e2e/smoke.spec.ts` shows the pattern.

## Rules

- Scoring and verdict thresholds are tested at the boundary on both sides (74 vs 75).
- Tests use recorded fixtures, never live Qloo, except the smoke script.
- A bug fix starts with a failing test.
