# Data, types and states

How a screen gets data, changes data, and behaves while waiting or failing. The goal is that backend and frontend work on one feature meet without rework: the schema comes first, then the API, then a fetcher, then the screen.

## Order of work for a feature

1. Request and response schemas in `packages/schema`. The API validates with them, the web app parses with them.
2. API route.
3. One fetcher in `apps/web/src/lib/api/<resource>.ts`.
4. The screen, with its `loading.tsx`, `error.tsx` and empty state.

A screen never starts before the response schema exists. If a field is missing, change the schema, not the screen.

## Types

- Every type a screen uses is imported from `@oraqul/schema`. No hand-written copies of API shapes in `apps/web`.
- Props of page-specific components are derived from schema types (`Pick`, `z.infer`), not redeclared.
- Verdicts, confidence and scores are passed to components as the data value from the API. The web app never computes, rounds or relabels them (hard rule 1).
- No `any`, no casts on API data. See [typescript.md](../typescript.md).

## Reading data

Pages are async server components. They call fetchers and pass the result to client components as props. There is no client cache library.

- Screens never call `fetch` directly. They call a fetcher.
- A fetcher is one function per endpoint in `lib/api/<resource>.ts` (for example `lib/api/projects.ts`). It builds the request, sends it, and returns the value parsed with the schema from `@oraqul/schema`. That parse is the only validation of API data on the web side.
- Server fetchers forward the session cookie from `cookies()` (`next/headers`) to the API. They run only on the server.
- `cacheComponents` is on. Reading `cookies()` outside a `<Suspense>` boundary blocks the route. A route's `loading.tsx` is such a boundary, so fetch in the page and keep `loading.tsx` next to it.
- Never fetch in a layout, with one exception: the signed in shell (`app/(app)/layout.tsx`) shows the team, member count and person in its sidebar. Each part sits in its own `<Suspense>`, reads through `getShellData` (`lib/api/shell.ts`, one fetch per request) and uses `serverGetIfSignedIn`, so a 401 gives nothing instead of a redirect and the page keeps the return path. A failure also renders nothing, because the page reports a down API itself.
- Fetchers are not cached unless the route says so on purpose. User data is per session.
- Independent fetches in one page start together (`Promise.all`). Slow, non-critical parts go inside `<Suspense>` so the rest of the page shows first.
- Do not fetch in a client component with `useEffect`. If a client component needs data, the parent fetches it and passes it down.

The session cookie is set by the API with `Domain` on the shared parent domain, so the web app and API are same site and server components can read it. See [architecture.md](../architecture.md#sessions-and-domains).

## Changing data

Writes (create a project, answer a question, post a message, add a result) are made from client components with typed helpers in `lib/api/<resource>.ts`, using `clientRequest` with the session cookie.

- The helper validates the response with the schema and returns the typed value. The caller never reads raw JSON.
- After a write, call `router.refresh()` so server components re-fetch. Keep local state only for what is still in flight (a pending message, a selected option).
- Buttons that write are disabled while the request is in flight and show the result or an error next to where the person acted.
- Do not use Server Actions or Next route handlers as a proxy. The API is the only backend.

## Agent runs

Runs stream over server sent events from the API. The event types and their schema live in `packages/schema` (`threadEventSchema`).

- Each event is parsed once with the schema as it arrives. Unknown or malformed events are reported, not rendered.
- Render from the event type with a `switch` over the discriminated union, so a new event type is a compile error until handled.
- Answers to question cards are posted back as messages through a mutation helper.
- A dropped stream shows a plain message with a retry. It never leaves the screen looking finished.

## Loading

- Every route segment that fetches data has a `loading.tsx`.
- Skeletons use tokens (`bg-surface2`, `border-line`) and match the shape of the final content, so the page does not jump.
- Pulse or shimmer stops under `prefers-reduced-motion`.
- Use `<Suspense>` with a skeleton for slow parts inside a page. Do not use spinners for page loads.
- Skeletons are shared in `packages/ui` once a second screen needs the same one.

## Errors

- Every route segment that fetches data has an `error.tsx`.
- This Next version passes `retry` to `error.tsx`, not `reset`. Check `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md` before copying older examples.
- Copy follows [design-system §10](design-system.md): plain, short, no codes or stack traces. Say what happened and offer one action, "Try again".
- Not found uses `notFound()` and a `not-found.tsx` in the segment.
- A line the agent could not test is **data**, not an error. Render it as "Could not test" with its reason, with the glyph and word. Never route it to `error.tsx`.
- Do not catch an error in a screen only to hide it. Let the segment boundary handle it, or handle it where the person can do something about it (a form field, a retry button).

## Empty states

- Every list has an empty state. It says what is missing in one line and gives one action that fixes it ("Start a plan").
- Words follow [design-system §10](design-system.md).
- An empty list and a failed load look different. Empty comes from a successful response with no items.

## Signed out

A 401 from the API sends the person to `/sign-in`. It is handled in one place per transport, not in screens:

- Server fetchers: `serverGet` in `lib/api/server.ts` calls `redirect('/sign-in')` (`next/navigation`) on a 401. Pass `{ returnTo: '/path' }` to redirect to `/sign-in?next=/path`, so the person comes back after signing in. The sign in pages read `next` and accept only same site paths (`nextPathSchema`).
- Client helpers: `clientRequest` in `lib/api/client.ts` navigates to `/sign-in` on a 401 and never settles, so no error flashes while the page leaves. Sign in calls pass `redirectOn401: false`, because there a 401 means wrong credentials.
- The sign in pages must never fetch signed-in data, or a 401 loops. The landing page `/` may ask who is signed in, but treats a 401 as signed out and never redirects.

Screens and components never check for a 401 themselves. A 403 is an error, not a redirect.

TODO(verify): `unauthorized()` and `unauthorized.tsx` are experimental in this Next version and need `authInterrupts` in `next.config.ts`. Do not use them until the team decides to.

## Demo backend (until the API serves projects)

Projects, threads, outputs, receipts and share links are not served by the API yet. Until they are, `apps/web/src/lib/demo/` stands in for it, so the screens can be built and reviewed now.

- Shapes are the draft schemas in `packages/schema` (`brief.ts`, `output.ts`, `thread.ts`, `projectSchema`, `categoryInfoSchema`). Every output the demo makes is parsed with `outputSchema`, so a drift fails loudly.
- `lib/demo/queries.ts` has one function per endpoint in spec §7 (`getOverview`, `listProjects`, `getProjectDetail`, `getThreadDetail`, `getOutputDetail`, `comparePlans`, `getShared`). `lib/demo/actions.ts` mirrors the mutation helpers. Screens import only these two, `use-demo.ts` and `catalog.ts`.
- Numbers, verdicts, confidence, headlines and receipts are computed in `lib/demo/build-output.ts`, never in a component (hard rule 1). Receipts carry `source: 'demo'`. The public share link shows a "Demo data" note, since its readers are outside the team; signed in screens do not, because the team knows.
- State lives in browser memory: new work survives client navigation and resets on reload. The server render and the browser start from the same seed, so hydration matches.
- Pinned projects are one person's, so `lib/demo/pins.ts` keeps their ids in the browser's storage, parsed with `pinnedProjectsSchema`, and they survive a reload. A pin to a project the session no longer has is skipped.
- Files attached to a first message stay in the browser. The demo reads small text files (txt, md, csv, json) so their words count, and takes only the name of anything else. Nothing is uploaded until `POST /uploads` exists.
- The sign in, the person and their team role are real (`lib/api/viewer.ts`). Viewers cannot chat or start work; only owners can delete a project.

This bends two rules above on purpose: demo reads happen in client components, and writes skip `router.refresh()`. To move a resource to the API, write its fetcher in `lib/api/<resource>.ts`, call it in the route's `page.tsx`, pass the result to the same screen component as props, and delete the matching query and the demo state it used. When the last resource moves, delete `lib/demo`.

## Checks before a PR

- The schema, the API route, the fetcher and the screen are in the same branch (or the PR says which follows, see [git.md](../git.md)).
- The screen has loading, error and empty states, and each was seen once.
- No `fetch`, `useEffect` data load, cast or hand-written API type in the screen code.
- The UI checks in [testing.md](../testing.md) pass.
