# Oraqul

A culturally grounded launch agent for media and entertainment: launch plans grounded in what audiences actually like. Every claim about taste, audience or place cites a finding from real Qloo taste data. Start with [docs/README.md](docs/README.md).

## Stack

TypeScript monorepo (pnpm, Turborepo). `apps/web` Next.js, `apps/api` NestJS with Drizzle and Postgres, and `packages/` for `schema`, `engine`, `packs`, `ui`, `mcp`, `eval`. Layout and import rules: [docs/architecture.md](docs/architecture.md).

## Commands

```
pnpm install
docker compose up -d db                 # Postgres on host port 5433
cp .env.example .env
pnpm --filter @oraqul/api db:migrate
pnpm dev                                # web :3000, api :4000
pnpm build | lint | format | typecheck | test
pnpm test:e2e                           # Playwright (PW_CHANNEL=chrome on macOS 13)
```

`pnpm test` (with evals) runs before every commit and `pnpm check` before every push, via `.githooks`. Never skip them with `--no-verify`.

## How we work

Two people ship **one feature at a time, end to end**: schema, API, and the web screen that uses it, in one branch and one PR. A backend change is usually not done until its frontend is wired and follows the design system. A backend-only PR is fine when it says why and names the screen that follows. Details in [docs/git.md](docs/git.md).

The human reviewers compare each screen against the Claude artifact prototype outside this repo. You cannot see it. Build from `docs/frontend/design-system.md`, say plainly which parts you could not check visually, and never claim a screen matches the prototype.

Before every commit, push or PR, and while implementing, flag anything that goes against a hard rule or a doc in `docs/`, or that could break existing behaviour (schemas and exported types, API contracts, migrations, engine and pack outputs, receipts, shared UI components, tests). Say what conflicts, what it touches, and the options. Do not commit, push or open a PR over a flagged conflict until the user has decided. If nothing conflicts, say so in one line.

## Hard rules

1. Scores, verdicts and confidence are computed by code from values Qloo returned. The model never sets a number.
2. Every Qloo call returns `{ data, call }`. Each tool turns its calls into receipts, and code turns results into findings. Every grounded line cites a finding; playbook lines are labelled and cite nothing. Code checks every line ([spec §6.2](docs/product/spec.md)).
3. Do not treat any Qloo endpoint as verified until [docs/backend/qloo.md](docs/backend/qloo.md) says so. If unsure, leave a `TODO(verify)`.
4. No literal colours in components. Use design tokens. Verdicts always show a glyph and a word.
5. Validate untrusted data at the boundary, once. No `any`, no fake validation casts. See [docs/typescript.md](docs/typescript.md).
6. `engine` and `packs` never import from `apps`. `web` never imports `engine`.
7. Only public entity names, place names and age bands go to Qloo. No personal data.
8. Product behaviour lives in `docs/product`. Change code and docs together.
9. Comments say why, never what. JSDoc only where a name and type leave out units, ranges, side effects or a trap. No banners, no commented-out code. See [docs/typescript.md](docs/typescript.md#comments).
10. `apps/web` runs a Next.js version with breaking changes. Read `apps/web/AGENTS.md` and the docs in `node_modules/next/dist/docs/` before using a Next API.

## Doc map

[rules](docs/product/launch-rules.md) · [architecture](docs/architecture.md) · [frontend](docs/frontend/design-system.md) · [categories](docs/categories/film.md) · [agent](docs/backend/agent.md) · [llm](docs/backend/llm.md) · [qloo](docs/backend/qloo.md) · [testing](docs/testing.md) · [git](docs/git.md)

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
