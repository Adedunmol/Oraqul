# Oraqul: Technical Spec

Read with the PRD and the design system file. Qloo endpoint names and parameters below follow the prototype and secondhand notes. Confirm them against Qloo's docs and our own key before building.

## 1. Architecture

```
Next.js web app  ->  API (NestJS, Node, VPS)  ->  Agent runtime  ->  Qloo client (hackathon.api.qloo.com API)
                           |                          |
                        Postgres                  Model (configured provider via Vercel AI SDK)
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

Input: the first message (text and the words of any small text file) and the `/start` hints. Output: the project's title, its category, the start mode (build, audit, rescue), and so the category agent to run. It does not call tools and it never guesses: a value counts only when the person's own words say it, which code checks by finding the model's quote in what they wrote. When the category or the mode is unclear it asks one `single` card, worded from what it read, with two to four close options that each settle the category, the mode or both, and the person may type their own answer instead. When only the title is missing it asks a `text` card. A message that is not about launching a film, series, music, book, podcast or game gets a fixed refusal. Once all three are known it states the job in its first reply and hands the project to the category agent. The model is configured, not fixed (backend/llm.md); with no model key a scripted router takes only what is plainly written and asks about the rest.

**Front door for an active project.** Once the project is saved, every later message passes a check before the category agent sees it. A message with nothing to do with launching or marketing a film, series, music, book, podcast or game gets the same fixed refusal as at the start. A message that may be about this project, or may be a new idea, gets one `single` card of two or three close readings, such as "Check how this plays in Lagos" or "Start a different project", and the person may type their own. A message that plainly follows the conversation goes through. With no model key the check passes everything. The refusal wording is fixed in code. The model may word the card's options, but never decides which agent runs: the project's category does.

The jobs a run can do are build, audit, rescue, scenario, date and partner. The first three are the start modes; the others are follow ups inside a project.

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
| Coverage | Tests, where the read is less certain, and not supported lists shown on the category page |

The runtime is shared by all five and has two paths:

* **Plans (build, audit, rescue, and scenario, date, partner) run a fixed pipeline.** Code sets the steps and their order, so the same input always runs the same tests: read the input into assumptions and anchors, choose a test for each assumption from the pack, run the tests, compute verdicts and scores (§5), write the brief, check it. The model only reads the input and writes the brief from results already computed. Repeatable runs are what make a plan trustworthy and what golden runs (§11) test.
* **Conversation runs a tool loop.** Follow up questions, suggestions and other answers (§3.6), clarifying questions and the Books to Film consult (§3.4) let the model choose the next tool call, because their route cannot be fixed in advance. Code still runs each call, makes the receipts and computes every number.

Both paths share the tools, receipts, scoring and grounding check.

### 3.3 Red team step

A separate model call. It receives the finished brief and the receipts, not the reasoning that produced them. It tries to break the top recommendation from the opposite seed (a different comp or segment to start from). If it finds a stronger option the brief is updated and the trace says so.

### 3.4 Cross category rule

Agents do not call each other. One exception: Books may call `askAgent("film", question)` for an adaptation angle. The call is bounded to one question, returns data plus its receipts, and shows in the trace.

### 3.5 Loop limits

Max steps per run, max Qloo calls per run (call budget), and a stop rule: stop when no candidate beats the current plan by a set margin, or say what input would change the verdict. Follow up requests rerun only the lines whose inputs changed.

### 3.6 Plan and not a plan

A category agent replies in one of two ways. A plan (build, audit, rescue, scenario, date, partner) is a saved output with a brief and receipts, as in §6 and §9. Anything else the person asks inside a project, a follow up question, a request for suggestions or recommendations, is an answer: a short message in the chat whose claims each carry a receipt, with no output page and no saved brief. When the agent cannot tell which the person wants, it asks "Do you want a plan for this, or just an answer?" on a card instead of drafting a full plan nobody asked for. An answer may offer a plan as the next step. Refusals, no forecasts and no invented numbers (§5) apply to both.

### 3.7 Memory

Memory is context the agent starts from so the person does not repeat themselves or copy between projects. It has three layers, narrowest first:

| Layer | What it holds | Who sees it | Lives |
|---|---|---|---|
| Chat | Everything said in this chat, its replies and its outputs | This chat | The thread's messages. A long chat is summarised so the model is not sent all of it |
| Project | The project's inputs (title, category, mode, places, window, comps, files read), its current plan (`base_output_id`), and facts the person confirmed for this project | Every chat of the project | `projects.inputs`, `outputs`, `memory_items` with a project |
| Team | Standing facts about the team: home market, usual territories, language, usual partners, typical comps, formats. "This team always launches in Lagos first" | Every project of the team | `memory_items` with no project |

**Rules**

* **Memory is context, never evidence.** A claim, a number, a score or a verdict still comes from a receipt run in this run (§5, hard rules 1 and 2). A remembered fact may steer what to test, such as which places to rank first, and is never cited as the reason a line holds. The model is told so in the shared base prompt.
* **Most specific wins.** This message beats this chat, which beats the project, which beats the team. When a message changes something memory says, the agent follows the message and says so on the line, and offers to update the memory item.
* **Saving needs a yes.** The agent may notice a standing fact and offers it on a `single` card ("Remember that you launch in Lagos first?": this project, the whole team, not now). Nothing is written silently, and the person can add or edit an item by hand in the memory list.
* **Always visible.** A run that used memory says which items in the chat ("Using: you launch in Lagos first, from your team's memory"), so a surprising answer can be traced to its source.
* **Under the person's control.** Each item is short text with a kind (market, language, partner, comp, format, preference, other), a source (typed by hand, or offered by the agent and confirmed, with the chat it came from), who added it and when. Owners and editors add, edit, archive and delete; viewers read. An archived or deleted item is never used again. A memory list exists for the team and for each project (Project details).
* **Privacy.** Memory goes to the configured model like a message does and never to Qloo, which still gets only public entity names, place names and age bands (§6). Items are short facts about the work. The input warns against personal data, and the agent does not offer to remember it.

**New chats.** A new chat in a project asks one question before the first message: continue from the project, or start fresh. Continue is the default and builds on the current plan and project memory, as C4 says, and the chat says what it pulled in. Start fresh ignores project memory and the earlier plan, so the chat does not depend on them; it records `threads.fresh`. "Use an older plan" sets `from_output_id` to another plan. Team memory stays on in a fresh chat, since the standing facts are the point of it, with a switch to leave it out of that chat. Typed "start fresh" or "use an older plan" in any chat does the same from that message on.

**Open decisions.** Whether team memory is one switch or two in a fresh chat (the recommendation above is that fresh skips the project and keeps the team). Whether memory items expire. A cap on items per layer, so the context stays short. Whether viewers may suggest items.

## 4. Tools

Every tool returns `{ data, receipt }`. The model sees `data` and a receipt id, never raw Qloo payloads beyond what the tool chooses to return.

| Tool | What it does |
|---|---|
| `searchEntity(name, type)` | Qloo search. Returns candidates. Ambiguous results become an entity match question card. |
| `resolveBundle(title, comps, talent, tags)` | Describes the launch as a bundle of anchors: comps, talent and tags. The normal path before release, since the title is not in Qloo. After release the title joins the bundle as one more anchor. |
| `audienceBySegment(entities, place?)` | Age and gender skews as an affinity index per segment. |
| `lift(candidates, baseline)` | Lift over a neutral audience, from one ranking call. |
| `rankPlaces(entities, places)` | City or territory ranking by lift, one call. Cities from any region. A city with too few cells is not ranked. |
| `compareAudiences(a, b)` | Shared audience between two entity sets. Used for rival overlap, comp shelf, fan base bridge. |
| `crossTaste(anchors, type, candidates, baseline)` | Scores comparable titles of our kind against titles of other kinds, in one call, with the anchors' audience as the signal, such as fans of top selling musicians for a book. Planned. Worked on one live run, see [qloo.md](../backend/qloo.md#what-the-live-run-showed). The lift thresholds do not apply to these affinity values yet. `TODO(verify)` |
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
* **Confidence.** High, medium, lower, set per line from the anchors behind it: how many, how well Qloo knows each (for example `popularity` and tags present), and whether they agree. A title that is not in Qloo does not lower it by itself, since that is the normal case before release. Few or weak anchors, or a place that returned few results, do. The leading ideas are how many comps actually returned data, and whether the candidate ranking holds when each comp is left out (see [qloo.md](../backend/qloo.md#recommended-approach-subject-to-change), subject to change). The exact rule is still to be written and coded. **Blocker:** the rule must be written here, with its thresholds, before the first category agent ships, since it shows on every line of every output. Until then no code sets confidence except the tools that already compute it, and nothing hard codes a value.
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
| `projects` | team_id, category, name, mode (build, audit, rescue), kind, genre, places[], window, lead, comps, inputs jsonb, status, created_by, updated_at. Saved from the first message as a draft (`status` intake, no name, category or mode) that no list shows until the router has read it, then `active` |
| `threads` | project_id, name, base_output_id, from_output_id, fresh bool, team_memory bool (planned, default true), summary (planned, a long chat's summary), created_by, updated_at |
| `messages` | thread_id, role (user, agent, question, trace, output), body jsonb, seq; unique per thread and seq, which is where an event stream resumes |
| `outputs` | thread_id, project_id, kind (build, audit, scenario, rescue, date, partner), parent_id, title, brief jsonb, changed_ids[], headline, moves jsonb, confidence jsonb, data_as_of |
| `receipts` | run_id, thread_id, output_id (nullable), line_id, endpoint, input jsonb, returned jsonb, rule text, confidence, source (live, demo), called_at, call_id. A receipt belongs to the run that made the call; an answer (§3.6) has no output, so `output_id` is set only when a plan saves one. Today the table has `output_id` not null and no `run_id`, `thread_id` or `source`: change it before the first agent ships |
| `share_links` | output_id, token, enabled |
| `runs` | thread_id, agent, job, steps jsonb, state jsonb, qloo_calls int, tokens int, status (running, waiting, done, error), stop_reason, finished_at. One row per run segment; `state` holds what the next segment needs, such as the router's open question |
| `pins` | user_id, project_id; unique per pair. Three per person at most, kept by the API |
| `thread_reads` | user_id, thread_id, read_seq: how far one person has read a thread |
| `memory_items` | team_id, project_id (null for a team item), text, kind (market, language, partner, comp, format, preference, other), source (typed, suggested), source_thread_id, created_by, updated_at, archived_at. Planned, §3.7 |
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
GET    /teams/:teamId/overview    needs you, threads to pick up
GET    /me/pins               pinned project ids, newest first, three at most
PUT    /me/pins/:projectId    DELETE /me/pins/:projectId    (each answers the list after the change)
GET    /teams/:teamId/projects?category=    category id or all; drafts left out
POST   /teams/:teamId/projects    first message (text, mode and category hints, attachments); answers projectId and threadId at once, the router runs in the background
GET    /projects/:projectId   DELETE /projects/:projectId
POST   /projects/:projectId/threads   body `{ fresh?, teamMemory?, fromOutputId? }` (planned, §3.7)   GET /threads/:threadId
GET    /teams/:teamId/memory   POST   /teams/:teamId/memory   PATCH, DELETE /memory/:id   (planned, §3.7)
GET    /projects/:projectId/memory   POST   /projects/:projectId/memory   (planned, §3.7)
POST   /threads/:threadId/messages    typed text or a card answer; 202, the reply comes on the stream; 409 while a run is going
POST   /threads/:threadId/read    marks what is stored so far as read
GET    /threads/:threadId/events?after=    SSE: stored events after that seq, then live ones, then the run status
GET    /outputs/:id           GET /outputs/:id/evidence
GET    /outputs/:id/export    one page brief and appendix
GET    /projects/:id/compare?a=&b=
POST   /outputs/:id/share     PATCH /shares/:token (on or off)
GET    /s/:token              read only view
POST   /uploads               plan or results file, parsed to aggregates
```

Sign in details: codes are 6 digits, expire in 10 minutes, work once, and lock after 5 wrong tries. Accounts are linked by verified email, so the same person reaches one account by password, Google or code. Passwords are at least 8 characters.

Roles are enforced in a guard, never in handlers. `RolesGuard` runs after `SessionGuard`, reads `@Roles()` on the route and the route's team (the `:teamId` param, or the team that owns `:projectId` or `:threadId`), loads the caller's membership and answers 403 when there is none or the role is not listed. A project or thread that does not exist gives the same 403. A route with no `@Roles()` is denied. A team that does not exist and a team the caller is not on give the same 403.

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

SSE event types: `trace.step`, `question`, `message`, `receipt`, `output.created`, `project.updated`, `run.stopped`, `error`, and planned `memory.used` (the items a run started from, for the chat's "Using" line, §3.7). `project.updated` carries the name, category, mode and chat name once the router has read them, so the workspace fills its skeleton without a reload. Events stored in the transcript carry their `seq` as the SSE id. Shapes are `threadEventSchema` in `packages/schema`. A `trace.step` names the agent that took it (`router`, `film`, `books→film` for a consult). A question has an id, the asking agent, its card type (single, multi, text, split, date, file, confirm, match) and its options. A `message` carries its claims, each with the receipt ids behind it. A `receipt` event streams each receipt as the tool makes it. `run.stopped` ends every run segment with a reason: `finished`, `waiting` (on a question), `budget`, `steps` or `error`. The web app renders cards from the event, and posts the answer back as a message.

## 9. Web app

Routes: `/` the landing page (see §9.5), `/sign-in`, `/sign-up`, `/forgot-password`, `/email-code`, `/verify`, `/reset-password`, `/overview`, `/categories/:category/projects`, `/categories/:category/projects/:id`, `/threads/:id`, `/outputs/:id`, `/team`, `/invite/:token`, `/s/:token`.

`/overview` is the team's home and where sign in lands: the message box to start something new, Needs you (threads waiting on an answer, projects that are out with no results, new results, runs in progress) and threads to pick up. `/start?category=&mode=` is the same message box on its own page, before anything is saved; both values are optional hints. The sidebar has New project, Overview (with the Needs you count), Projects, the person's pinned and recent projects, and Team. `/categories/:category/projects` is the project list with a category filter: `:category` is a category id or `all`. The project lists show the person's pinned projects first, and one category's list has a help button beside the filter that opens what Oraqul tests there in a dialog. A project has one address, under its own category, so opening it under `all` or another category moves there. The project page is the workspace: the newest chat, the project's other chats beside it, the current plan above, and Project details (inputs, all outputs, plan lineage and compare, delete for owners) in a dialog. `/threads/:id` is the same workspace with that chat selected. `/projects`, `/projects/:id` and `/categories/:category` redirect to the new routes. The current team is the one in the `oraqul_team` cookie, never part of the address. The landing page header shows Open app instead of the sign in buttons when the visitor is signed in, and never redirects. The sign in pages take a `next` path and pass it between each other. `/verify` and `/reset-password` take the email from an `email` query value, set by the page before them. `/team` shows the team's members, a role select and remove for owners, pending invites, the invite form and sign out; the team comes from the sidebar switcher, remembered in an `oraqul_team` cookie and checked against the person's memberships. `/invite/:token` previews an invite and accepts it. A signed out visitor is sent to sign in and returned to the invite afterwards.

Output page tabs come from the output kind and the category pack: Summary, Audience, Assumptions, Plan, the category's signature tabs, Evidence, plus Changes, Results, Rival dates and Partner briefs where they fit. Could not test is listed at the end of Assumptions and Risks at the end of Plan; old `?tab=cannot` and `?tab=risks` links open those tabs. Scenarios have one way in: the chat. Typed text with "what if" or matching a pack's scenario matcher runs it, and a suggested next step can start one. Receipts open in a side drawer. A dock chat on the output page continues the thread on desktop; below 900px an Open chat button goes to it.

In the chat, an output is one line that opens its summary card in a dialog: bottom line, confidence, up to three moves with receipt chips that open the drawer, the verdict counts, and View full details. Answered question cards fold to one line with the answer, and the trace folds once it finishes, so the chat stays clean. Above the message box sit up to three suggested next steps built from the thread's plan and the project (a scenario not yet tried, results if none are in, a partner brief or rival date check not yet made). The message box takes text and files on every chat, not only the first. Typed corrections work at any point: "check my plan instead", "start fresh", "use an older plan", "compare with the last plan", or naming places, which replans with them.

Charts are inline SVG or CSS, each with a table toggle, a legend, and hover text. Colour never carries meaning alone: verdicts also carry an icon and a word.

### 9.1 Design system in code

The look is defined in the design system file. In code:

* Tokens live in `globals.css` as CSS variables, light on bare `:root`, dark in a guarded media query and again under `[data-theme="dark"]`, each with `color-scheme`. No component uses a literal colour.
* Fonts come from `next/font/google`: Space Grotesk for titles and the bottom line, Geist for text, Geist Mono for ids and keycaps.
* Category colour is set by a `data-cat` attribute and a `--cat` variable. It is used for icon tiles and strokes, and to tint project cards (design-system §3.3).
* A small component set lives in `packages/ui`: Button, Input, Chip, VerdictPill, Confidence, ReceiptChip, Card, Line, Tabs, TabNote, StartComposer, ProjectCard, SummaryCard, QuestionCard, Trace, Chart, ReceiptDrawer, Palette, Modal, Toast, Icon. VerdictPill and Confidence take the data value and draw the glyph and word, so colour cannot appear alone.

### 9.2 Start modes

There is no form. Work starts in one message box, on the overview or on `/start` (opened from New project in the sidebar or on a project list, with the category when opened from a category's list). New project is the one name for it, whatever the job: an audit or a fix is still a project. The box saves nothing. The first message, text, files or both, creates the project and its first thread (`POST /projects`), so a box nobody uses leaves no empty project. Three optional hints under the box, Make a plan, Check my plan and Fix one that missed, set a `mode` of `build`, `audit` or `rescue`; they only change the prompt and the default reading of the job. With no hint the agent reads the job from the message.

After sending, the person lands on the new chat at once. The project's name, category and chat name show as skeletons while the router reads the message, and fill in when it has (`project.updated`). A chat's name is a short summary of its first message; a chat made with New chat is named the same way once its first message is sent. The router never guesses the title, the category or the mode. It asks only when one of them is unclear: the category and the mode first, on one card that says back what it understood ("Looks like a music release or a game. What would you like to do?") with close options such as "Work on a song release" and "Work on a game launch"; then the title on a text card. Typing in the message box answers the open card too, for an answer the options miss. A message about something else ("what's my blood pressure") gets "Oraqul works on launches for films, series, music, books, podcasts and games, so I can't help with that here", and the draft stays hidden. The category agent asks which Qloo entity is theirs. Nobody is asked for the places or the category's extra input. The first reply says what was read, for example "Reading this as a new launch plan for “Tomorrow” (Music)." A correction typed later reruns what it changes: "check my plan instead" runs an audit, naming places replans with them.

### 9.3 Tabs, notes and search

* The tab list for an output comes from its kind and category pack. The client shows Summary, Plan, Assumptions and Evidence plus the current tab, and groups the rest under More. When there are five tabs or fewer, all show.
* Each tab has a note string, stored with the tab definition and shown above the content. Notes are product copy and are reviewed with the PRD.
* The search palette is client side over the team's categories, projects, outputs and fixed actions. It opens on Ctrl K or Cmd K and groups results by type. Number keys on the active question card pick the option with that index when no text field has focus.

### 9.4 Motion

Motion uses CSS only. New chat items are marked by a per thread seen count so a re render does not replay them. Agent text reveals word by word with a capped delay. The trace shows a progress bar from step count. Bars grow once on the first view of a tab. All durations drop to near zero under `prefers-reduced-motion`.

### 9.5 Public pages

The marketing and trust pages a signed out visitor sees. Decided, in this order of work: content outline per page, then design, then build.

**Launch set**

| Route | Holds |
|---|---|
| `/` | The pitch, the example answer, the three jobs. Exists |
| `/how-it-works` | Describe it, the agent asks only what it must, tests each assumption, ends with a bottom line and receipts |
| `/examples` | Three full read only sample outputs with every receipt openable: a film plan (make a plan), an Afrobeats tour (check my plan) and a podcast season (fix one that missed), picked with `?case=`. Built from the demo data and labelled as examples. The walkthrough video joins when it exists. `/example` redirects here |
| `/use-cases` | Make a plan, check my plan, fix one that missed, and the what if test. One page, a section for each |
| `/categories` | One page for all five categories: what is tested, where it is less certain, what the team brings. The same content as the in app help dialog |
| `/method` | How verdicts, lift, fit and confidence are computed, and what Oraqul never does (no forecasts). For people who judge the numbers |
| `/trust` | What data goes where: only public names, places and age bands to Qloo, results stored as aggregates, roles. Separate from Method because the readers differ (a marketer or judge against a reviewer or legal) |
| `/about` | Why it exists, the team, the global angle |
| `/privacy`, `/terms` | Required. Google sign in needs both links |

**Next:** `/developers` (the MCP server, with a quickstart), `/faq`, `/markets` (cities from every region ranked in one list). **Later:** `/compare` (against a generic chatbot and against audience dashboards), one page per category, `/changelog`, a blog.

**No pricing page for now**, and no mention of pricing anywhere until there is real pricing. Access is by creating an account.

**Built:** every page in the launch set except `/terms`. `/` runs: the hero (positioning line, app preview with the agent at work), the prompts people type, the problem against Oraqul's answer (prd §2), an agent run streaming its tool calls and red team step, a taste map that explains Qloo, the four jobs in launch order as sticky steps, a plan marked up with verdicts, one lift worked out, the five categories as sticky steps, an FAQ and the closing call to action. The data flow diagram lives on `/trust`. `/examples` renders the real output screen, read only, for three seeded outputs (`output:r1:1`, `output:r3:1`, `output:r6:2`); `?case=` and `?tab=` are checked at the page boundary, and the output screen keeps other query values when it changes tab; the receipt drawer there leaves out the endpoint and the response shape (`publicExample`). `/categories` and the in app help dialog read the same columns (`_workspace/category-coverage.ts`). `/method` draws lift, fit and rival overlap with the thresholds in §5. `/trust` and `/privacy` state only what the code does: cookies `oraqul_session` (30 days), `oraqul_team`, `oraqul_oauth`; Qloo, the model provider (Google Gemini today), Brevo, Google, Vercel and a VPS as processors. **Terms is deferred**: this is a hackathon project with no lawyer, and `/privacy` is a plain account of what the product does; add Terms and the privacy contact (`TODO(contact)` in `_marketing/privacy/privacy.tsx`) before Google sign in leaves testing mode. `/examples` has no video until a real one exists.

**Navigation.** A short header: Product (How it works, Examples, Method), Use cases, Categories, Sign in, Create account; Developers joins it when that page exists. The footer carries the rest in four columns: Product, Resources, Company, Legal. This follows what Linear, Notion, Harvey, Glean and Elicit do. As built: Product is a small menu (Escape or a click outside closes it and returns focus to it); below 900px one Menu button opens a panel with every link; below 600px Sign in moves into that panel so the bar stays on one row.

**Rules.** Marketing pages use the app's tokens and Space Grotesk headlines, with art and motion the app does not use (design-system §6, Marketing pages). They are one designed rhythm of light and dark bands, pinned with `.scheme-light` and `.scheme-dark`, not the visitor's theme, and work at 400px. Words follow design-system §10: launch is the umbrella word (launch planning, launch plan), each category names its own event (a film release, a book launch, a podcast season), and Project is what a user creates. An example page never shows raw Qloo data (see the open point on Qloo's terms in the overview).

## 10. Failure handling

| Case | Behaviour |
|---|---|
| Entity not found | Expected before release: describe it by its anchors (comps, talent, tags) and say so on the line. For a live title that is ambiguous, ask a match question. |
| Few or weak anchors | Say which, lower confidence, and say which anchor would help. |
| Place not ranked | Mark thin, lower confidence, keep it out of the headline. |
| Qloo error or timeout | Retry once. Then mark the line cannot test with the reason. Never fill from the model. |
| Call budget reached | Stop, return what is tested, list what was skipped. |
| Model names an entity not in the run's Qloo data | Output validator rejects it and the step reruns. |

## 11. Testing and evaluation

* **Unit.** Scoring functions, verdict rules, diff and changed marks, results gap logic.
* **Contract.** Recorded Qloo responses per tool. A live smoke test runs against our key.
* **Golden runs.** Per category, three fixed inputs (build, audit, rescue) with expected verdicts, run on the plan pipeline (§3.2) over recorded Qloo responses in `packages/engine/fixtures`. Run on every change. A category does not ship without its golden runs, and the second category is not started until Film's pass with the grounding check and refusal tests.
* **Grounding check.** Every entity and number in an output must trace to a receipt. Fails the build if not.
* **Refusal tests.** Forecast, pricing and send requests are refused with the right message.
* **Coverage tests.** Cross-domain taste tests per category, Nigerian titles, Lagos against no location, podcasts and games, diaspora ranking.
* **UI.** Headless browser pass over every tab of every output in every category, checking for errors and for the words "undefined" or "NaN". Include the start message box and its three hints, the next step chips, the More tab toggle, the search palette, light and dark, and a 400px width with no horizontal scroll.
* **Comprehension.** A short test with real launch marketers on the prototype, including Nigerian users on mid range Android, before wording is locked.

## 12. Deployment

Vercel for web. VPS with Docker Compose for API and Postgres. Environment variables for the Qloo key, model key and session secret. Backups of Postgres nightly. Public repository with an open source licence and a README that runs the demo locally.

## 13. Build order

1. Live Qloo tests and notes on real coverage.
2. `engine` with receipts and verdicts, tested against recorded responses.
3. Runtime with the router and the Film agent, end to end through plan, audit, scenario and rescue.
4. Web: design tokens and components, chat, trace, outputs, evidence, receipts, the start message box, tab notes.
5. Music agent, then Books, Podcasts, Games as packs.
6. Accounts, share, export, compare.
7. MCP server, evals, demo video.
