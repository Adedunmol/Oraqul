# Backend

NestJS in `apps/api`. Endpoints are listed in [spec §7](../product/spec.md), tables in [spec §6](../product/spec.md), failure behaviour in [spec §10](../product/spec.md).

## Conventions

- ESM. Relative imports end in `.js`.
- One feature module per folder: `auth`, `health`, `db`, `agent`, then `projects`, `threads`, `outputs`, `teams`, `shares`, `uploads` as they are built.
- Controllers parse input and call a service. Services hold logic. Controllers hold no logic.
- Input is validated with Zod at the controller edge. Env is validated once at boot in `src/config/env.ts`. See [typescript.md](../typescript.md).
- Handle errors where you can act on them. Let Nest's exception filters turn the rest into responses.
- Roles are enforced in guards, never in handlers. Viewers are read only.

## Database

Drizzle in `src/db`.

- Schema: `src/db/schema.ts`. It mirrors spec §6. Category, job and role lists come from `@oraqul/schema`. `projects.window` in the spec is `launch_window` in the table, because WINDOW is a reserved SQL word.
- Inject with `@Inject(DB) db: Database` (global `DbModule`).
- Change the schema, then `pnpm --filter @oraqul/api db:generate` and commit the SQL in `apps/api/drizzle`. Apply with `db:migrate`. Never edit an applied migration.
- `db:studio` opens a browser view of the data.
- Local Postgres: `docker compose up -d db` (host port 5433).

## Auth

Hand rolled sessions. A signed `httpOnly` cookie holds a session id. `SessionGuard` looks it up in `sessions` and attaches the user. `RolesGuard` and `@Roles()` exist but deny everything until membership checks are written.

The cookie is set on the shared parent domain and CORS allows only the web origin with credentials, see [architecture.md](../architecture.md#sessions-and-domains). Cookie domain and web origin come from env, validated in `src/config/env.ts`.

Sign in methods (decided): email and password, Google OAuth, and a one-time code sent by email. All three end in the same session cookie. The demo team (PRD A2) needs no signup.

Not built yet. Needs: a password hash on `users` (nullable, since OAuth and code users have none), a table for linked OAuth accounts, a table for one-time codes (hashed, short expiry, single use, attempt limit), and an email sender. Link accounts by verified email.

## Streaming

Runs stream over server sent events at `GET /threads/:id/events`. Event shapes are `threadEventSchema` in `packages/schema`. The web app and the API must both use that schema.

## Commands

`pnpm --filter @oraqul/api dev | build | test | test:e2e | typecheck`. See [testing.md](../testing.md).

## TODO

Build the three sign in flows. Upload parsing (drop personal columns, delete the raw file, spec §6 privacy). Share link and export endpoints.
