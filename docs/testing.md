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
| Router: quote check, off-topic refusal, option filtering and fallback, question order, picks never quoted, scripted reader, model output parsed (mock model, no network) | `apps/api/src/agent/router/router.spec.ts` | done |
| Runtime: question and resume, consult, budget, grounding, failure | `apps/api/src/agent/runtime.spec.ts`, with the scripted planner and demo data | done |
| API: projects and the router end to end (draft hidden, card, pick, `project.updated`, placeholder reply, event replay), roles, pins cap, overview | `apps/api/test/projects.e2e-spec.ts`, on PGlite with the scripted router | done |
| API: sign in routes, cookie flags, login 429 | `apps/api/test/auth.e2e-spec.ts`, services stubbed | done |
| Teams: role matrix over HTTP, last owner, invite accept | `apps/api/test/teams.e2e-spec.ts` | done |
| Teams SQL: `RolesGuard` matrix, last owner rule, invites, personal team | `apps/api/src/auth/roles.guard.spec.ts`, `apps/api/src/teams/*.spec.ts`, `users.service.spec.ts` | done |
| Auth SQL: codes, login limit, account linking | `apps/api/src/auth/*.service.spec.ts`, on PGlite via `apps/api/test/test-database.ts` | done |
| MCP: list and call tools | `packages/mcp/src/server.test.ts`, in memory transport | done |
| Contract: Qloo tools | `packages/engine`, parsing recorded responses in `packages/engine/fixtures`. Written with the first tools | not started |
| Live smoke | `pnpm --filter @oraqul/engine qloo:smoke`. Skips without a key. Records the fixtures and answers the open questions in [backend/qloo.md](backend/qloo.md) | written, not yet run with a key |
| Golden runs: build, audit, fix per category, on the plan pipeline (Film audit and fix, before and after launch: `packages/eval/golden/film-audit/`, run by `golden-audit.spec.ts`; they pin the verdict of each item, which items have a fix, each city's gap against the plan, the kinds of output saved, and the rules: nothing is advised to drop, no call id in a line, every grounded line cites a finding) | Inputs and expected results in `packages/eval/golden/<category>/`, run by `apps/api/src/agent/film/golden.spec.ts` (the pipeline is in `apps/api`, which a package may not import). Film pins the findings (query and top three names), the team's city order, the comps and their source, line kinds per section, drops and verdicts; the wording is checked by rules (the bottom line names only the team's cities, no receipt or call id in a line, every grounded line cites a real finding), not compared | Film build: 3 runs on demo data (Music: 4, in `packages/eval/golden/music/`, run by `apps/api/src/agent/music/golden.spec.ts`; Games: 6, in `packages/eval/golden/games/`, run by `apps/api/src/agent/games/golden.spec.ts`; Podcasts: 6, in `packages/eval/golden/podcasts/`, run by `apps/api/src/agent/podcasts/golden.spec.ts`; Books: 7, in `packages/eval/golden/books/`, run by `apps/api/src/agent/books/golden.spec.ts`; all with release dates far ahead, or only a month and a year, so the calendar and a comp's age do not change with the day), every commit, with the scripted reader, default queries and the template writer. A live case is replayed from a local recording (`*.live.json`, gitignored until Qloo allows committing them); `RECORD_LIVE=1` with a key records it, `UPDATE_GOLDEN=1` re-records the demo expectations |
| Grounding check | `ungroundedLines` in `apps/api/src/agent/grounding.ts`: every tested brief line has a receipt, and every title, brand, podcast, city or rival it names is in what Qloo returned. Run in every golden run | done |
| Grounding report | `groundingReport` in `apps/api/src/agent/launch/grounding-report.ts`: of a plan's lines, how many cite a Qloo finding, how many cite a web page, how many are launch practice, how many findings were used, how many lines the check removed, the grounded lines per city the team chose, and **rank kept** (of the name pairs a line takes from one Qloo list, the share written in Qloo's order). Pinned in the golden runs, so a plan that starts citing less fails; also the number to compare plans and models by | done for Film |
| Line check | `checkLine` in `apps/api/src/agent/launch/check.ts` (spec §6.2), unit tested in `check.spec.ts`: citations, names, numbers, taste words, the team's cities and age band in the bottom line. Run on every written line before a plan saves | done for Film |
| Refusal tests: forecast, pricing, send, and off topic through the gate | `packages/packs/src/packs.test.ts` (forecast, pricing, send patterns), `apps/api/src/agent/gate/gate.spec.ts` (off topic) | done |
| UI pass: every tab, every category | `apps/web/e2e` | smoke, sign in pages, redirects from the old project routes, and error states for `/overview`, `/projects`, a project, a chat, `/team`, `/invite/[token]`; signed out checks for `/s/[token]` and `/projects`. Signed in demo screens are walked by hand until e2e has a test session |

The Playwright run reuses a dev server already on :3000. Stop your own `pnpm dev` first, or the error state tests find a live API and fail.

## UI checks every page must pass

No "undefined" or "NaN" in the text, no horizontal scroll at 400px, correct in light and dark. `apps/web/e2e/smoke.spec.ts` shows the pattern.

## Rules

- Evals are the proof the product works. The golden cases and their expected results live in `packages/eval/golden`; the specs that run them, the grounding check and the refusal tests live next to the code they test in `apps/api` and run as part of `pnpm test`, on committed demo data, so they need no Qloo key.
- `pnpm test` runs before every commit and `pnpm check` (lint, typecheck, test) before every push, through the hooks in `.githooks`. `pnpm install` turns them on (`prepare` sets `core.hooksPath`). A commit or push that fails them does not go through. `--no-verify` is for an emergency only, and the PR says why.

- `route-guards.spec.ts` walks every controller route: a route that names a team, project, thread or output must check the caller's role in that team, and a route open to someone with no session must be on a short list. The database has no row-level security (the guard decides who may read a row), so this is what fails when a route forgets its guard. A new controller has to be added to the spec.
- A live eval runs the Film cases over live Qloo and saves nothing: `LIVE_EVAL=1 pnpm --filter @oraqul/api exec vitest run src/agent/film/golden.spec.ts -t "live eval"` (about 55 calls a case). It judges what code decides: every grounded line cites a finding, each of the team's cities is backed, the run stays in the call budget. Recordings (`RECORD_LIVE=1`) stay local until Qloo confirms they may be committed.
- Weekly, read 30 to 100 real plans: `pnpm --filter @oraqul/api error-sample -- --limit=50 --list` lists what each could not test and counts the items across them. Note the first failure in each plan, group them, and let the counts decide which check or golden run to add next.
- `pnpm --filter @oraqul/api cost-report` shows, per category and kind of run, the Qloo calls (average, 90th percentile, most), tokens, seconds and, with `--price-per-million-tokens=<n>`, an estimated dollar cost. Tokens are one number per run, so the dollars are a rough guide.
- Scoring and verdict thresholds are tested at the boundary on both sides (74 vs 75).
- Tests use recorded fixtures, never live Qloo, except the smoke script.
- A bug fix starts with a failing test.
