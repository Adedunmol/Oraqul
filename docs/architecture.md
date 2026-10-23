# Architecture

Behaviour is specified in [product/spec.md](product/spec.md). This file covers how the repo is laid out and how the pieces connect.

## Running system

```
Next.js (Vercel)  ->  NestJS API (VPS)  ->  agent runtime (module in the API)
                           |                       |
                        Postgres              Qloo API (QLOO_BASE_URL) + model provider
```

- The web app talks only to the API. Runs stream to it over server sent events (event types in `packages/schema`, listed in [spec §8](product/spec.md)).
- The agent runtime is a module inside the API process, not a separate service.
- Qloo is reached through the client in `packages/engine`, called from the API. There is no separate Qloo service. See [qloo.md](backend/qloo.md).

## Repo layout

| Path | Role | May import |
|---|---|---|
| `apps/web` | Next.js front end | `schema`, `ui` |
| `apps/api` | NestJS API and agent runtime | `schema`, `engine`, `packs` |
| `packages/schema` | Zod schemas and shared types | `zod` only |
| `packages/engine` | Qloo client, tools, receipts, scoring | `schema` |
| `packages/packs` | One config per category | `schema` |
| `packages/ui` | Design system components | `schema` |
| `packages/mcp` | MCP server over the engine tools | `engine`, `schema` |
| `packages/eval` | The golden cases and their expected results (the specs that run them are in `apps/api`) | `engine`, `packs`, `schema` |

Rules:

- `engine` and `packs` never import from `apps`.
- `schema` has no workspace dependencies.
- `web` never imports `engine`. It gets types from `schema` and data from the API.
- A new category is a new folder in `packs`, not new runtime code.

## Sessions and domains

Web and API run on subdomains of one parent domain, for example `app.<domain>` and `api.<domain>`. The API sets the session cookie with `Domain=.<domain>; HttpOnly; Secure; SameSite=Lax`, so the browser sends it to both. Server components read it with `cookies()` and forward it to the API. Client calls use `credentials: 'include'`.

- The API allows CORS only for the exact web origin, with credentials. No wildcard.
- Locally, `localhost:3000` and `localhost:4000` are the same site, so no extra setup.
- A web origin on another registrable domain (a `*.vercel.app` preview) does not receive the cookie. Sign in needs that cookie, so a preview needs its own API deployment on the same site.
- Not proxied through Next `rewrites`: SSE through Vercel's proxy has duration limits.

## Build and tooling

- pnpm workspaces and Turborepo. `turbo` builds packages before apps (`dependsOn: ["^build"]`).
- Internal packages build with `tsup` to ESM and CJS with `.d.ts`, so Next and Nest both consume the built output. Run `pnpm dev` and package watchers rebuild on change.
- One root `.env`, loaded by the API (`ConfigModule`) and by `apps/web/next.config.ts`. Keys are listed in `.env.example`.
- Postgres runs in Docker on host port **5433** (5432 is often taken). `docker compose up -d db`.

## Deployment

Vercel for web. Docker Compose on a VPS for API and Postgres. Nightly Postgres backups. Details in [spec §12](product/spec.md).
