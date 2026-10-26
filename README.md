# Oraqul

Built for the **Qloo Hackathon 2026**.

A culturally grounded launch agent for media and entertainment: launch plans grounded in what audiences actually like. Plan a launch, audit a plan, or fix one, before or after launch, across film, music, books, podcasts, games and live shows. Every claim about taste, audience or place cites a finding from Qloo taste data.

<!-- Before submitting: add the live app URL, the demo video link and one screenshot here. -->

## The problem

Launch plans rest on audience assumptions nobody writes down, borrowed from a few comparable titles and instinct. When a launch underperforms, the team can see what happened but not which assumption was wrong. Oraqul makes each assumption explicit and tests it against Qloo: a plan says which lines are measured, which are sourced from the web and which are launch craft, and every measured line opens the Qloo call behind it.

It is for the teams that launch cultural products: distributors and studios, labels and managers, publishers, podcast networks, game publishers, and live show promoters. More in [docs/product/overview.md](docs/product/overview.md).

## How Oraqul uses Qloo

The model reads the brief and shapes the questions. Code asks Qloo, turns each answer into a finding, and computes every score from what Qloo returned. The model writes the plan from the findings, and code checks that every grounded line cites one.

| Qloo endpoint | What Oraqul does with it |
|---|---|
| `/search`, `/entities` | Finds the comps, sound-alikes and partner brands the team names, settles same-name matches by country and popularity, and looks up cities |
| `/v2/tags` | Turns genre and theme words into Qloo tags, so a debut with no comps can still be planned from its genre |
| `/v2/insights` (entities) | The audience's taste across films, series, artists, books, podcasts, games, brands and places, by age band, gender and city; lift for each candidate; rival releases scored against the comps; partner brand fit |
| `/v2/insights` (tags) | The themes and moods the audience shares, for positioning and creative |
| `/v2/insights` (demographics) | Which age bands and genders lean in, for the audience section |
| `/v2/insights` (heatmap) | Ranks the team's cities, and the areas inside them, by where the audience is strongest |
| `/v2/analysis/compare` | Topic ownership: which topics only your audience carries, which it shares with rival shows, and which the rivals own |

Each call returns `{ data, call }`. The call becomes a receipt with what was sent and what came back, and the plan's Evidence tab lists every one. Every endpoint and parameter we rely on was probed live and is recorded in [docs/backend/qloo.md](docs/backend/qloo.md).

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

Without a `QLOO_API_KEY` the API runs in demo mode (`QLOO_MODE=demo`): hand-written stand-in data, labelled as demo on every receipt. Set `QLOO_MODE=live` with a key to plan on real Qloo data. Without an `LLM_API_KEY` (Gemini by default, see `.env.example`) scripted steps and template writers stand in for the model. Env vars are validated once at boot in [apps/api/src/config/env.ts](apps/api/src/config/env.ts), and in production the API refuses to start unless `QLOO_MODE=live`.

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

The smoke script checks every endpoint Oraqul relies on against live Qloo and records one response per endpoint and type, so shape changes show up before they reach a plan. Unit tests use a fake `fetch` and the demo data, so they run offline and never spend quota. Each teammate records their own set once:

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
    src/agent/      Agent runtime: router, one agent per category, the plan pipeline
packages/
  schema/         Zod schemas and types shared by web, api and engine
  engine/         Qloo client, receipts, scoring. No imports from apps
    src/qloo/       Client, lookup, insights, analysis
    scripts/        Live smoke script
    fixtures/       Recorded responses (local)
  packs/          One config per category: film, music, books, podcasts, games, shows
  ui/             Design system components, tokens only
  mcp/            MCP server over the engine tools (stdio)
  eval/           Golden runs for every category
docs/             Product docs and engineering guides
```

Import rules: `engine` and `packs` never import from `apps`, and `web` never imports `engine`. Full explanation in [docs/architecture.md](docs/architecture.md).

## Docs

Start at [docs/README.md](docs/README.md). Handy ones: [architecture](docs/architecture.md), [design system](docs/frontend/design-system.md), [Qloo](docs/backend/qloo.md), [testing](docs/testing.md), [git workflow](docs/git.md).

## Licence

MIT, see [LICENSE](LICENSE).
