# Oraqul: Technical Spec

Read with the PRD and the design system file. Qloo endpoint names and parameters below follow the prototype and secondhand notes. Confirm them against Qloo's docs and our own key before building.

## 1. Architecture

```
Next.js web app  ->  API (NestJS, Node, VPS)  ->  Agent runtime  ->  Qloo client (hackathon.api.qloo.com API)
                           |                          |
                        Postgres                  Model (OpenAI via Vercel AI SDK)
```

* **Web.** Next.js, deployed on Vercel. Talks to the API only. Streams agent events over server sent events.
* **API.** NestJS on a VPS. Owns auth, teams, projects, threads, outputs, share links, export.
* **Agent runtime.** A module in the API process. Runs the router and the category agents.
* **Qloo client.** `packages/engine` calls the Qloo hackathon API directly. No separate service.
* **Postgres.** All state. Docker for local and deploy.
* **MCP server.** Exposes the engine tools to other agents. Same code as the agent toolbox.

## 2. Monorepo

```
apps/web            Next.js front end
apps/api            NestJS API and agent runtime
packages/engine     Qloo client, scoring, verdicts, receipts (pure TypeScript, no framework)
packages/packs      One folder per category: film, music, books, podcasts, games
packages/schema     Zod schemas and shared types: brief, output, receipt, events
packages/mcp        MCP server over the engine
packages/eval       Test cases and the eval runner
```

Rules: `engine` and `packs` never import from `apps`. `schema` has no dependencies. The web app imports types from `schema` only.

## 3. Agents

### 3.1 Router

Input: project record. Output: the category agent to run and the job (plan, audit, rescue, scenario, date, partner). It does not call tools. If category or job is unclear it returns a question card, not a guess.

### 3.2 Category agent

One per category. Each is a configuration of the same runtime:

| Part | What it holds |
|---|---|
| System prompt | Role, tone, refusal rules, how to read the category's inputs |
| Assumption checklist | Stated and unstated assumptions to look for in that category |
| Plan sections | Section keys and titles, move templates, headline template |
| Tool allowlist | Which engine tools it may call |
| Scenarios | Presets with a matcher and an apply function |
| Results format | Group labels, planned shares, hold metric, confirm card fields |
| Output schema | Brief shape and signature tab data |
| Coverage | Tests, thin, and not supported lists shown on the category page |

The runtime is one loop for all five: plan the steps, call tools, record each call as a receipt, test each assumption, search for better options, red team, package.

### 3.3 Red team step

A separate model call. It receives the finished brief and the receipts, not the reasoning that produced them. It tries to break the top recommendation from the opposite seed (a different comp or segment to start from). If it finds a stronger option the brief is updated and the trace says so.

### 3.4 Cross category rule

Agents do not call each other. One exception: Books may call `askAgent("film", question)` for an adaptation angle. The call is bounded to one question, returns data plus its receipts, and shows in the trace.

### 3.5 Loop limits

Max steps per run, max Qloo calls per run (call budget), and a stop rule: stop when no candidate beats the current plan by a set margin, or say what input would change the verdict. Follow up requests rerun only the lines whose inputs changed.

## 4. Tools

Every tool returns `{ data, receipt }`. The model sees `data` and a receipt id, never raw Qloo payloads beyond what the tool chooses to return.

| Tool | What it does |
|---|---|
| `searchEntity(name, type)` | Qloo search. Returns candidates. Ambiguous results become an entity match question card. |
| `resolveBundle(title, comps, talent, tags)` | For titles not in Qloo: describe as a bundle of comps, tags and talent. |
| `audienceBySegment(entities, place?)` | Age and gender skews as an affinity index per segment. |
| `lift(candidates, baseline)` | Lift over a neutral audience, from one ranking call. |
| `rankPlaces(entities, places)` | City or territory ranking by lift, one call. Includes diaspora cities. |
| `compareAudiences(a, b)` | Shared audience between two entity sets. Used for rival overlap, comp shelf, fan base bridge. |
| `partnerFit(segment, candidates, type)` | Brand, creator, act or show affinity for a segment. |
| `tagWeights(entities)` | Tag weights in an audience, for the podcast topic map. |
| `momentum(entity)` | Trend over time, where Qloo supplies it. |
| `explain(receiptId)` | Reads back a receipt in plain words. |
| `applyScenario(brief, change)` | Marks dependent lines, reruns only those, returns the diff. |
| `compareResults(brief, results)` | Planned against actual shares, the largest negative and positive gaps. |
| `exportBrief(output)` | Builds the one page brief and appendix. |
| `draftMessage(partner, evidence)` | Draft only. No send. |

Tools live in `packages/engine/src/tools` and are the one toolbox for the agents and the MCP server. External tools (web search, page reader) may supplement but never replace Qloo evidence, and are labelled as such on the line.

## 5. Scoring layer

Computed in code, from values Qloo returned in the same run. The model explains and never sets a score.

* **Lift.** `lift(x) = score(x) / score(baseline)`, both from one ranking call. Strong at 1.5 and above, usable 1.2 to 1.5, weak below 1.2.
* **Verdict.** Per assumption: holds, weak, breaks, or cannot test. Rules are published in the receipt. An assumption with no Qloo signal is cannot test, never weak.
* **Fit.** 0 to 100 for plan lines. 75 and above recommended, 50 to 74 usable, below 50 not recommended.
* **Confidence.** High, medium, lower, set per line from: whether the entity was found, the number of comps behind the signal, and whether the place or title is in a thin coverage list. A fallback to comps and talent caps confidence at medium.
* **Route score (music).** Weighted mean of lift over stops, weights `1, 0.9, 0.8, 0.7, ...` by position, plus the best order by lift for comparison.
* **Rival overlap.** Shared audience between your title and a rival, from one comparison call. Above 60 risky, 35 to 60 moderate, below 35 low.
* **Topic ownership (podcasts).** Tag weight in your audience divided by its weight in rival shows' audiences. Above 1 means yours.
* **Held back.** Values signal and early adopter score stay out of the headline until validated. Premium tolerance is a taste proxy only.

## 6. Data model

Postgres. All ids are UUIDs. Every row has `created_at`.

| Table | Key columns |
|---|---|
| `users` | email, name, password_hash (nullable: Google and code users have none) |
| `sessions` | user_id, expires_at |
| `oauth_accounts` | user_id, provider (google), provider_user_id; unique per provider and provider_user_id |
| `email_codes` | email, code_hash, purpose (signin, signup, reset), name and password_hash for a pending signup, attempts, expires_at, consumed_at |
| `teams` | name |
| `memberships` | team_id, user_id, role (owner, editor, viewer); unique per team and user |
| `invites` | team_id, email, role, token_hash, invited_by, expires_at, accepted_at; one pending invite per team and email |
| `projects` | team_id, category, name, kind, genre, places[], window, lead, comps, inputs jsonb, status |
| `threads` | project_id, name, base_output_id, from_output_id, fresh bool, created_by |
| `messages` | thread_id, role (user, agent, question, trace, output), body jsonb, seq |
| `outputs` | thread_id, project_id, kind (plan, audit, scenario, rescue, date, partner), parent_id, title, brief jsonb, changed_ids[], headline, moves jsonb, confidence jsonb, data_as_of |
| `receipts` | output_id, line_id, endpoint, input jsonb, returned jsonb, rule text, confidence, called_at, call_id |
| `share_links` | output_id, token, enabled |
| `runs` | thread_id, agent, job, steps jsonb, qloo_calls int, tokens int, status |
| `category_packs` | version only; packs live in code |

`brief` shape (Zod, in `packages/schema`): `audience[]`, `assumptions[]`, plan sections `s1` to `s4`, `places[]`, `dates[]`, `partners[]`, `risks[]`, `cannot[]`, `planned[]`, `aLabels[]`, `results`, `course`, plus category data: `grid` (music), `shelf` and `bridge` (books), `topics` (podcasts), `fan` (games). Every line has an `id` that is stable across versions, which is how diffs and "changed" marks work.

Privacy: only public entity names, place names and age bands go to Qloo. Uploaded results are stored as aggregates. Files are parsed, personal columns dropped, and the raw file deleted.

## 7. API

REST, JSON. Auth by session cookie. Streaming runs by server sent events.

```
POST   /auth/signup           email, name, password; emails a code
POST   /auth/code             email a sign in code
POST   /auth/code/verify      code ends in a session, creates the account if new
POST   /auth/login            email and password; 429 after repeated failures
POST   /auth/password/reset   email a reset code (always 202)
POST   /auth/password/reset/confirm   code and new password; ends other sessions
GET    /auth/google           GET /auth/google/callback
POST   /auth/logout           GET /auth/me
GET    /teams                 POST /teams
GET    /teams/:teamId         members, pending invites (owners only), myRole
POST   /teams/:teamId/invites     PATCH /teams/:teamId/members/:uid     DELETE /teams/:teamId/members/:uid
GET    /invites/:token        POST /invites/:token/accept
GET    /overview              needs you, threads to pick up
GET    /me/pins               pinned project ids, newest first
PUT    /me/pins/:projectId    DELETE /me/pins/:projectId
GET    /projects?category=    POST /projects (mode, category, first message, attachments)        GET /projects/:id        DELETE /projects/:id
POST   /projects/:id/threads  GET /threads/:id
POST   /threads/:id/messages  user message or question card answer
GET    /threads/:id/events    SSE: trace steps, questions, messages, output ready
GET    /outputs/:id           GET /outputs/:id/evidence
GET    /outputs/:id/export    one page brief and appendix
GET    /projects/:id/compare?a=&b=
POST   /outputs/:id/share     PATCH /shares/:token (on or off)
GET    /s/:token              read only view
POST   /uploads               plan or results file, parsed to aggregates
```

Sign in details: codes are 6 digits, expire in 10 minutes, work once, and lock after 5 wrong tries. Accounts are linked by verified email, so the same person reaches one account by password, Google or code. Passwords are at least 8 characters.

Roles are enforced in a guard, never in handlers. `RolesGuard` runs after `SessionGuard`, reads `@Roles()` on the route and the `:teamId` route param, loads the caller's membership and answers 403 when there is none or the role is not listed. A route with no `@Roles()` is denied. A team that does not exist and a team the caller is not on give the same 403.

| Action | Owner | Editor | Viewer |
|---|---|---|---|
| See the team and its members | yes | yes | yes |
| See pending invites | yes | no | no |
| Invite, change a role, remove a member | yes | no | no |
| Read projects, threads and outputs | yes | yes | yes |
| Create or change projects, run the agent, post messages | yes | yes | no |

The last two rows apply when projects belong to teams.

**Teams.** A new account gets a personal team it owns, made in the same transaction as the account (`UsersService.findOrCreateVerified`). Anyone can create more teams and owns the ones they create. A team always has an owner: demoting or removing the last one answers 409. Owners can remove themselves only while another owner remains.

**Invites.** An owner invites an email with a role. The API emails a link to `/invite/<token>`. The token is 32 random bytes, stored only as a SHA-256 hash, works once and expires after 7 days. Inviting an email that already has a pending invite replaces it, which is how to resend. Inviting someone already on the team is 409, and a team sends at most 20 invites an hour (429). The accept routes need a signed in session, and the signed in email must equal the invited email, else 403, checked before the invite is used up. A token nobody issued is 404, one that expired or was used is 410 on accept, and `GET /invites/:token` reports it as `status` instead. Accepting adds the membership with the invited role. Someone who is already a member keeps their role.

## 8. Events

SSE event types: `trace.step`, `question`, `message`, `receipt`, `output.created`, `run.stopped`, `error`. Shapes are `threadEventSchema` in `packages/schema`. A `trace.step` names the agent that took it (`router`, `film`, `books→film` for a consult). A question has an id, the asking agent, its card type (single, multi, text, split, date, file, confirm, match) and its options. A `message` carries its claims, each with the receipt ids behind it. A `receipt` event streams each receipt as the tool makes it. `run.stopped` ends every run segment with a reason: `finished`, `waiting` (on a question), `budget`, `steps` or `error`. The web app renders cards from the event, and posts the answer back as a message.

## 9. Web app

Routes: `/` the landing page (pitch, example answer, how it works, categories, receipts), `/sign-in`, `/sign-up`, `/forgot-password`, `/email-code`, `/verify`, `/reset-password`, `/overview`, `/categories/:category/projects`, `/categories/:category/projects/:id`, `/threads/:id`, `/outputs/:id`, `/team`, `/invite/:token`, `/s/:token`.

`/overview` is the team's home and where sign in lands: the Start here cards, Needs you (threads waiting on an answer, launches out with no results, new results, runs in progress) and threads to pick up. The project lists show the person's pinned projects first. `/start?mode=&category=` is the chat for one way to start, before anything is saved. `:category` is a category id or `all`. The list for one category opens with what Oraqul tests there; `all` lists every project. A project has one address, under its own category, so opening it under `all` or another category moves there. `/projects`, `/projects/:id` and `/categories/:category` redirect to the new routes. The current team is the one in the `oraqul_team` cookie, never part of the address. The landing page header shows Open app instead of the sign in buttons when the visitor is signed in, and never redirects. The sign in pages take a `next` path and pass it between each other. `/verify` and `/reset-password` take the email from an `email` query value, set by the page before them. `/team` shows the team's members, a role select and remove for owners, pending invites, the invite form and sign out; the team comes from the sidebar switcher, remembered in an `oraqul_team` cookie and checked against the person's memberships. `/invite/:token` previews an invite and accepts it. A signed out visitor is sent to sign in and returned to the invite afterwards.

Output page tabs come from the output kind and the category pack: Summary, Audience, Assumptions, Plan, the category's signature tabs, Risks, Could not test, Evidence, plus Changes, Results, Rival dates and Partner briefs where they fit. The what if bar sits above the plan tabs and matches typed text to the pack's scenario matchers. Receipts open in a side drawer. A dock chat on the output page continues the thread.

Charts are inline SVG or CSS, each with a table toggle, a legend, and hover text. Colour never carries meaning alone: verdicts also carry an icon and a word.

### 9.1 Design system in code

The look is defined in the design system file. In code:

* Tokens live in `globals.css` as CSS variables, light on bare `:root`, dark in a guarded media query and again under `[data-theme="dark"]`, each with `color-scheme`. No component uses a literal colour.
* Fonts come from `next/font/google`: Bricolage Grotesque for titles and the bottom line, Geist for text, Geist Mono for ids and keycaps.
* Category colour is set by a `data-cat` attribute and a `--cat` variable. It is used only for the icon tile and icon stroke.
* A small component set lives in `packages/ui`: Button, Input, Chip, VerdictPill, Confidence, ReceiptChip, Card, Line, Tabs, TabNote, StartCard, ProjectCard, SummaryCard, QuestionCard, Trace, Chart, ReceiptDrawer, Palette, Modal, Toast, Icon. VerdictPill and Confidence take the data value and draw the glyph and word, so colour cannot appear alone.

### 9.2 Start modes

There is no New project action. The Start here cards on the overview, and a Start button on the project lists that opens the same three, open `/start` with a `mode` of `start`, `audit` or `rescue`, plus the category when started from a category's page. That page saves nothing. The first message, text, files or both, creates the project and its first thread (`POST /projects`), so a choice nobody follows up leaves no empty project. The mode sets the first prompt: a title and a line for start, the plan for audit, and what happened plus results for rescue. The agent takes the title and the category from that message, asks only for what it could not find, and uses the mode as the default reading of the job. The agent still asks "I read this as ... Is that right?" and lists the other two jobs, so a wrong card can be corrected in one tap.

### 9.3 Tabs, notes and search

* The tab list for an output comes from its kind and category pack. The client shows Summary, Plan, Assumptions and Evidence plus the current tab, and groups the rest under More. When there are five tabs or fewer, all show.
* Each tab has a note string, stored with the tab definition and shown above the content. Notes are product copy and are reviewed with the PRD.
* The search palette is client side over the team's categories, projects, outputs and fixed actions. It opens on Ctrl K or Cmd K and groups results by type. Number keys on the active question card pick the option with that index when no text field has focus.

### 9.4 Motion

Motion uses CSS only. New chat items are marked by a per thread seen count so a re render does not replay them. Agent text reveals word by word with a capped delay. The trace shows a progress bar from step count. Bars grow once on the first view of a tab. All durations drop to near zero under `prefers-reduced-motion`.

## 10. Failure handling

| Case | Behaviour |
|---|---|
| Entity not found | Search alternatives, ask a match question, or fall back to comps and talent. Say so on the line. |
| Place not ranked | Mark thin, lower confidence, keep it out of the headline. |
| Qloo error or timeout | Retry once. Then mark the line cannot test with the reason. Never fill from the model. |
| Call budget reached | Stop, return what is tested, list what was skipped. |
| Model names an entity not in the run's Qloo data | Output validator rejects it and the step reruns. |

## 11. Testing and evaluation

* **Unit.** Scoring functions, verdict rules, diff and changed marks, results gap logic.
* **Contract.** Recorded Qloo responses per tool. A live smoke test runs against our key.
* **Golden runs.** Per category, three fixed inputs (plan, audit, rescue) with expected verdict shape. Run on every change.
* **Grounding check.** Every entity and number in an output must trace to a receipt. Fails the build if not.
* **Refusal tests.** Forecast, pricing and send requests are refused with the right message.
* **Coverage tests.** Nigerian titles, Lagos against no location, podcasts and games, diaspora ranking.
* **UI.** Headless browser pass over every tab of every output in every category, checking for errors and for the words "undefined" or "NaN". Include the three Start here cards, the More tab toggle, the search palette, light and dark, and a 400px width with no horizontal scroll.
* **Comprehension.** A short test with real launch marketers on the prototype, including Nigerian users on mid range Android, before wording is locked.

## 12. Deployment

Vercel for web. VPS with Docker Compose for API and Postgres. Environment variables for the Qloo key, model key and session secret. Backups of Postgres nightly. Public repository with an open source licence and a README that runs the demo locally.

## 13. Build order

1. Live Qloo tests and notes on real coverage.
2. `engine` with receipts and verdicts, tested against recorded responses.
3. Runtime with the router and the Film agent, end to end through plan, audit, scenario and rescue.
4. Web: design tokens and components, chat, trace, outputs, evidence, receipts, Start here cards, tab notes.
5. Music agent, then Books, Podcasts, Games as packs.
6. Accounts, share, export, compare.
7. MCP server, evals, demo video.
