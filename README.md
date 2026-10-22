# Oraqul

A culturally grounded launch agent for media and entertainment: launch plans grounded in what audiences actually like. Plan a launch, audit a plan, or fix one, before or after launch, across film, music, books, podcasts and games. Every claim about taste, audience or place cites a finding from Qloo taste data.

Product background: [docs/product/overview.md](docs/product/overview.md).

## Run it locally

Needs Node 22, pnpm 10 and Docker.

```bash
pnpm install
cp .env.example .env        # .env is gitignored, every dev makes their own
pnpm db:up                  # Postgres on host port 5433
pnpm db:migrate
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:4000/health

The Qloo and OpenAI keys in `.env` are optional until you work on the agent. Env vars are validated once at boot in [apps/api/src/config/env.ts](apps/api/src/config/env.ts).

## Commands

Run from the repo root.

| Command | What it does |
|---|---|
| `pnpm dev` | Web on :3000 and API on :4000, packages rebuild on change |
| `pnpm build` | Build every app and package |
| `pnpm check` | Lint, typecheck and unit tests. Run before opening a PR |
| `pnpm lint` / `pnpm format` | Biome check / Biome check and fix |
| `pnpm typecheck` / `pnpm test` | Per-package, cached by Turborepo |
| `pnpm test:e2e` | Playwright (`PW_CHANNEL=chrome` on macOS 13) |
| `pnpm db:up` / `pnpm db:down` | Start / stop the local Postgres |
| `pnpm db:generate` | Create a migration after editing `apps/api/src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Browse the database in Drizzle Studio |
| `pnpm qloo:smoke` | Live Qloo check that also records fixtures, see below |

## Files that are not in git

| Missing file | Why | How to get it |
|---|---|---|
| `.env` | Holds secrets | `cp .env.example .env`, then add your `QLOO_API_KEY` |
| `node_modules`, `dist`, `.next`, `.turbo` | Build output | `pnpm install`, `pnpm build` |
| `packages/engine/fixtures/*/` | Recorded Qloo responses, kept local until Qloo confirms they may be republished | `pnpm qloo:smoke` with a key in `.env` |
| `packages/engine/fixtures/*.local.json` | Your own scratch recordings | Write them by hand, never committed |

### Qloo fixtures

Contract tests parse recorded Qloo responses so they run offline and never spend quota. Each teammate records their own set once:

```bash
# QLOO_API_KEY and QLOO_BASE_URL set in .env
pnpm qloo:smoke
```

It makes about 50 live calls, prints counts and yes/no only, and writes one response per endpoint and category type to `packages/engine/fixtures/`. Without a key it skips and exits cleanly. Re-run it when a Qloo shape changes. More in [packages/engine/fixtures/README.md](packages/engine/fixtures/README.md) and [docs/backend/qloo.md](docs/backend/qloo.md).

## Repo layout

```
apps/
  web/            Next.js front end (App Router, e2e tests in e2e/)
  api/            NestJS API and agent runtime
    src/db/         Drizzle schema, migrations are in drizzle/
    src/config/     Env parsing and validation
    src/auth/       Session and role guards
    src/agent/      Agent runtime (in progress)
packages/
  schema/         Zod schemas and types shared by web, api and engine
  engine/         Qloo client, receipts, scoring. No imports from apps
    src/qloo/       Client, lookup, insights, analysis
    scripts/        Live smoke script
    fixtures/       Recorded responses (local)
  packs/          One config per category: film, music, books, podcasts, games
  ui/             Design system components, tokens only
  mcp/            MCP server over the engine tools (stdio)
  eval/           Golden runs for every category
docs/             Product docs and engineering guides
```

Import rules: `engine` and `packs` never import from `apps`, and `web` never imports `engine`. Full explanation in [docs/architecture.md](docs/architecture.md).

## Docs

Start at [docs/README.md](docs/README.md). Handy ones: [frontend](docs/frontend/README.md), [backend](docs/backend/README.md), [Qloo](docs/backend/qloo.md), [testing](docs/testing.md), [git workflow](docs/git.md).

## Licence

MIT, see [LICENSE](LICENSE).
