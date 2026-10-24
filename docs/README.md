# Oraqul docs

Product docs say **what** and **why**. The rest say **how we build it**. Each fact lives in one file; others link to it.

## Read first

1. [product/overview.md](product/overview.md) – what Oraqul is, in plain words
2. [product/prd.md](product/prd.md) – requirements and priorities (P0, P1, P2)
3. [product/spec.md](product/spec.md) – technical spec: agents, tools, scoring, data model, API
4. [product/launch-rules.md](product/launch-rules.md) – the versioned launch rules per category, the budget bands, the partner tiers and the direction calls
5. [architecture.md](architecture.md) – how the repo and the running system fit together


Principles every category agent follows: [product/principles.md](product/principles.md). What makes a good Film plan, and how we judge one: [product/film-agent.md](product/film-agent.md). The same for Music: [product/music-agent.md](product/music-agent.md), for Games: [product/games-agent.md](product/games-agent.md), for Podcasts: [product/podcasts-agent.md](product/podcasts-agent.md), for Books: [product/books-agent.md](product/books-agent.md), and for Live shows: [product/shows-agent.md](product/shows-agent.md). Partnerships in every category: [product/partnerships.md](product/partnerships.md). The social content calendar: [product/content-calendar.md](product/content-calendar.md).

## Pick by task

| Working on | Read |
|---|---|
| Any TypeScript | [typescript.md](typescript.md) |
| `apps/web`, `packages/ui` | [frontend/README.md](frontend/README.md), [frontend/design-system.md](frontend/design-system.md), [frontend/components.md](frontend/components.md) |
| `apps/api` | [backend/README.md](backend/README.md) |
| Agent runtime, `packages/packs` | [backend/agent.md](backend/agent.md) |
| Prompts, model calls | [backend/llm.md](backend/llm.md) |
| Qloo calls, `packages/engine` | [backend/qloo.md](backend/qloo.md) |
| Tests, evals | [testing.md](testing.md) |
| Commits, branches, PRs, how we ship features | [git.md](git.md) |
| How the Film agent works end to end, and what it still lacks | [end-to-end-flow/film-agent.md](end-to-end-flow/film-agent.md) |
| The same for Music, and how its code differs from Film's | [end-to-end-flow/music-agent.md](end-to-end-flow/music-agent.md), [backend/music-overview.md](backend/music-overview.md) |
| The same for Games: launch kinds, the fan base bridge, and how its code differs | [end-to-end-flow/games-agent.md](end-to-end-flow/games-agent.md), [backend/games-overview.md](backend/games-overview.md) |
| The same for Live shows: the on-sale rules, rival dates and the audit's rule checks | [end-to-end-flow/shows-agent.md](end-to-end-flow/shows-agent.md), [backend/shows-overview.md](backend/shows-overview.md) |
| The same for Podcasts: launch kind and format, the topic map, and how its code differs | [end-to-end-flow/podcasts-agent.md](end-to-end-flow/podcasts-agent.md), [backend/podcasts-overview.md](backend/podcasts-overview.md) |
| The same for Books: launch kind, route and readership, the comp shelf, the adaptation bridge, and how its code differs | [end-to-end-flow/books-agent.md](end-to-end-flow/books-agent.md), [backend/books-overview.md](backend/books-overview.md) |

## Maintaining these docs

- Product docs are the source of truth for behaviour. If code and spec disagree, fix one of them in the same change.
- Thresholds and formulas (lift, fit, overlap) live in [spec §5](product/spec.md). Code comments point there instead of repeating the numbers.
- A short file with TODOs is fine. A long file that repeats another one is not.
