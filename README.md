# Oraqul

A verifiable AI agent that builds, checks and repairs launch strategy in media and entertainment. Plan a launch, audit a plan, or rescue one that missed, across film, music, books, podcasts and games. Each audience assumption is tested against Qloo taste data and carries a receipt.

Product background: [docs/product/overview.md](docs/product/overview.md).

## Run it locally

Needs Node 22, pnpm 10 and Docker.

```bash
pnpm install
cp .env.example .env
docker compose up -d db
pnpm --filter @oraqul/api db:migrate
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:4000/health

Qloo and OpenAI keys are optional until the agent work starts. See `.env.example`.

## Repo

| Path | What |
|---|---|
| `apps/web` | Next.js front end |
| `apps/api` | NestJS API and agent runtime |
| `packages/schema` | Shared Zod schemas and types |
| `packages/engine` | Qloo client, receipts, scoring |
| `packages/packs` | One config per category |
| `packages/ui` | Design system components |
| `packages/mcp`, `packages/eval` | MCP server and evals (placeholders) |
| `docs` | Product docs and engineering guides, start at [docs/README.md](docs/README.md) |

## Licence

MIT, see [LICENSE](LICENSE).
