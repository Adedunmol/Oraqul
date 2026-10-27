# Architecture

Behaviour is specified in [product/spec.md](product/spec.md). This file covers how the repo is laid out, how the pieces connect, and the conventions for the backend and the frontend.

## Running system

```
Next.js (Vercel)  ->  NestJS API (VPS)  ->  agent runtime (module in the API)
                           |                       |
                        Postgres              Qloo API (QLOO_BASE_URL) + model provider
```

- The web app talks only to the API. Runs stream to it over server sent events (event types in `packages/schema`, listed in [spec §8](product/spec.md)).
- The agent runtime is a module inside the API process, not a separate service. So is the launch watch scheduler (`apps/api/src/watch`): there is no queue or worker. A watch's due time and the claim on it live in Postgres, so a restart only delays a check and never loses it, and the API still runs as one instance.
- Qloo is reached through the client in `packages/engine`, called from the API. There is no separate Qloo service. See [qloo.md](backend/qloo.md).

## Repo layout

| Path | Role | May import |
|---|---|---|
| `apps/web` | Next.js front end | `schema`, `ui`. The Guide and marketing pages also read `packs`, for the rules they show |
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

- On the VPS, `.env` filled in for production, then `CODE_VERSION=$(git rev-parse --short HEAD) docker compose --profile deploy up -d --build`. The `api` service builds `apps/api/Dockerfile`, runs the migrations on start and serves port 4000. `pnpm db:up` still starts Postgres only.
- The image sets `NODE_ENV=production`, so the API refuses to start unless `QLOO_MODE=live`.
- Production values: `WEB_ORIGIN` and `API_ORIGIN` on subdomains of one domain (see Sessions and domains), `COOKIE_DOMAIN=.<domain>`, `TRUST_PROXY_HOPS=1` behind one reverse proxy, and the Google redirect URI `<API_ORIGIN>/auth/google/callback` in the Google console. On Vercel, `NEXT_PUBLIC_API_URL` is the API origin.
- Runs live in the API process, so run one instance. A restart stops the runs in progress.

## Backend

NestJS in `apps/api`. Endpoints are in [spec §7](product/spec.md), tables in [spec §6](product/spec.md), failure behaviour in [spec §10](product/spec.md). The agent runtime is in [backend/agent.md](backend/agent.md), and the plan pipeline every category shares is in [backend/launch-runtime.md](backend/launch-runtime.md).

### Conventions

- ESM. Relative imports end in `.js`.
- One feature module per folder: `auth`, `health`, `db`, `agent`, then `projects`, `threads`, `outputs`, `teams`, `shares`, `uploads` as they are built.
- Controllers parse input and call a service. Services hold logic. Controllers hold no logic.
- Input is validated with Zod at the controller edge. Env is validated once at boot in `src/config/env.ts`. See [typescript.md](typescript.md).
- Handle errors where you can act on them. Let Nest's exception filters turn the rest into responses.
- Roles are enforced in guards, never in handlers. Viewers are read only.

### Database

Drizzle in `src/db`.

- Schema: `src/db/schema.ts`. It mirrors spec §6. Category, job and role lists come from `@oraqul/schema`. `projects.window` in the spec is `launch_window` in the table, because WINDOW is a reserved SQL word.
- Inject with `@Inject(DB) db: Database` (global `DbModule`).
- Change the schema, then `pnpm --filter @oraqul/api db:generate` and commit the SQL in `apps/api/drizzle`. Apply with `db:migrate`. Never edit an applied migration.
- `db:studio` opens a browser view of the data.
- Local Postgres: `docker compose up -d db` (host port 5433).

### Auth

Hand rolled sessions. A signed `httpOnly` cookie holds a session id. `SessionGuard` looks it up in `sessions` and attaches the user. `RolesGuard` and `@Roles()` check team roles, see Teams below.

The cookie is set on the shared parent domain and CORS allows only the web origin with credentials, see [Sessions and domains](#sessions-and-domains). Cookie domain and web origin come from env, validated in `src/config/env.ts`.

Sign in methods: email and password, Google OAuth, and a one-time code sent by email. All three end in the same session (`SessionsService.create`, 30 days). Visitors who are signed out get no team and no live runs.

- **Linking.** `UsersService.findOrCreateVerified` is where Google and emailed sign in codes create or find an account, after proving the email. A password signup is the one exception: `createUnverified` makes the account first (`users.email_verified_at` null) and the person confirms later with a `verify` code. One email is still one user, and a method that proves an unconfirmed address drops the password set at signup.
- **Confirming email.** `VerifiedGuard` runs after `SessionGuard` and `RolesGuard` on the routes that create a project, a chat or a message, and answers 403 with `code: email_not_verified`. The web app reads that code (`isEmailNotVerified`) to explain instead of showing a generic error. A failed confirmation email never fails the signup; `POST /auth/verification` sends another.
- **Passwords.** `crypto.scrypt`, stored as `scrypt$N$r$p$salt$hash`. At least 8 characters. A wrong password and an unknown email give the same 401.
- **Codes.** `email_codes` stores an HMAC of the code (keyed with `SESSION_SECRET`). 6 digits, 10 minutes, single use, 5 wrong tries, 5 codes per email and purpose per 10 minutes. Reset and code requests always answer 202 so they do not reveal which emails exist. Wrong codes answer 400 and lockouts 429, never 401, because the web app treats 401 as signed out.
- **Login rate limit.** `LoginLimiterService` records each wrong password in `login_failures`. A 429 comes after 5 failures for the same email from the same address in 15 minutes, or 20 failures from one address across any emails. The email limit is per address so a stranger cannot lock the owner out, and unknown emails count the same as known ones. A good sign in clears that pair. `request.ip` is the proxy's address unless `TRUST_PROXY_HOPS` says how many proxies sit in front of the API.
- **Changing a password.** `POST /auth/password/change` needs the current password when the account has one, checked against the same `LoginLimiterService` as sign in, and answers a wrong one with 400 (never 401). It then deletes every session of the user and starts a new one for this device, like reset. An account without a password sets its first without proving one.
- **Password reset.** `POST /auth/password/reset/confirm` sets the password, deletes every session of that user and signs the person in again. It also lets a Google only account add a password.
- **Google.** `google-auth-library` `OAuth2Client` with S256 PKCE and a `state` held in a short lived signed cookie scoped to `/auth/google`. The ID token is verified for signature and audience, and `email_verified` must be true. Without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` the route sends the person back to `/sign-in?error=google`.
- **Email.** `@getbrevo/brevo` sends through Brevo when `BREVO_API_KEY` is set. When it is empty, codes are printed to the API console. `EMAIL_FROM` must be a sender verified in Brevo. Brevo accepts a message from an unverified sender and then drops it, so the API refuses to start when `BREVO_API_KEY` is set without a valid `EMAIL_FROM`.
- **Env.** `API_ORIGIN`, `COOKIE_DOMAIN` (empty locally), `TRUST_PROXY_HOPS` (0 locally), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BREVO_API_KEY`, `EMAIL_FROM`.

The project, thread and output routes need a signed in session (`SessionGuard`) and a team role (`RolesGuard`, spec §7): owners and editors write, viewers read.

### Teams

`src/teams`. Roles, the last owner rule and invites are specified in [spec §7](product/spec.md); this is how they are built.

- **RolesGuard.** `@UseGuards(SessionGuard, RolesGuard)` and `@Roles('owner', ...)` on a route with `:teamId` in its path. The roles listed are the only ones allowed, there is no ranking. The guard attaches `request.membership`, read with `@CurrentMembership()`. Put the guard on the route, not the controller, when only some routes have a `:teamId`. Every team scoped route added later (projects, threads, outputs) uses the same guard.
- **Personal team.** Created in the same transaction as the account, by `findOrCreateVerified` or `createUnverified`. Migration `0003` also gave one to every account that existed before it.
- **Last owner.** `TeamsService.changeRole` and `removeMember` lock the team's owner rows (`FOR UPDATE`) before counting them, so two owners cannot demote each other at once.
- **Invites.** `InvitesService`. Only a SHA-256 of the token is stored, which is enough for a 256 bit random value. A failed email send deletes the invite so the pending list never shows something nobody received. The link uses `WEB_ORIGIN`. Without `BREVO_API_KEY` the link is printed to the API console.
- **No teams.kind or memberships.status.** Personal teams are not special after creation, and pending people live in `invites`, so neither column had a use.

### Streaming

Runs stream over server sent events at `GET /threads/:id/events`. Event shapes are `threadEventSchema` in `packages/schema`. The web app and the API must both use that schema.

### Commands

`pnpm --filter @oraqul/api dev | build | test | test:e2e | typecheck`. See [testing.md](testing.md).

## Frontend

Next.js App Router in `apps/web`. The look is defined in [design-system.md](frontend/design-system.md). Turning it into code is in [components.md](frontend/components.md). Data, types and loading, error and empty states are in [data.md](frontend/data.md). Routes and screens are in [spec §9](product/spec.md).

> `apps/web/AGENTS.md` (written by Next) warns that this Next.js version has breaking changes. Read the matching guide in `node_modules/next/dist/docs/` before using a Next API you have not used in this repo.

### Rules

- Server components by default. Add `"use client"` only for state, effects, browser APIs or event handlers, and keep those components small and low in the tree.
- The web app talks to the API only, through the fetchers in `src/lib/api/` (they send the session cookie). It never imports `engine`. Only the Guide and the marketing pages import `packs`, read only, for the launch rules they show; the plan screens never do.
- Types come from `@oraqul/schema`. Parse API responses with its schemas inside the fetcher, see [typescript.md](typescript.md).
- Reads happen in server components, writes in client components through typed helpers. Every data route has loading, error and empty states. Full rules in [data.md](frontend/data.md).
- Agent runs stream over server sent events. Render question cards, trace steps and messages from the event, and post answers back as messages.
- No literal colours, fonts or radii in components. Use tokens, see [components.md](frontend/components.md).
- Words follow [design-system §10](frontend/design-system.md). Plain, short, no jargon.

### Required for every screen

- Works in light and dark.
- Works at 375px wide with no horizontal scroll. Mobile keeps chat, outputs and their details only (PRD A3).
- Colour never carries meaning alone. Verdicts show glyph and word.
- Visible focus, real buttons, labelled dialogs.
- Motion respects `prefers-reduced-motion` ([design-system §8](frontend/design-system.md)).

### Layout of `apps/web/src`

| Path | Holds |
|---|---|
| `app/` | Routes, layouts, `globals.css` (tokens) |
| `app/(auth)/` | Sign in, create account, forgot password, email code, verify and reset pages with their shared card and form hook |
| `app/(marketing)/`, `app/_marketing/` | The public marketing pages and their shared pieces (header, footer, app frame) |
| `app/_workspace/` | Screen pieces shared by the signed in app and the public share link: charts, chat, output tabs |
| `lib/api/` | One file per resource: fetchers and mutation helpers, see [data.md](frontend/data.md) |
| `lib/demo/` | The demo backend that stands in for project, thread and output endpoints, see [data.md](frontend/data.md#projects-outputs-and-the-demo-layer) |
| `lib/routes.ts` | Paths for the overview, project lists and projects. Build links with these, not by hand |
| `lib/` | Other small helpers |
| `e2e/` (in `apps/web`) | Playwright tests |

Shared components belong in `packages/ui`, not here. Only page-specific pieces stay in `apps/web`.

### Commands

`pnpm --filter @oraqul/web dev`, `build`, `typecheck`, `test:e2e`. See [testing.md](testing.md).
