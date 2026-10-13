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

Hand rolled sessions. A signed `httpOnly` cookie holds a session id. `SessionGuard` looks it up in `sessions` and attaches the user. `RolesGuard` and `@Roles()` exist but deny everything until membership checks are written (team management).

The cookie is set on the shared parent domain and CORS allows only the web origin with credentials, see [architecture.md](../architecture.md#sessions-and-domains). Cookie domain and web origin come from env, validated in `src/config/env.ts`.

Sign in methods: email and password, Google OAuth, and a one-time code sent by email. All three end in the same session (`SessionsService.create`, 30 days). Visitors who are signed out get no team and no live runs.

- **Linking.** `UsersService.findOrCreateVerified` is the only place an account is created or found. Every method proves the email first, so one email is one user.
- **Passwords.** `crypto.scrypt`, stored as `scrypt$N$r$p$salt$hash`. At least 8 characters. A wrong password and an unknown email give the same 401.
- **Codes.** `email_codes` stores an HMAC of the code (keyed with `SESSION_SECRET`). 6 digits, 10 minutes, single use, 5 wrong tries, 5 codes per email and purpose per 10 minutes. A signup holds its password hash in the code row and applies it only after the code is proved, and only if the account has no password yet. Reset and code requests always answer 202 so they do not reveal which emails exist. Wrong codes answer 400 and lockouts 429, never 401, because the web app treats 401 as signed out.
- **Login rate limit.** `LoginLimiterService` records each wrong password in `login_failures`. A 429 comes after 5 failures for the same email from the same address in 15 minutes, or 20 failures from one address across any emails. The email limit is per address so a stranger cannot lock the owner out, and unknown emails count the same as known ones. A good sign in clears that pair. `request.ip` is the proxy's address unless `TRUST_PROXY_HOPS` says how many proxies sit in front of the API.
- **Password reset.** `POST /auth/password/reset/confirm` sets the password, deletes every session of that user and signs the person in again. It also lets a Google only account add a password.
- **Google.** `google-auth-library` `OAuth2Client` with S256 PKCE and a `state` held in a short lived signed cookie scoped to `/auth/google`. The ID token is verified for signature and audience, and `email_verified` must be true. Without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` the route sends the person back to `/?error=google`.
- **Email.** `@getbrevo/brevo` sends through Brevo when `BREVO_API_KEY` is set. When it is empty, codes are printed to the API console. `EMAIL_FROM` must be a sender verified in Brevo. Brevo accepts a message from an unverified sender and then drops it, so the API refuses to start when `BREVO_API_KEY` is set without a valid `EMAIL_FROM`.
- **Env.** `API_ORIGIN`, `COOKIE_DOMAIN` (empty locally), `TRUST_PROXY_HOPS` (0 locally), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BREVO_API_KEY`, `EMAIL_FROM`.

Not built yet: the team side (`RolesGuard` still denies everything until membership checks exist). The agent routes need a signed in session (`SessionGuard`) but not yet a team role.

## Streaming

Runs stream over server sent events at `GET /threads/:id/events`. Event shapes are `threadEventSchema` in `packages/schema`. The web app and the API must both use that schema.

## Commands

`pnpm --filter @oraqul/api dev | build | test | test:e2e | typecheck`. See [testing.md](../testing.md).

## TODO

Team management and a real `RolesGuard`. Upload parsing (drop personal columns, delete the raw file, spec §6 privacy). Share link and export endpoints.
