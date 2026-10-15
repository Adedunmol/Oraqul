# Oraqul docs

Product docs say **what** and **why**. The rest say **how we build it**. Each fact lives in one file; others link to it.

## Read first

1. [product/overview.md](product/overview.md) – what Oraqul is, in plain words
2. [product/prd.md](product/prd.md) – requirements and priorities (P0, P1, P2)
3. [product/spec.md](product/spec.md) – technical spec: agents, tools, scoring, data model, API
4. [architecture.md](architecture.md) – how the repo and the running system fit together

Ideas agreed but not yet in the PRD: [product/backlog.md](product/backlog.md).

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

## Maintaining these docs

- Product docs are the source of truth for behaviour. If code and spec disagree, fix one of them in the same change.
- Thresholds and formulas (lift, fit, overlap) live in [spec §5](product/spec.md). Code comments point there instead of repeating the numbers.
- A short file with TODOs is fine. A long file that repeats another one is not.
