# Oraqul docs

Product docs say **what** and **why**. The rest say **how we build it**. Each fact lives in one file; others link to it.

## Read first

1. [product/overview.md](product/overview.md) – what Oraqul is, in plain words
2. [product/prd.md](product/prd.md) – requirements and priorities (P0, P1, P2)
3. [product/spec.md](product/spec.md) – technical spec: agents, tools, scoring, data model, API
4. [product/launch-rules.md](product/launch-rules.md) – the versioned launch rules per category, the budget bands, the partner tiers and the direction calls
5. [architecture.md](architecture.md) – how the repo and the running system fit together, with the backend and frontend conventions

Principles every category agent follows: [product/principles.md](product/principles.md). Partnerships in every category: [product/partnerships.md](product/partnerships.md). The social content calendar: [product/content-calendar.md](product/content-calendar.md).

## Categories

One file per category: what a good plan settles, what grounded means there, its launch rules and limits, and what is its own in code. Film is the model the others follow.

[Film](categories/film.md) · [Music](categories/music.md) · [Books](categories/books.md) · [Podcasts](categories/podcasts.md) · [Games](categories/games.md) · [Live shows](categories/shows.md)

## Pick by task

| Working on | Read |
|---|---|
| Any TypeScript | [typescript.md](typescript.md) |
| `apps/web`, `packages/ui` | [architecture.md](architecture.md#frontend), [frontend/design-system.md](frontend/design-system.md), [frontend/components.md](frontend/components.md), [frontend/data.md](frontend/data.md) |
| `apps/api` | [architecture.md](architecture.md#backend) |
| Agent runtime, `packages/packs` | [backend/agent.md](backend/agent.md) |
| How a plan is built, audited, fixed and followed up | [backend/launch-runtime.md](backend/launch-runtime.md) |
| Prompts, model calls | [backend/llm.md](backend/llm.md) |
| Qloo calls, `packages/engine` | [backend/qloo.md](backend/qloo.md) |
| Tests, evals | [testing.md](testing.md) |
| Commits, branches, PRs, how we ship features | [git.md](git.md) |

## Maintaining these docs

- Product docs are the source of truth for behaviour. If code and spec disagree, fix one of them in the same change.
- Thresholds and formulas (lift, fit, overlap) live in [spec §5](product/spec.md). Code comments point there instead of repeating the numbers.
- Docs describe the product as it is. No dates, run logs or roadmaps.
- A short file with TODOs is fine. A long file that repeats another one is not.
