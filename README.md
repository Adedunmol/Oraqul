# Oraqul

Built for the **Qloo Hackathon 2026**.

A culturally grounded launch agent for media and entertainment: launch plans grounded in what audiences actually like. Plan a launch, audit a plan, or fix one, before or after launch, across film, music, books, podcasts, games and live shows. Every claim about taste, audience or place cites a finding from Qloo taste data.

**Live app:** https://oraqul.site

**Code:** https://github.com/Adedunmol/Oraqul

<!-- Before submitting: add the demo video link and one screenshot here. -->

## The problem

Launch plans rest on audience assumptions nobody writes down, borrowed from a few comparable titles and instinct. When a launch underperforms, the team can see what happened but not which assumption was wrong. Oraqul makes each assumption explicit and tests it against Qloo: a plan says which lines are measured, which are sourced from the web and which are launch craft, and every measured line opens the Qloo call behind it.

It is for the teams that launch cultural products: distributors and studios, labels and managers, publishers, podcast networks, game publishers, and live show promoters. More in [docs/product/overview.md](docs/product/overview.md).

## What it changes

A launch team today pieces its audience plan together from a few comparable titles, a dashboard that answers one question at a time, a chat answer nobody can check, and instinct. Oraqul replaces that with one working loop:

- **Plan right for the right audience.** One brief becomes a plan per market, worked back from the release date, with the audience, the cities, the partners and the creative briefs. The audience is measured in Qloo for each place the team names, and the team's own cities are never dropped.
- **Catch the wrong assumption before the money is spent.** Bring an existing plan and every audience assumption in it comes back as holds, weak, breaks or could not test, with the sentence that states it and a stronger option where one breaks.
- **Save the research hours.** The lookups, the comparison across cities, the calendar, the sponsor and funding leads and the first drafts of the creative and pitches are done in one run instead of across tools. We have not measured the time saved and do not claim a figure.
- **Learn from the launch, not just report on it.** Enter results and Oraqul says which assumption missed and writes a revised plan beside the old one. A launch watch flags rivals landing near the date and dates that slip, and a rescue names where to put the next seven days.
- **Trust what it says.** Every claim about taste, audience or place opens the Qloo call behind it. Claims that are launch craft are labelled and cite nothing, and a claim code cannot support is dropped before the plan is shown.

## How it is different

| | Chatbot | Generic AI planner or wrapper | Audience dashboard | Oraqul |
|---|---|---|---|---|
| Who the audience is and where | From memory | From memory, or a search result summarised | Measured, one query at a time | Measured in Qloo for every place the team names, ranked in one list |
| Scores, verdicts, confidence | Written by the model | Written by the model | Shown as figures | Computed by code, tested at each threshold; the model never sets a number |
| Can you check a claim | No | Sometimes a link | Yes, in the tool | Every grounded line opens its Qloo call; code drops a line that cites nothing |
| Your own plan | Agrees with it | Rewrites it | Not its job | Tests each assumption and reports holds, weak, breaks or could not test |
| Market facts (rivals, windows) | Stale or invented | Varies | Not covered | Searched, dated and linked to the page; a fact the page does not hold is dropped |
| After launch | Starts again | Starts again | Reports what happened | Compares results with the plan, revises it, watches the date, names a rescue |
| Partners and funding | Lists well known brands | Lists well known brands | Not covered | Only brands Qloo ranks for that audience; funds with source, day read and eligibility worked out in code |
| Same brief twice | Differs | Differs | Same | Same questions, same findings, tested by golden runs per category |

Where the others are better: a chatbot is faster and more fluent, and a dashboard has depth in the one thing it measures. Oraqul has to win on measured, checked specifics and still read as a plan a team can use. [Principles](docs/product/principles.md#against-a-normal-chatbot) has the full comparison.

## Why it needs Qloo

A chat model can write a launch plan, but it cannot know where an audience lives, what else they love or which brands they trust, so it guesses. Oraqul asks Qloo about the launch's comparable titles, places and age band, computes every score from what comes back, and lets the model only write it up. Remove Qloo and there are no cities to rank, no audience to describe and no partners to offer.

## What is and is not autonomous

Plans, reports and fixes run a fixed, tested pipeline, so the same input runs the same checks. Inside it the agent plans its own extra Qloo and web lookups when the evidence is thin, critiques its draft against the brief and rewrites it (up to three drafts), and watches a saved plan on a schedule. In a project chat the model chooses its next tool call. Nothing leaves Oraqul without a person's approval.

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

## After the plan

Oraqul keeps working once the plan is written. A **launch watch** re-checks a saved plan on a schedule (a rival release near its date, a campaign date that slipped, a plan that has grown old) and emails the team; the team can enter its own figures and Oraqul says whether the launch is ahead of, on or behind the plan's pace, and a **rescue** names where to put the next seven days. The plan's dates can go into a calendar app. A watch never changes the plan and never asks Qloo by itself, and anything that leaves Oraqul goes out only after a person approves it. A full plan can be given sponsors and open funds, each with its source and the day it was read, and a pipeline for each; the person sends the pitch from their own email or WhatsApp. A team's owners set defaults once (a budget ceiling, banned partners, channels, who approves) and every plan follows them. Other agents can plan through Oraqul over a hosted MCP server with a personal token (see `/developers`). The API shares one monthly Qloo budget and a per person run cap across every run (`QLOO_MONTHLY_BUDGET`, `RUN_CAP_PER_USER_MONTH`). See [spec §5.17 to §5.19](docs/product/spec.md).

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
