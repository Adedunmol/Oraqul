# Oraqul: Technical Spec

Read with the PRD and the design system file. Qloo endpoint names and parameters below follow the prototype and secondhand notes. Confirm them against Qloo's docs and our own key before building.

## 1. Architecture

```
Next.js web app  ->  API (NestJS, Node, VPS)  ->  Agent runtime  ->  Qloo client (Qloo API)
                           |                          |
                        Postgres                  Model (configured provider via Vercel AI SDK)
```

* **Web.** Next.js, deployed on Vercel. Talks to the API only. Streams agent events over server sent events.
* **API.** NestJS on a VPS. Owns auth, teams, projects, threads, outputs, share links, export.
* **Agent runtime.** A module in the API process. Runs the router and the category agents.
* **Qloo client.** `packages/engine` calls the Qloo API directly. No separate service.
* **Postgres.** All state. Docker for local and deploy.
* **MCP server.** Exposes the engine tools to other agents. Same code as the agent toolbox.

## 2. Monorepo

```
apps/web            Next.js front end
apps/api            NestJS API and agent runtime
packages/engine     Qloo client, scoring, verdicts, receipts (pure TypeScript, no framework)
packages/packs      One folder per category: film, music, books, podcasts, games, shows
packages/schema     Zod schemas and shared types: brief, output, receipt, events
packages/mcp        MCP server over the engine
packages/eval       Golden cases and expected results
```

Rules: `engine` and `packs` never import from `apps`. `schema` has no dependencies. The web app imports types from `schema` only.

## 3. Agents

### 3.1 Router

Input: the first message (text and the words of any small text file) and the `/start` hints. Output: the project's title, its category, the start mode (build, audit, fix), and so the category agent to run. It does not call tools and it never guesses: a value counts only when the person's own words say it, which code checks by finding the model's quote in what they wrote. When the category or the mode is unclear it asks one `single` card, worded from what it read, with two to four close options that each settle the category, the mode or both, and the person may type their own answer instead. When only the title is missing it asks a `text` card. A message that is not about launching a film, series, music, book, podcast, game or live show gets a fixed refusal. A concert, a gig or a live show can be a music release or a single live show, so the router asks which with one `single` card; stand-up, a club night or a stage play goes straight to Live shows. Once all three are known it states the job in its first reply and hands the project to the category agent. The model is configured, not fixed (backend/llm.md); with no model key a scripted router takes only what is plainly written and asks about the rest.

**Front door for an active project.** Once the project is saved, every later message passes a check before the category agent sees it. A message with nothing to do with launching or marketing a film, series, music, book, podcast or game gets the same fixed refusal as at the start. A message that may be about this project, or may be a new idea, gets one `single` card of two or three close readings, such as "Check how this plays in Lagos" or "Start a different project", and the person may type their own. A message that plainly follows the conversation goes through. With no model key the check passes everything. The refusal wording is fixed in code. The model may word the card's options, but never decides which agent runs: the project's category does.

The jobs a run can do are build, audit, fix, scenario, date, partner and creative. The first three are the start modes; the others are follow ups inside a project. The creative kit is asked for in plain words ("make the creative kit for Lagos on Instagram"), which code reads, so no model decides it. A mode chosen with the start page hints (Check my plan, Fix my plan) is kept when the plan's own words say launch and release all through, since every plan does.

### 3.2 Category agent

One per category. Each is a configuration of the same runtime:

| Part | What it holds |
|---|---|
| System prompt | Role, tone, refusal rules, how to read the category's inputs |
| Assumption checklist | Stated and unstated assumptions to look for in that category |
| Plan modules | Which modules a plan can carry and the rules that pick them (`pickModules`), section titles, the budget convention |
| Query catalog | The Qloo queries it runs and their context (§4.1, §4.2) |
| Tool allowlist | Which engine tools it may call |
| Coverage | Tests, also handles, and what the team brings lists shown on the category page |

A what-if is not a preset: the launch runtime changes places, comps, age or gender on the plan's saved inputs and reruns it. Results are read by the launch runtime (`results-read.ts`), and the launch plan and audit report shapes are in `packages/schema` (§6.1, §6.3).

The runtime is shared by all six and has two paths:

* **Plans, reports and the briefs on them (build, audit, fix, and scenario, date, partner) run a fixed pipeline.** Code sets the steps and their order, so the same input always runs the same tests: read the input into assumptions and anchors, choose a test for each assumption from the pack, run the tests, compute verdicts and scores (§5), write the brief, check it. The model only reads the input and writes the brief from results already computed. Before anything is searched, an analyst step reads what the request needs: what was asked, the goals and constraints, a few checks a good answer must pass, and what the person left unsaid but the request makes clear (a home market from a country, a genre from a logline). Those inferences fill only empty fields, are limited to values code can use (a city in the city table, a Qloo age band), steer the queries, and show on the plan as assumptions. They are never evidence and never override anything the person wrote. After the first round of queries, a research check judges what the findings cover and may add up to three queries from the category's catalog for a thin check; code validates the picks and the call budget, and the plan stores each check's coverage and the findings behind it. A build asks a question only when there is nothing at all to plan from. Repeatable runs are what make a plan trustworthy and what golden runs (§11) test.
* **Conversation runs a tool loop.** Follow up questions, suggestions and other answers (§3.6), and clarifying questions let the model choose the next tool call, because their route cannot be fixed in advance. Code still runs each call, makes the receipts and computes every number.

Both paths share the tools, receipts, scoring and grounding check.

### 3.3 Stress test

A model reviews each plan draft against the request (the red team, §6.1), but it never checks a finding against Qloo: it sees only findings already computed. The stress test of a result is in code. A ranked line is rerun with each anchor left out, its verdict and confidence follow from whether the answer holds (§5.1), and a brief that rests on one comp says so.

### 3.4 Cross category rule

Agents do not call each other. Two bounded exceptions. The first is a fixed step and not a model's choice: when a Books brief names a screen title Qloo knows, the Books launch asks the Film side one bounded question about it (`filmConsult`, §4.5). It runs the Film agent's own tests on the title, the audience skew (`audienceBySegment`) and the ranking of the book's cities (`rankPlaces`), and returns two findings with their receipts, which the plan can cite beside the adaptation bridge. The generic tool loop still lists `film` in the Books pack's `consults` for conversation. The second exception is a model's choice from offers code makes: a category config lists the questions another side could answer from names the team gave (Film's soundtrack artists to Music, Books' other screen titles to Film, Games' collabs, Podcasts' guests as artists), the research check may pick up to two, and `launch/consult.ts` runs the other side's audience and city tests on the named entity. The model cannot add an offer. A consult spends its caller's budget.

### 3.5 Loop limits

Max steps per run, max Qloo calls per run (call budget, `QLOO_CALL_BUDGET`), and a stop rule. The budget is per run, not per thread or team: a run is one `runs` row, so a run that resumes after a question starts a new budget, and a consult spends its caller's. The stop rule: stop when no candidate beats the current plan by a set margin, or say what input would change the verdict. Follow up requests are meant to rerun only the lines whose inputs changed. Today a what-if reruns every query.

### 3.6 Plan, report and answer

A category agent replies in one of three ways. A plan (build, scenario, and the plan a fix writes) is a saved output with a launch plan and receipts, as in §6.1. A report (audit) is a saved output with an audit report and receipts (§6.3): a plan someone else wrote, tested one belief at a time, which is not itself a plan. The small briefs (date, partner) are saved outputs on a plan. Anything else the person asks inside a project, a follow up question, a request for suggestions or recommendations, is an answer: a short message in the chat whose claims each carry a receipt, with no output page and no saved brief. When the agent cannot tell which the person wants, it asks "Do you want a plan for this, or just an answer?" on a card instead of drafting a full plan nobody asked for. An answer may offer a plan as the next step. Refusals, no forecasts and no invented numbers (§5) apply to both.

### 3.7 Memory

Memory is context the agent starts from so the person does not repeat themselves. It has two layers, narrowest first:

| Layer | What it holds | Who sees it | Lives |
|---|---|---|---|
| Chat | Everything said in this chat, its replies and its outputs | This chat | The thread's messages. Once more than 40 lines are not yet summarised, the older ones are folded into `threads.summary` and a reply reads the summary then the newest 20 to 40 lines. The chat says so once it is long |
| Project | A short list of key points and decisions moving forward ("Dropped Lagos; opening in London first"), and a pointer to each plan the project has | Every chat of the project that uses it | `memory_items` with a project, beside `projects.inputs` and `outputs` |

There is no team layer. Nothing is remembered across projects.

**Rules**

* **Memory is context, never evidence.** A claim, a number, a score or a verdict still comes from a receipt run in this run (§5, hard rules 1 and 2). A remembered fact may steer what to test and is never cited as the reason a line holds. The model is told so in the shared base prompt.
* **Most specific wins.** This message beats this chat, which beats the project. When a message changes something memory says, the agent follows the message.
* **It keeps itself up to date.** After a finished exchange in a chat that uses project memory, a memory writer reads the notes kept and the exchange, and adds, updates or removes notes: a city dropped, a window moved, a budget, a partner signed. It keeps durable facts about the work, never questions, small talk, anything Qloo measured, or personal details. The chat shows a quiet "Remembered: …" line under a reply that changed a note. Code checks every change: an update or remove must name a note that exists, a repeat is dropped, a note is at most 280 characters, and a project keeps 30 notes at most.
* **Plans are pointed at by code.** Each plan, scenario, audit or fix is remembered as a `plan` item. A newer output from the same chat replaces that chat's earlier item; an output from another chat sits beside it, so two alternatives are both remembered. A plan item can be forgotten and cannot be rewritten.
* **Under the person's control.** Project details lists what the project remembers. Owners and editors rewrite or forget a note; viewers read. A forgotten note is never used again.
* **Privacy.** Memory goes to the configured model like a message does and never to Qloo, which still gets only public entity names, place names and age bands (§6).

**New chats.** A new chat asks one question before the first message: use the project's memory, or stand alone.

* **Uses project memory** (the default). It starts on the project's current plan (`threads.base_output_id` and `from_output_id`) and reads the plan and the notes, so the first message is a follow up, not a rebuild. The chat says nothing about what it pulled in; it just knows.
* **Standalone** (`threads.fresh`). It stays in the project but sees no plan, no notes and no brief, and it writes nothing back to the project's memory, so wild questions stay out of the project's own thinking. It knows the category and the project's name. It talks on the tool loop: Qloo can ground what it says about taste, audience and place, and it makes no plan. It is a conversation, so it is the one place a citation the model made up does not fail the run: the answer goes through as plain talk with only the real citations kept, and launch knowledge is not labelled. Any claim about taste, audience or place still needs a real receipt, and the gate lets in basic questions about the project's subject.

## 4. Tools

Every tool returns `{ data, receipts }`, one receipt per Qloo call it made, and `data` names the receipt behind each item. The model sees `data` and the receipt ids, never raw Qloo payloads beyond what the tool chooses to return.

| Tool | What it does |
|---|---|
| `searchEntity(name, type)` | Qloo search. Returns candidates. Ambiguous results become an entity match question card. |
| `resolveBundle(names, types)` | Describes the launch as a bundle of anchors by finding each comparable title in Qloo, one search each. A year in brackets ("Lionheart (2018)") settles two titles of one name when only one was released that year, and an IMDb id or a Spotify artist or show link is looked up directly, with no name search. An anchor counts only on one exact name match; several are a pick for the user, none is not found. The normal path before release, since the title is not in Qloo. After release the title joins the bundle as one more anchor. Talent and tags are not anchors: a person is rejected as a signal and tags alone are noisy ([qloo.md](../backend/qloo.md#behaviour-to-know)). |
| `audienceBySegment(entities, place?)` | Age and gender skews as an affinity index per segment. |
| `lift(entities, type, candidates, baseline)` | Lift of candidate titles over a baseline of other kinds for the anchors' audience, from one scoring call, then one rerun per anchor left out (§5.1). Verified for books, films and series. |
| `rankPlaces(entities, places)` | City ranking by mean cell affinity, from one heatmap call over every city's box, then one rerun per anchor left out (§5.1). Any city: a table city (`places.ts`) or one the tool looks up in Qloo as a locality (one `/search` call, a receipt of its own), centred on the middle of its boundary; a city Qloo has no place for, or with fewer than 25 cells, is not ranked. A lookup picks the place in the launch country, else the most popular, and at most 8 cities are looked up per run. Every city gets the same box (about 55 by 65 km), which returned 200 to 1,100 ranked cells for large cities and too few for thin markets; the box is a design choice that keeps means comparable. |
| `scoreRivals(entities, type, rivals, leaveOneOut?)` | Rival overlap: each rival scored against the anchors in one call of the rivals' entity type, overlap = affinity × 100 (§5), with leave one out unless it is turned off. Built for the rival date check, for the Games fan base bridge (§4.3), which scores each kind of media in its own call, for the Podcasts cross promotion list (§4.4), and for the Books adaptation bridge (§4.5), where a rival can also be a book. |
| `crossTaste(anchors, type, candidates, baseline)` | Scores comparable titles of our kind against titles of other kinds, in one call, with the anchors' audience as the signal, such as fans of top selling musicians for a book. Planned: the Books bridge scores each kind of media in its own call instead (§4.5). The lift thresholds do not apply to these affinity values yet. `TODO(verify)` |
| `partnerFit(entities, type, take, releasedFrom?, exclude?)` | The films, series, brands or podcasts the anchors' audience likes most, from one open call. Not used by Film builds any more: an open list drifts to what is popular overall (§4.1). |
| `findTaste(entities, type, tags?, city?, ages?, gender?, rating?, popularity?, country?, yearFrom?)` | What the anchors' audience likes in one entity type (artist, film, series, podcast, book, brand, place, video game, person), shaped by context, from one call. Every shaping parameter is verified in [qloo.md](../backend/qloo.md). For places the city is where results are; otherwise it biases the ranking. The release country is a full name. `gender` is the brief's "mostly women" or "mostly men", sent for films, series, artists, podcasts, books and games, and the first thing dropped when the list comes back empty. `rating` keeps films and series to family or adult-only releases. `popularity` is a band for the brand lookup by category, so it returns mid-size names. With no anchors it needs a city and an age band, and lists what that age band likes in that place (used for a thin brief, below). |
| *Thin briefs* | When the team names fewer than three comps itself, every category also asks what the age band likes in the team's first two cities with no title behind it (`findTaste` with no anchors): artists and brands, at most four calls, only when the brief gives an age band. Each list is its own finding (`f-region-<city>-artists` or `-brands`) at lower confidence, labelled as taste for the place and not for the comps, and never mixed into what the comps' audience likes. Series and films are not asked: the lists were generic for Lagos. |
| `resolveTags(phrases)` | A phrase and the urn prefix it must start with to a Qloo tag, one lookup each. Brand categories need the parent type `urn:entity:brand`. No match is null, never a guess. |
| `themeTags(entities, kinds)` | The theme, archetype or audience tags that best describe the anchors, one call per kind. |
| `bookProfiles(entities)` | What Qloo lists for each book: publication year, pages, series, genres, formats and age ranges, from one lookup. Nothing is scored. Verified in [qloo.md](../backend/qloo.md). |
| `gameProfiles(entities)` | What Qloo lists for each game: platforms, typed tags (genre, store category, gameplay, tone), age rating, developer and publisher, from one lookup. Nothing is scored. Verified in [qloo.md](../backend/qloo.md). |
| `topicMap(entities, rivals, take?)` | The topics a show's audience carries that rival shows' audiences do not, for the podcast topic map: one `/v2/analysis/compare` call with the anchors against the rivals. Each side lists every tag its group carries with a count of the group's shows that carry it; yours are the subject tags only your side lists, shared are on both sides, the rivals' only theirs (§4.4). Verified live in [qloo.md](../backend/qloo.md). |
| `filmProfiles(entities)` | What Qloo lists for each film or series: release year, content rating, genres, subgenres and themes, from one lookup. Nothing is scored. Verified in [qloo.md](../backend/qloo.md). |
| `momentum(entity)` | Trend over time, where Qloo supplies it. Not built: the newest point showed no velocity for the three types that answer, so there is nothing to lean a line on yet. |
| `explain(receiptId)` | Reads back a receipt in plain words. Not built. |
| `applyScenario(brief, change)` | Marks dependent lines, reruns only those, returns the diff. Not built. |
| `compareResults(brief, results)` | Planned against actual shares, the largest negative and positive gaps. Not built. |
| `toMarkdown(output)`, `toDocx(output)` | The plan as Markdown or Word, in `apps/api/src/outputs/export.ts`: grounded lines footnoted to findings, playbook lines labelled, an evidence appendix, no raw Qloo data. PDF is built by the API too. |
| `draftMessage(partner, evidence)` | Not a separate tool. The partner brief (`runPartnerBrief` in `launch/follow-ups.ts`) drafts the message from the partner's fit and the plan's findings, for the person to review and send. Oraqul never sends. |

Tools live in `packages/engine/src/tools` and are the one toolbox for the agents and the MCP server. External tools (web search, page reader) may supplement but never replace Qloo evidence, and are labelled as such on the line.

### 4.1 Film query catalog

Stage 1 of every Film reply (direction: findings, then the reply). The model shapes the queries; code runs them and turns each result into a **finding**: a sentence built by code from one call, with the entities Qloo returned, the numbers the sentence states, a confidence (§5.1), a verdict when it tests a team decision, and the call ids behind it (`findingSchema`). Each finding streams into the chat as a `finding` event. The catalog is `FILM_QUERIES` in `packages/packs/src/film/catalog.ts`; which run is `queriesFor` from the plan's modules (§6.1).

| Query | Runs for | Call | Shaped by |
|---|---|---|---|
| `audience` | core | `audienceBySegment` on the comps; also tests the team's age band and gender (§5.2) | — |
| `markets` | core | `rankPlaces` over the team's cities plus up to 4 nearby table cities, which only ever appear as Worth a look | — |
| `themes` | core | `themeTags`, theme and archetype, then `filmProfiles` on the comps (one lookup) for a second finding: the genres most comps carry and their ratings, which says when the comps may not fit together, or when comps are rated for adults for a release the brief calls family | — |
| `shows` | core | `findTaste` tv_show per city | diaspora cities first, series from the last 6 years |
| `cinemas` | core, unless streaming | `findTaste` place with the movie theater category per city | the team's cities |
| `music` | partnerships | `findTaste` artist per city | a music scene tag (pack default by country of origin, or the model's), the team's age band. No scene: not asked, and Gaps says why |
| `brands` | partnerships | per city: the model proposes up to 4 brands that could realistically partner; code resolves them and `findTaste` brand ranks only those (`only`, sent as `filter.results.entities`). Falls back to one call per category (`urn:tag:genre:brand:*`, never luxury) when no candidates resolve. 4 calls at most | brand candidates the model names per city, or brand categories |
| `films` | placement | `findTaste` movie, then `topicMap` (§4) over the films it lists (3 to 6) when there are at least 3 | release country (full name), films from the last 3 years, or a genre tag with no country. The comparison reuses the films request from the cache, so it adds one call, and it gives a second finding: the topics the comps carry that those recent films do not (positioning) |
| `podcasts` | publicity | `findTaste` podcast | a podcast genre tag, one city |
| `community` | community | `findTaste` place per kind and city, 8 calls at most | place kinds such as church and university |
| `games` | partnerships | `findTaste` videogame per city, the home market and one away | a city. No tag: a game genre tag returned nothing (checked live), so the list rests on the city alone |
| `venues` | community | `findTaste` place with the bar and night club categories per city, 6 calls at most | place kinds. Hotels, malls, squares, police and unions are dropped from the lists, as for cinemas |
| `areas` | community | no extra call: `rankPlaces` reads the heatmap cells already fetched for `markets`. For each neighbourhood the model names (a name and a centre inside the city box, 5 a city at most), the nearest 8 cells within 0.1 degrees are compared with the city's mean. Fewer than 3 cells gives no reading. Confidence is capped at medium | neighbourhoods per team city |

The model (`ModelQueryPlanner`) may change the scene, categories, genres, place kinds and which of the team's cities each query uses. Code keeps only cities on the team's list, Worth a look cities from the city table, and short phrases with no personal detail, and resolves every phrase through `resolveTags`. With no key, `ScriptedQueryPlanner` uses the pack's defaults. The same brief gives the same queries.

### 4.2 Music query catalog

Stage 1 of every Music reply, in the same two stages as Film (§4.1): the model shapes the queries, code runs them and turns each result into a finding. The catalog is `MUSIC_QUERIES` in `packages/packs/src/music/catalog.ts`; which queries run is decided by the plan's modules (§6.1).

**Anchors.** The artist, when Qloo finds it by exact name (an ambiguous name is settled in code by country, then popularity, and the plan says which), plus up to four sound-alike artists the team named. Below three sound-alikes the model proposes more, kept apart and checked in Qloo. The artist is an anchor but not a comp: it is not listed under Comps in the plan. A debut that Qloo does not know is planned from the sound-alikes, and the plan says that is what it rests on. With no sound-alikes, the genre's scene tag stands in, the audience line is labelled the genre's, and its confidence is lower (§5.1, Stand-ins). Checked live on one Afrobeats brief ([qloo.md](../backend/qloo.md)); other genres and markets are not probed one by one; thin data shows as a gap or lower confidence.

| Query | Runs for | Call | Shaped by |
|---|---|---|---|
| `audience` | core | `audienceBySegment` on the anchors; also tests the team's age band and gender (§5.4) | — |
| `markets` | core | `rankPlaces` over the team's cities plus up to 4 nearby table cities, which only ever appear as Worth a look. Its lifts also feed the route score (§5.4) | — |
| `support` | support | `findTaste` artist per tour city, the anchors excluded. Acts the team has already booked are not excluded in Qloo: the writer is told which they are and does not propose them again | a scene tag (the model's, or the pack default by country of origin), the team's age band. No scene: not asked, and Gaps says why |
| `brands` | partnerships | As Film §4.1: the model proposes up to 4 brands per city that could realistically partner, code resolves them, `findTaste` brand ranks only those. Falls back to one call per brand category | brand candidates per city, or brand categories |
| `podcasts` | publicity | `findTaste` podcast | a podcast genre tag, one city |
| `shows` | sync | `findTaste` tv_show per city | the last 6 years |
| `films` | sync | `findTaste` movie | release country (full name) or a genre tag, films from the last 3 years |
| `areas` | community | No extra call: `rankPlaces` reads the heatmap cells already fetched for `markets`, as in Film §4.1 | neighbourhoods per team city, named by the model |
| `community` | community | `findTaste` place with the university category per city, 8 calls at most | — |
| `venues` | tour | `findTaste` place with the night club and concert hall categories per tour city, 6 calls at most | place kinds. Checked live for an Afrobeats artist: real venues in Lagos and London, though Lagos concert halls are few |

Not in the catalog: `themes` (`themeTags` works on an artist signal, but its theme and archetype tags read as generic for music), and radio or playlists (not in Qloo). The planner is the same: with no key the pack's defaults run, and code keeps only the team's cities, table cities for Worth a look, and short phrases.

### 4.3 Games query catalog

Stage 1 of every Games reply, in the same two stages as Film (§4.1): the model shapes the queries, code runs them and turns each result into a finding. The catalog is `GAMES_QUERIES` in `packages/packs/src/games/catalog.ts`; which queries run is decided by the plan's modules (§6.1), which depend on the launch kind.

**Anchors.** The game, when Qloo finds it by exact name (an ambiguous name is settled in code, and the plan says which), the franchise (earlier games the team names), and up to four comparable games the team named. Below three, the model proposes more, kept apart and checked in Qloo; when it proposes none (no model key, or a one-line brief), code takes well known games from `FALLBACK_COMPS` for the genre words and the launch kind. A name Qloo has no exact match for stands in with the nearest game it has, and the plan says so. The person is never asked for comps. The game is an anchor but not a comp. A debut Qloo does not know is planned from the comparable games, and the plan says so. Only when none of these resolve does the genre tag stand in, labelled the genre's, with lower confidence (§5.1, Stand-ins). Checked live ([qloo.md](../backend/qloo.md)).

| Query | Runs for | Call | Shaped by |
|---|---|---|---|
| `audience` | core | `audienceBySegment` on the anchors; also tests the team's age band and gender (§5.2) | — |
| `markets` | core | `rankPlaces` over the cities the team named and the cities its region words stand for (up to 8), plus up to 4 nearby table cities, which only ever appear as Worth a look. With no city or region named, the launch kind's five usual markets are ranked and shown as the plan's regions | cities, `REGION_CITIES` |
| `profile` | core | `gameProfiles` on the anchors (20 at most). Tests the platforms and the store tags (§5.6) | — |
| `fanbase` | collabs | For each of music, series, anime, film, brand, podcast and game: `findTaste` (4, the anchors excluded), then, only for a medium with a collab the team named, one `scoreRivals` of that type over those and the collab, without leave one out (confidence is capped at medium), 12 at most. A medium with no collab is ranked from the `findTaste` affinities, which match the scored ones. Overlap = affinity × 100. A collab is found by name with `searchEntity` and belongs to the medium of its entity type. Anime is asked first and excluded from series | the team's age band; an anime tag and a "video games" podcast tag, resolved with `resolveTags` (a medium whose tag does not resolve is not asked, and Gaps says why) |
| `tags` | store | `themeTags` for theme and audience on the anchors | — |
| `brands` | partnerships | As Film §4.1: the model proposes up to 4 brands per city that could realistically partner, code resolves them, `findTaste` brand ranks only those. Falls back to one call per brand category, once when no city is named | brand candidates per city, or the categories beverage and telecom |
| `podcasts` | publicity | `findTaste` podcast with the video games tag; not asked without the tag | one city, the team's age band |
| `creators` | creators | `findTaste` person, only while `CREATORS_GROUNDED` is true. Otherwise Gaps says creators were not measured | the team's age band |
| `community` | community | `findTaste` place with the university category per named city, 8 calls at most | — |

Not in the catalog: esports and arcade venues (no place category for them has been verified), momentum and trends (no tool), and Steam or store data (not in Qloo). A rival game's overlap is the rival date check, with `scoreRivals` of type video game. The planner is the same as Music's: with no key the pack's defaults run, and code keeps only the team's cities, table cities for Worth a look, and short phrases.

**Fan base overlap.** Qloo scores one entity type per call, and scores from separate calls are never compared (qloo.md). So a fan base is ranked only against the others of its own medium, in the call that scored them, and the bridge groups its rows by medium. A collab the team named is scored in that same call, so it shows as a ranked row. It does not move a bar: a what-if that adds a collab reruns the plan and adds the row.

### 4.4 Podcasts query catalog

Stage 1 of every Podcasts reply, in the same two stages as Film (§4.1): the model shapes the queries, code runs them and turns each result into a finding. The catalog is `PODCASTS_QUERIES` in `packages/packs/src/podcasts/catalog.ts`; which queries run is decided by the plan's modules (§6.1), which depend on the launch kind and the format.

**Anchors.** The show, when Qloo finds it by exact name (an ambiguous name is settled in code, and the plan says which), the earlier shows by the same host or network, and up to four comparable shows the team named. Below three, the model proposes more, kept apart and checked in Qloo; when it proposes none (no model key, or a one-line brief), code takes well known shows from `FALLBACK_COMPS` for the subject words. A show the team named as a swap or a rival is theirs already and is never added as a comp. The person is never asked for comps. The show is an anchor but not a comp. A new show Qloo does not know is planned from the comparable shows, and the plan says so. Hosts are never signals (a person is rejected as one, qloo.md). Checked live on one true crime brief ([qloo.md](../backend/qloo.md)); other subjects are not probed one by one.

| Query | Runs for | Call | Shaped by |
|---|---|---|---|
| `audience` | core | `audienceBySegment` on the anchors; also tests the team's age band and gender (§5.2) | — |
| `markets` | core | `rankPlaces` over the cities the team named and the cities its region words stand for (up to 8), plus up to 4 nearby table cities, which only ever appear as Worth a look. With no city or region named, the five usual markets are ranked and shown as the plan's markets | cities, `REGION_CITIES` |
| `topics` | core | `topicMap` (§4): one `/v2/analysis/compare` call with the anchors against the rival shows the team named, or with none the shows `findTaste` lists in the genre (4 at most), labelled as such. Fills `brief.topics`. Each topic the team named is tested (§5.8) | a podcast genre tag resolved with `resolveTags`; without one, only named rivals can be compared |
| `crosspromo` | crosspromo | `findTaste` podcast (4, the anchors excluded), then one `scoreRivals` of type podcast over those and any show the team named as a swap, without leave one out, 12 at most. Overlap = affinity × 100. A named show is found by exact name with `searchEntity`; several exact matches are not guessed. The rows go to `brief.fan` with medium podcast | a podcast genre tag (soccer for football outside the US, topped up with sports when it lists fewer than three shows), one city, the team's age band |
| `brands` | partnerships | As Film §4.1: the model proposes up to 4 brands per city that could realistically sponsor a new show, code resolves them, `findTaste` brand ranks only those. Falls back to one call per brand category, once when no city is named | brand candidates per city, or the categories beverage and telecom |
| `guests` | guests | `findTaste` person, only while `GUESTS_GROUNDED` is true. Otherwise Gaps says guests were not measured | the team's age band |
| `crossover` | publicity | `findTaste` artist and `findTaste` tv_show, one city: episode angles, not partners. Off while `CROSSOVER_GROUNDED` is false: the live lists had no subject context and drifted (qloo.md), so Gaps says they were not asked | one city, the team's age band |

Not in the catalog: chart positions, downloads and ratings (not in Qloo), and live-show venues (no place category for them has been verified). Live shows are placed in the markets ranking. A rival's overlap is the rival date check, with `scoreRivals` of type podcast. The planner is the same as Music's: with no key the pack's defaults run, and code keeps only the team's cities, table cities for Worth a look, and short phrases.

**Topic map.** One comparison call, never two (qloo.md: scores from separate calls are not comparable). Qloo lists, for each group, every tag its shows carry with the number of its shows that carry it. Only subject tags count (`theme`, `keyword`, `subgenre`, `genre`; not a show's style, host, audience or content type), and topics are told apart by name, since one topic appears under several namespaces. A topic only your side lists is yours, one on both sides is shared, and one only the rivals' side lists is theirs. The weight of a yours topic is the share of your shows that carry it against the mean share of a rival topic among the rival shows, for ordering and for the size of the tag on screen; it never decides who owns a topic. Verified live on a true crime brief (2026-10-20); other subjects are not probed one by one.

### 4.5 Books query catalog

Stage 1 of every Books reply, in the same two stages as Film (§4.1): the model shapes the queries, code runs them and turns each result into a finding. The catalog is `BOOKS_QUERIES` in `packages/packs/src/books/catalog.ts`; which queries run is decided by the plan's modules (§6.1), which depend on the launch kind, the route, the readership and the formats.

**Anchors.** The book, when Qloo finds it by exact name (an ambiguous name is settled in code, and the plan says which), the earlier books by the author or in the series, and up to four comparable books the team named. The author is never an anchor: a person is rejected as a signal (qloo.md). Below three, the model proposes more, kept apart and checked in Qloo; when it proposes none (no model key, or a one-line brief), code takes well known books from `FALLBACK_COMPS` for the genre words. A title the team named for the screen angle, or as an earlier book, is theirs already and is never added as a comp. A book is the same book with or without the series mark Qloo adds to it ("Fourth Wing (The Empyrean, #1)"). The person is never asked for comps. The book is an anchor but not a comp. A debut Qloo does not know is planned from the comparable books, and the plan says so. Checked live on four briefs (literary fiction, romantasy, self help, middle grade); other genres and markets are not probed one by one; thin data shows as a gap or lower confidence.

| Query | Runs for | Call | Shaped by |
|---|---|---|---|
| `audience` | core | `audienceBySegment` on the anchors; also tests the team's age band and gender (§5.2) | — |
| `markets` | core | `rankPlaces` over the cities the team named and the cities its region words stand for (up to 8), plus up to 4 nearby table cities, which only ever appear as Worth a look. With no city or region named, the launch kind's five usual markets are ranked and shown as the plan's markets | cities, `REGION_CITIES` |
| `themes` | core | `themeTags`, theme and archetype, on the anchors | — |
| `shelf` | comps | `bookProfiles` on the anchors (20 at most), then `findTaste` book (the anchors excluded), whose first six, after the anchors' own series and omnibus entries are left out and one book stands for each series, are the shelf. Also tests each comp the team named for how recent it is (§5.10). Overlap = affinity × 100 | a book genre tag resolved with `resolveTags`, the home city, the team's age band, a first publication year five years before the launch and never later than today |
| `bridge` | adaptation | For series and for films: the titles the team named and the planner's or the pack's choices (6 at most), found by exact name, then one `scoreRivals` of that type over them without leave one out (confidence is capped at medium). A named title is found as a series first, then as a film; of several same-name titles the best known is used. Podcasts come from the `podcasts` call below. Rows go to `brief.bridge` by medium | the genre, `SCREEN_CANDIDATES`, the model's titles |
| `podcasts` | publicity | `findTaste` podcast with the books genre tag; not asked without the tag. Shared with the bridge | the team's age band |
| `brands` | partnerships | As Film §4.1: the model proposes up to 4 brands per city that could realistically partner with a book launch, code resolves them, `findTaste` brand ranks only those. Falls back to one call per brand category, once when no city is named | brand candidates per city, or the categories beverage and telecom |
| `bookshops` | events | `findTaste` place with the book store category per city (3 at most). Landmarks are filtered out | the team's cities, or the cities its regions stand for |
| `creators` | creators | `findTaste` person, only while `CREATORS_GROUNDED` is true. Otherwise Gaps says creators were not measured | — |

Not in the catalog: sales, pre-orders, chart positions and ratings (not in Qloo), festival and prize dates (web research only), and the author as a signal. Qloo's open lists of series and films for a book audience drift to documentaries and independent dramas, so the bridge scores titles that are chosen. A book with no story to adapt (a memoir, a self help book, poetry) has no default screen title. A rival book's overlap is the rival date check, with `scoreRivals` of type book. The planner is the same as Music's: with no key the pack's defaults run, and code keeps only the team's cities, table cities for Worth a look, and short phrases.

**Overlap.** Qloo scores one entity type per call, and scores from separate calls are never compared (qloo.md). So a screen title is ranked only against the others of its own medium, in the call that scored them, and the bridge groups its rows by medium. A title the team named is scored in that same call, so it shows as a ranked row. It does not move a bar: a what-if that adds a title reruns the plan and adds the row.

### 4.6 Live shows query catalog

`audience` and `markets` run for every plan. The others run when their module is in it.

| Key | For | Asks |
|---|---|---|
| `audience` | core | `audienceBySegment` on the act and its comps |
| `markets` | core | `rankPlaces` over the cities the team named |
| `similar` | publicity | `findTaste` artists with the music scene tag, per city. Skipped for a comedy night, a play or a screening, which have no music scene |
| `brands` | partnerships | The model names candidate sponsors, Qloo ranks only those per city (`filter.results.entities`); else a brand category per city |
| `podcasts` | publicity | `findTaste` podcasts with a genre tag |
| `venues` | venues | `findTaste` places with the place category for the show type: concert hall and night club, night club, comedy club, theater, movie theater. A city where the category lists nothing is a gap |

Qloo holds no ticket price, venue capacity or event calendar. The team supplies them, and a plan shows "not available" for a missing one. Details: [shows-agent.md](shows-agent.md).

## 5. Scoring layer

Computed in code, from values Qloo returned in the same run. The model explains and never sets a score.

* **Lift.** `lift(x) = score(x) / score(baseline)`, both from one ranking call. Strong at 1.5 and above, usable 1.2 to 1.5, weak below 1.2.
* **Verdict.** Per assumption: holds, weak, breaks, or cannot test. Rules are published in the receipt. An assumption with no Qloo signal is cannot test, never weak.
* **Fit.** 0 to 100 for plan lines: lift on a 0 to 100 scale, `fit = 50 + (lift − 1.2) × 250 / 3`, rounded and kept between 0 and 100. Lift 1.2 is fit 50 and lift 1.5 is fit 75, so the fit bands line up with the lift bands. 75 and above recommended, 50 to 74 usable, below 50 not recommended.
* **Confidence.** High, medium or lower, on every line. Rule in §5.1.
* **Route score (music).** Weighted mean of lift over stops, weights `1, 0.9, 0.8, 0.7, ...` by position (`routeScore`), plus the best order by lift for comparison (`bestRoute`). The verdict on a tour order is in §5.4.
* **Rival overlap.** How much your audience also likes a rival: each rival is scored against your comps in one scoring call (the call `lift` uses), and `overlap = affinity × 100`, rounded. Above 85 high overlap, 70 to 85 moderate, below 70 low (the direction for high overlap is avoid, §5.12). The edges come from one live film brief ([qloo.md](../backend/qloo.md)); the edges are absolute, so a rival set Qloo scores on a different scale would shift them.
* **Topic ownership (podcasts).** From one comparison of your audience with the rival shows' audiences (§4.4): a topic only your side lists is yours, one on both sides is shared. The weight (count against a typical rival topic) orders topics and sizes them on screen; it does not decide ownership. Never two separate calls, since their scores are not comparable.
* **Held back.** Values signal, early adopter score and premium tolerance stay out of the plan until validated. None is used today.

### 5.1 Confidence

Confidence says how much the line rests on, not how good the result is. One function in `packages/engine` computes it from what the line's calls returned, and every tool uses it. Each check below sets a ceiling and the line takes the lowest. The receipt's rule names the check that set it, such as "medium: 2 of 4 comps returned an audience row". The thresholds are starting values, tuned on the Film golden runs. Change them here first.

| Check | High | Medium | Lower |
|---|---|---|---|
| Anchors with data | 3 or more | 2 | 1 |
| Known anchors, of those with data: `popularity` 0.3 or above | 2 or more | 1 | none |
| Leave one out (place and scoring lines) | holds every time | | changes |
| Margin: the deciding value against its nearest band edge | clear of it | within 0.05 lift, or 3 points of fit or overlap | |
| Cells behind a ranked place | 100 or more | 25 to 99 | |

* **Anchors with data.** For an audience line, the anchors that returned a demographics row. For a place or scoring line, the anchors whose leave one out rerun moved any value the line used: a comp that changes nothing contributed nothing, which is how a bundle that rests on one comp shows up.
* **Leave one out.** Rerun the line's call once per anchor, with that anchor left out. It holds when the verdict and the order of the top three stay the same. When it changes, the receipt names the anchor the line rests on. It runs when 3 or more anchors are in the call. Audience lines skip it, since a few rows are too few to measure. If the call budget would not cover it, it is skipped and the line is at most medium, and the receipt says so.
* **Places.** A place with fewer than 25 cells is not ranked. Its line is cannot test.
* **Stand-ins.** A line read from a stand-in, such as the genre's audience in place of the comps', is lower and says so.
* **Cannot test.** A cannot test line, or one whose call failed, is lower.
* **Not lowered.** A title that is not in Qloo does not lower confidence by itself, since that is the normal case before release. Missing `popularity` counts as not known, never as zero.
* **Lookups.** A search backs a match, not a taste claim: high for one clear match, lower when nothing matched or several share the top name. The anchor checks do not apply.
* **Output.** An output's confidence is the lowest of the lines behind its headline and moves, and its reason is that line's.

### 5.2 Film assumption tests (build)

The read step turns the person's words into assumptions. Each kind below is tested by one call, and code turns the values into a verdict. A kind with no test is cannot test, and says why. Every value comes from the comps the person confirmed, as one bundle.

| Assumption | Test | Holds | Weak | Breaks |
|---|---|---|---|---|
| The audience is a stated age band | `audienceBySegment` on the comps, rows averaged | the band is the top band, or within 0.05 of it | its affinity is above 0 but not near the top | its affinity is 0 or below |
| The audience leans to a stated gender | the same call | that gender's affinity is above 0.05 | between −0.05 and 0.05 | below −0.05 |
| A stated place is a strong market | `rankPlaces` over the stated places | place lift 1.2 or above | 1.0 to 1.2 | below 1.0 |
| The comps describe one audience (unstated, always) | the leave one out check inside `rankPlaces` | the city order holds with each comp left out | it rests on one comp | |

* **Place lift.** A city's mean cell affinity over the mean of every ranked city in the same call, so 1.0 is an average city in that call. Banded as lift (§5). A place Qloo cannot place, or under the cell floor, is cannot test.
* **Audience index.** An age or gender affinity from Qloo (about −1 to 1, 0 neutral) is shown as `50 + 50 × affinity`, rounded and kept between 0 and 100, so 50 is neutral. It is a taste index, never a share of viewers.
* **The team's decisions are constraints.** A place that is weak or breaks keeps its place in the plan; its fix orders it after the team's strongest city. An age band that breaks keeps the band and leads with its strongest part. Cities the team did not name are ranked in the same call but shown only under Worth a look, and only when they beat the team's weakest city.
* **Plan lines** come from findings (§4.1, §6.1), not from lift over a baseline: lift rewards anything niche. Lift is kept as a confidence aid, such as a partner brief's fit.

### 5.3 Film audit tests (audit and fix)

An audit reads a plan someone else wrote and tests each belief in it with the same findings a build asks for (§4.1). The age, gender, place and comps beliefs are tested exactly as in §5.2. The rest are tested here. Each belief becomes an item with a verdict, a confidence (§5.1), the findings behind it, the sentence of the plan that states it (or `unstated`), and, when it is weak or breaks, a fix line. Every value is computed from what Qloo returned; the model never sets one.

| Belief | Test | Holds | Weak | Breaks |
|---|---|---|---|---|
| A partner brand the plan names is the right one | The brands the plan names join the candidates Qloo ranks in one `findTaste` call per city (`only`); its place in that ranking | top third | middle third | bottom third |
| An artist the plan names suits the audience | Its place among the artists `findTaste` ranks for the scene and city | in the top 3 | listed, below the top 3 | |
| The release window | Not in Qloo | | | |

* **Not tested, said plainly.** A brand or artist Qloo did not rank is could not test, never weak: not being in a list is not a score. So is a ranking of fewer than three, a window, a budget and anything else Qloo holds no data for.
* **Fixes never drop.** A team's choices are constraints (§5.2), so a fix reorders them ("keep Lagos, and open it after London") or adds a stronger option beside them ("also approach X"). No audit text tells a team to drop a city, a comp or a partner it chose.
* **Alternatives.** The Worth a look cities, and the brands and artists that rank above a weak or broken one, each citing the finding that names it.
* **Results.** After launch the person gives results as aggregates, by city and optionally by age group. Code computes each city's share of the total and its place, and compares that with the place the plan put it (the order the plan names its cities in). A city is *behind the plan* when it finished 2 or more places below its planned place, or any place below it with under half the average city's share; *ahead of the plan* by the same rule upward, with one and a half times the average. A city the plan did not name that finished in the top 3 is ahead of the plan. The item whose city is furthest behind is the one the results contradict most, and the report's bottom line names it. None of these numbers goes to Qloo or to a model (hard rule 7), and a result is kept only when the person's own words contain it.
* **Conventions.** The thirds, the top 3, the two places and the half and one and a half times are chosen conventions, tuned on the golden runs and not measured against Qloo. Change them here first.

### 5.4 Music assumption tests (build)

The age, gender, place and anchors tests are exactly §5.2, run on the artist and its sound-alikes as one bundle. The "anchors describe one audience" test is the leave one out check inside `rankPlaces`, and reads "The artist and its sound-alikes describe one audience". One test is new:

| Assumption | Test | Holds | Weak | Breaks |
|---|---|---|---|---|
| The tour order is the strongest (stated when the team names its cities in an order) | `routeScore` of the team's ranked cities in their order, over `bestRoute` (the same lifts, strongest first), both from the `markets` call. Cities that are not ranked are left out; fewer than two ranked cities is cannot test | the team's score is 97% or more of the best | 93% to 97% | below 93% |

* **The team's order is a constraint.** A tour order that is weak or breaks keeps its order in the plan. Its fix opens the stronger order beside it ("keep your order, or open in Lagos and then London"). It never tells the team to drop a city.
* **Edges.** 97% and 93% come from the 24 possible orders of two live Afrobeats briefs, which score 88% to 100% of the best ([qloo.md](../backend/qloo.md)). Change them here first.
* **Not a routing.** The route score orders cities by audience strength. Travel, venue availability and dates are not in Qloo and are never claimed.

### 5.5 Music audit tests (audit and fix)

An audit reads a plan someone else wrote and tests each belief with the findings a build asks for (§4.2). The age, gender, place, anchors and tour order beliefs are tested as in §5.4. The rest:

| Belief | Test | Holds | Weak | Breaks |
|---|---|---|---|---|
| A partner brand the plan names is the right one | As §5.3 | top third | middle third | bottom third |
| A support act the plan names suits the audience | Its place among the artists `findTaste` ranks for the scene and city | in the top 3 | listed, below the top 3 | |
| The release window | Not in Qloo | | | |

* **Not tested, said plainly.** A support act or brand Qloo did not rank is could not test, never weak (§5.3). Fixes never drop: a fix reorders the team's choices or adds a stronger option beside them.
* **Results.** After launch the person gives streams or ticket sales by city and optionally by age group, and the comparison is §5.3. Totals only, and none of it goes to Qloo or a model.

### 5.6 Games assumption tests (build)

The age, gender, place and anchors tests are exactly §5.2, run on the game, its franchise and its comparable games as one bundle, and the place test only for the cities the person named (a region word's cities are ranked but not tested). The "anchors describe one audience" test is the leave one out check inside `rankPlaces`, and reads "The game and its comparable games describe one audience". Two tests are new, both from what Qloo lists for the comparable games (`gameProfiles`):

| Assumption | Test | Holds | Weak | Breaks |
|---|---|---|---|---|
| The platforms named are where the comparable games live (stated when the team names platforms) | For each platform named, the comps that list it, of the comps Qloo holds platforms for; the lowest share decides. Under 2 comps with platform data is cannot test | 2/3 or more | 1/3 to 2/3 | below 1/3 |
| The store tags fit the comparable games (stated when the team names tags) | The team's tags that match a tag at least half of the comps carry, among the comps Qloo holds tags for. Under 2 comps with tags, or no shared tag, is cannot test | 2 or more match | fewer than 2 match | — |

* **The team's decisions are constraints.** A platform that is weak or breaks keeps its place in the plan; its fix names the platform more of the comps are on beside it. Store tags that do not match keep their place; the fix adds the shared tags beside them. A tag is wording, not audience, so a miss is weak and never breaks.
* **Cut-offs.** 2/3, 1/3 and 2 matches are chosen conventions, not measured: Qloo has no ground truth for "where a game should be". The platform and tag names they read were checked live. A miss never replaces the team's choice. Change them here first.
* **Content rating** is a fact in the profile finding, not a test.

### 5.7 Games audit tests (audit and fix)

An audit reads a plan someone else wrote and tests each belief with the findings a build asks for (§4.3). The age, gender, place, anchors, platforms and store tags beliefs are tested as in §5.6. The rest:

| Belief | Test | Holds | Weak | Breaks |
|---|---|---|---|---|
| A partner brand the plan names is the right one | As §5.3 | top third | middle third | bottom third |
| A collab the plan names suits the players | Its place among the partners of its medium that `scoreRivals` scored in one call. Under 3 ranked is cannot test | top third | middle third | bottom third |
| A creator the plan names suits the players | Its place among the creators `findTaste` ranked, while `CREATORS_GROUNDED` is true. Otherwise cannot test | in the top 3 | listed, below the top 3 | |
| The release window | Not in Qloo | | | |

* **Not tested, said plainly.** A collab or creator Qloo did not score is could not test, never weak (§5.3). Fixes never drop: a fix keeps the team's choice and adds a higher-ranked option beside it.
* **Results.** After launch the person gives wishlists, installs or sales by region, and the comparison is §5.3. Totals only, and none of it goes to Qloo or a model.

### 5.8 Podcasts assumption tests (build)

The age, gender, place and anchors tests are exactly §5.2, run on the show, its earlier shows and its comparable shows as one bundle, and the place test only for the cities the person named (a region word's cities are ranked but not tested). The "anchors describe one audience" test is the leave one out check inside `rankPlaces`, and reads "The show and its comparable shows describe one audience". One test is new, from the one comparison call of the topic map (`topicMap`):

| Assumption | Test | Holds | Weak | Breaks |
|---|---|---|---|---|
| A topic the team wants to own is theirs (stated for each topic the team names) | Where the comparison call listed the topic: your side only, both sides, or the rival side only. A topic the call did not return is cannot test | listed on your side only | listed on both sides | listed on the rival side only |

* **The team's decisions are constraints.** A topic that is shared or the rivals' keeps its place in the plan; its fix names the topics that are yours beside it, and the writer is told to take an angle on it that the rival shows do not. A topic is matched by its words (whole phrase, either way round), not by a guess.
* **Rivals.** The shows the team named. With none, the shows `findTaste` lists in the genre, which are the shows the audience hears: the plan says the comparison was against shows in the same genre.
* **No weight decides.** The weight in the topic map orders and sizes topics. Ownership is where Qloo listed the topic.
* **Starting values.** The rule is checked on one live true crime brief (2026-10-20). Other subjects are not probed one by one. Change it here first.

### 5.9 Podcasts audit tests (audit and fix)

An audit reads a plan someone else wrote and tests each belief with the findings a build asks for (§4.4). The age, gender, place, anchors and topic beliefs are tested as in §5.8. The rest:

| Belief | Test | Holds | Weak | Breaks |
|---|---|---|---|---|
| A sponsor the plan names is the right one | As §5.3 | top third | middle third | bottom third |
| A show the plan swaps with suits the listeners | Its place among the shows `scoreRivals` scored in one call. Under 3 ranked is cannot test | top third | middle third | bottom third |
| A guest the plan names suits the listeners | Not tested while `GUESTS_GROUNDED` is false | | | |
| The release window | Not in Qloo | | | |

* **Not tested, said plainly.** A show or sponsor Qloo did not score is could not test, never weak (§5.3). Fixes never drop: a fix keeps the team's choice and adds a higher-ranked option beside it.
* **Results.** After launch the person gives downloads or followers by market, and the comparison is §5.3. Totals only, and none of it goes to Qloo or a model.

### 5.10 Books assumption tests (build)

The age, gender, place and anchors tests are exactly §5.2, run on the book, its earlier books and its comparable books as one bundle, and the place test only for the cities the person named (a region word's cities are ranked but not tested). The "anchors describe one audience" test is the leave one out check inside `rankPlaces`, and reads "The book and its comparable books describe one readership". One test is new, from the one lookup of `bookProfiles`:

| Assumption | Test | Holds | Weak | Breaks |
|---|---|---|---|---|
| A comparable book the team named is recent enough to pitch against (stated for each comp the team names) | The book's publication year against the year of the launch (the year in the window, or this year) | 5 years or fewer | 6 to 10 years | more than 10 years |

* **The team's comps are constraints.** A comp that is weak or breaks keeps its place in the plan; its fix keeps it as a reference and names the recent books the shelf lists beside it. No text tells a team to drop a comp.
* **Not tested, said plainly.** A comp Qloo lists no publication year for is cannot test, and a comp Qloo did not find by name is not tested.
* **Starting values.** 5 and 10 years are chosen conventions, not measured: pitching against books from the last few years is publishing practice, and an older book is still a fair reference. Change them here first.

### 5.11 Books audit tests (audit and fix)

An audit reads a plan someone else wrote and tests each belief with the findings a build asks for (§4.5). The age, gender, place, anchors and comp age beliefs are tested as in §5.10. The rest:

| Belief | Test | Holds | Weak | Breaks |
|---|---|---|---|---|
| A partner brand the plan names is the right one | As §5.3 | top third | middle third | bottom third |
| A screen comparison the plan names suits the readers | Its place among the titles of its medium that `scoreRivals` scored in one call. Under 3 ranked is cannot test | top third | middle third | bottom third |
| A bookshop the plan names is one the readers go to | Its place in the list `findTaste` ranked for a city. Not listed is cannot test | in the top 3 | listed, below the top 3 | |
| The publication window | Not in Qloo | | | |

* **Not tested, said plainly.** A title, shop or brand Qloo did not score is could not test, never weak (§5.3). Fixes never drop: a fix keeps the team's choice and adds a higher-ranked option beside it.
* **Results.** After launch the person gives pre-orders or sales by market, and the comparison is §5.3. Totals only, and none of it goes to Qloo or a model.

### 5.12 Direction calls

A direction is the call on what to do about a decision: **okay**, **risky** or **avoid**. Code sets it from a value Qloo returned, with the confidence of the finding behind it; the model sets none (hard rule 1). Directions sit beside the assumption verdicts, which stay holds, weak, breaks and could not test.

| Subject | Okay | Risky | Avoid |
|---|---|---|---|
| An opening day against the rivals the team named (the riskiest rival decides) | overlap below 70 | 70 to 85 | above 85 |
| A territory as a place to open | place lift 1.2 or above | 1.0 to 1.2 | below 1.0 |
| A partner among the brands Qloo ranked | top third | middle third | bottom third |
| A rival show date against a live show's date (E6) | more than a week from the show | the same night with little shared audience, or unscored and near | high overlap on the same night or in the same week |

* **No call** for a place Qloo could not rank, a partner Qloo did not rank, or fewer than 3 ranked: not being in a list is not a score.
* **A team choice is a constraint** (§5.2): a call on a city, date or partner the team chose says how to handle it ("Keep it, and open it after Lagos") and never says to drop it.
* **Rival dates are the team's.** `Rivals: Title on YYYY-MM-DD` in the brief is read by form, each rival is scored against the comps in one `scoreRivals` call during the build, and the result is the finding `f-clash` and the Date tab. Qloo holds no release calendar.
* **Conventions.** The edges are the overlap, lift and thirds rules of §5, tuned on the golden runs. Change them here first.

### 5.13 Live shows assumption tests (build)

The age, gender, place and anchors tests are exactly §5.2, run on the act and its comparable acts. A support act the team named is tested like a Music support act (§5.4). Everything dated is code, not a test: the on-sale window, the presale, the pacing, the budget phases and the final push are computed from the team's inputs and the rules E1 to E5 ([shows-agent.md](shows-agent.md)). The target for the one signal, tickets sold against capacity, is the team's, and the benchmark is null.

* **A rival show date (E6).** Each date the team gives is called okay, risky or avoid from its distance to the show's date and, where Qloo scored the rival, the audience overlap (§5.12). A rival Qloo cannot score is still flagged when it is on the same night or in the same week, at the lowest confidence.
* **Not tested, said plainly.** Ticket sales, venue capacity and price: Qloo holds none. A comedian or a stage play is a thin anchor (§4.6).

### 5.14 Live shows audit tests (audit and fix)

An audit runs §5.13's tests on the plan's beliefs, then sets the plan's own dates and shares beside the rules. The result is the report's `ruleChecks`: each check is `follows`, `outside`, `not-stated` or `no-rule`, with the rule id and the figures in words. It is not a Qloo verdict and has no confidence.

| Check | Rule | Follows when |
|---|---|---|
| On-sale window | E1 | The weeks the plan opens general on sale are inside the range for the show type. `no-rule` for theatre and screenings |
| Presale | E3 | It opens 3 to 7 days before general on sale and has an end date. A presale with no end date is outside |
| Final push reserve | E4 | The plan holds back at least the default share (40 percent) for the final push |
| Rival dates | E6 | No named rival plays on the same night or in the same week as the show |

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
| `projects` | team_id, category, name, mode (build, audit, fix), kind, genre, places[], window, lead, comps, inputs jsonb, status, created_by, updated_at. Saved from the first message as a draft (`status` intake, no name, category or mode) that no list shows until the router has read it, then `active` |
| `threads` | project_id, name, base_output_id, from_output_id, fresh bool (a standalone chat, §3.7), created_by, updated_at |
| `messages` | thread_id, role (user, agent, question, trace, output), body jsonb (a trace row holds a step or a finding), seq; unique per thread and seq, which is where an event stream resumes |
| `outputs` | thread_id, project_id, kind (build, audit, scenario, fix, date, partner, creative), parent_id, title, brief jsonb, plan jsonb (the launch plan, §6.1; null for the older brief shape and for an audit), report jsonb (the audit report, §6.3; null for every other kind), inputs jsonb (what the agent built it from, so a what-if can rerun it), changed_ids[], headline, moves jsonb, confidence jsonb, data_as_of |
| `receipts` | run_id, thread_id, output_id (nullable), line_id, endpoint, input jsonb, returned jsonb, rule text, confidence (high, medium, lower), source (qloo, demo), called_at, call_id. A receipt belongs to the run that made the call; an answer (§3.6) has no output, so `output_id` is set only when a plan saves one |
| `share_links` | output_id, token, enabled |
| `reactions` | output_id, user_id, kind (useful, wrong, edited), finding_ids (the findings the plan cited when it was rated); unique per output and person. For the team's own review of what helps and what is wrong. Never sent to Qloo or a model, and it never changes the plan |
| `outcomes` | output_id (the audit report), project_id, category, kind (place, age), label (the city or age band), planned_rank, actual_rank, actual_share, predicted (Qloo's lift for a place or taste index for an age band), gap (under, over, as-planned), measure, as_of. One row per place and age band, written when an audit compares results with a plan. Aggregates only. It is the record the lift and overlap bands and the Games cut-offs are tested against once there are enough outcomes, and until then those bands are conventions, not findings |
| `runs` | thread_id, agent, job, steps jsonb, state jsonb, qloo_calls int, tokens int, status (running, waiting, done, error), stop_reason, finished_at. One row per run segment; `state` holds what the next segment needs, such as the router's open question |
| `pins` | user_id, project_id; unique per pair. Three per person at most, kept by the API |
| `thread_reads` | user_id, thread_id, read_seq: how far one person has read a thread |
| `memory_items` | project_id, kind (point, decision, plan), text, source_output_id, source_thread_id, created_at, updated_at (§3.7) |
| `category_packs` | version only; packs live in code |

`brief` shape (Zod, in `packages/schema`): `audience[]`, `assumptions[]`, plan sections `s1` to `s4`, `places[]`, `dates[]`, `partners[]`, `risks[]`, `cannot[]`, `planned[]`, `aLabels[]`, `results`, `course`, plus category data: `grid` (music), `shelf` and `bridge` (books), `topics` (podcasts), `fan` (games, and the podcast swap list). Every line has an `id` that is stable across versions, which is how diffs and "changed" marks work.

Privacy: only public entity names, place names and age bands go to Qloo. Uploaded results are stored as aggregates. Files are parsed, personal columns dropped, and the raw file deleted.

### 6.1 Launch plan

`launchPlanSchema` in `packages/schema/src/plan.ts`. A minimum core plus modules, written by the model from the findings (stage 2) and checked by code (§6.2).

* **Core, always:** Bottom line (up to three moves), Positioning (hook, three key messages, the comps and what each stands for), Audience, Markets (the team's cities in order, then Worth a look), Gaps (last).
* **Modules:** each category picks its own from `launchModuleKeys`, with `pickModules` in its pack. A full plan (a launch plan, a go-to-market, or an unclear ask) gets every module the brief does not rule out; a narrow ask gets only the module it names. Budget split is always offered: shares with no budget, amounts with one.
  * **Film** (`FILM_MODULES`): Partnerships, Creative placement, Publicity and media, Community and grassroots, Release route and window, Timeline, Release cadence, Budget split, What to measure, Risks. Release cadence is for series, and Creative placement is dropped for a film going straight to streaming. The list is frozen: modules other categories add never reach a Film plan.
  * **Music** (`MUSIC_MODULES`): Partnerships, Press and playlists (`publicity`), Community and grassroots, Tour route (`tour`), Support acts (`support`), Sync and placement (`sync`), Timeline, Budget split, What to measure, Risks. Tour route needs at least two cities, and Support acts are dropped for a single. Markets is titled Cities.
  * **Games** (`GAMES_MODULES`): Store page and tags (`store`), Festivals and showcases (`events`), Soft launch (`softlaunch`), Early access roadmap (`earlyaccess`), Seasons and retention (`liveops`), Fan base collabs (`collabs`), Creators and streamers (`creators`), Press and podcasts (`publicity`), Brand partners (`partnerships`), Community, Launch beats (`timeline`), Budget split, What to measure, Risks. Which a plan gets, and in what order, depends on the **launch kind** the brief describes: premium (PC and console), early access, free to play and live service, or mobile (`KIND_PROFILES` in `packages/packs/src/games/modules.ts`). With no kind stated the plan is premium and Gaps says so. Festivals need a PC or console platform, a soft launch needs iOS or Android, and an early access roadmap only an early access launch. Markets is titled Regions. Each kind has its own calendar of beats in weeks from the release, its own measures and its own budget split.
  * **Podcasts** (`PODCASTS_MODULES`): Cross promotion shows (`crosspromo`), Guests (`guests`), Sponsors (`partnerships`), Press and newsletters (`publicity`), Video and clips (`video`), Live shows (`live`), Community, Episode cadence (`cadence`), Launch beats (`timeline`), Budget split, What to measure, Risks. Which a plan gets, and in what order, depends on the **launch kind** (a new show or a new season, `KIND_PROFILES` in `packages/packs/src/podcasts/modules.ts`) and the **format** (audio, video or both). With no kind stated the plan is for a new show, and with no format it is audio; Gaps says so. Video and clips need a filmed show, and Guests are dropped for a narrative show unless guests are named. Markets is titled Markets. Each kind has its own calendar of beats in weeks from the release, its own measures and its own budget split.
  * **Books** (`BOOKS_MODULES`): Comp titles (`comps`), Screen and audio angles (`adaptation`), Retail and pre-orders (`retail`), Press and reviews (`publicity`), Events and festivals (`events`), BookTok and creators (`creators`), Brand partners (`partnerships`), Book clubs and community (`community`), Audiobook (`audio`), Schools and libraries (`schools`), Series and backlist (`cadence`), Launch beats (`timeline`), Budget split, What to measure, Risks. Which a plan gets, and in what order, depends on the **launch kind** the brief describes (a debut, a new book by an author, the next book in a series, a reissue or new edition, `KIND_PROFILES` in `packages/packs/src/books/modules.ts`), the **route** (a publisher's, or self-published), the **readership** (adult, young adult, children) and the **formats**. With no kind stated the plan is a debut, with no route a publisher's and with no readership adult; Gaps says so. Retail sell-in is for a publisher's book, Schools and libraries are for young readers, and Audiobook needs an audiobook. Series and backlist is for a new book by an author, the next book in a series and a reissue. Markets is titled Markets. Each kind has its own calendar of beats in weeks from publication, its own measures and, for each route, its own budget split.
* **Lines:** `{ id, kind, text, findingIds, sourceIds, names, group }`. `grounded` lines cite findings; `playbook` lines cite no finding. Either may cite web sources (`sourceIds`), which is the only way a line may state a date, a rival release or a market figure.
* **Live shows** (`SHOWS_MODULES`): On sale and pacing (`onsale`, by code), Sponsors and partners (`partnerships`), Press and promoters (`publicity`), Where the audience goes out (`venues`), Final push (`finalpush`, by code), Show calendar (`timeline`), Budget split by phase, What to measure, Risks. Rules E1 to E8: [shows-agent.md](shows-agent.md).
* **Plan fields.** Besides the sections, a plan carries `rules` (the category version and the shared libraries it used, `parts`), `band`, `signal`, `territories`, `calls`, `partners` (each with a tier, a market, a kind and content flags), `partnerNotes` (lead time, band and barter, T1) and `calendar` (the rows behind the Content calendar section).
* **Shared modules.** Every full plan also carries Channels (`channels`, when it names a city), Creative briefs (`creative`) and the Content calendar (`calendar`), added beside the category's own list just before the timeline or the budget, so Film's frozen list stays as it is. A narrow ask gets neither.
* **The launch rules.** Timeline, What to measure and Channels are written by code from the rule library, and a plan records the rules version it used, its budget band, its signal and target, one territory per city, its direction calls and its partners by tier. Their rules, fields and thresholds are in [launch-rules.md](launch-rules.md); the checks are in §5.12 and §6.2.
* **Written by code:** "To sharpen this plan" (advice about the plan, not part of it: the web shows it beneath the plan with the review, and the exports and the shared link leave it out; the section key stays `gaps`: only inputs the team could add and what each would change; what could not be asked goes to the Assumptions tab) and Budget split (the pack's fixed convention table as shares, with amounts computed when a budget is given, labelled a starting split). Every plan's Timeline is also written by code (Film and Music from the rule library, the others from their launch kind, platforms or route), and so are What to measure (one primary signal, the team's target or a sourced benchmark labelled a target and not a forecast, when to read it, and the rest beside it) and Channels (per territory, from the rule library). A plan's calendar is worked back from the release date and today: each beat has dates when a day is known and weeks when not, and a beat already over is dropped. Festival, sale and showcase dates are never in it; they come from web facts (below) in the Festivals section.
* **Guaranteed by code:** the bottom line names every city the team chose and anchors the premiere in the home market (the city in the film's country of origin), with the rest following within days; Markets has a line for each city; every comp the team named has a line in Positioning. Code writes any of these the model missed (`decisions.ts`).
* **Web research:** when the writer's provider has search (OpenAI web search, Google Search grounding; `LLM_WEB_SEARCH`), a step before writing looks up release timing, rival releases, who distributes and shows films like this, and market numbers, then extracts discrete facts each tied to a page it came from (`research.ts`). Only genre, country, format, route, window and cities are sent, never the film's title or story. The writer may use a fact only by citing its id; the plan keeps only the pages a kept line cites, numbered with the audience footnotes, and exports list them under Sources. A failed or empty search writes the plan without the step.
* **Understanding:** `understanding` holds how the request was read: what was asked, goals, constraints, the assumptions the analyst filled in (each with why) and the checks a good answer must pass. The plan shows the assumptions under the bottom line.
* **Review:** `review` holds the red team's verdict on the saved draft: `passed`, `flagged` (still has blocking issues after three drafts) or `unchecked` (no model), each round's issues with what was done about them (`rewrote`, `researched`, `approved`, `stopped`), and what the person could give or try to make the plan stronger. A flagged plan is still saved and still helps; the page lists the open points and the next steps.
* **Also stored:** `comps` (each with `source` you or added, the Qloo match and the choice code made between same-name titles), `findings`, `dropped` (every line the check removed, with why), `writer` (`model` or `template`).
* **Launch rules, stored on the plan** (all default empty, so a plan saved before them still reads): `rules` (category and version), `band` (the budget band and whether it came from the brief, was asked or was assumed), `signal` (the primary signal, what is secondary, the days it is read and the target with its source), `territories` (one per city: role home, diaspora or other, its call, lead channels, partner ids and the plan's lines about it), `calls` (direction calls, §5.12) and `partners` (name, tier, market, Qloo fit as a place in the ranking, budget fit, and price always `unknown`).
* **The budget band question.** A full build whose brief states no budget or band asks one `single` card of the four bands plus "Skip, assume independent", after the minimum question and before any Qloo call. The answer is a band, not more of the brief. A what-if keeps the band and never asks. PRD C1 allows this second question.
* **The platform question.** A full build whose brief names no platform then asks one `multi` card of platforms suggested for the market (`suggestPlatforms`: the market's and category's leaders, X, Facebook and the like, and WhatsApp last where a market passes launches around on it), with what each is for. It comes after the budget band question and before any Qloo call. The picks, or the first three suggested if the answer names none, become the channels of every territory, ordered for that territory's market with WhatsApp last, and the writer is told to plan on no others. Platforms named in the brief answer it. A what-if keeps them and never asks.
* **The creative kit** is saved as an output of kind `creative`: a narrow launch plan whose sections are Hook options, Scripts, Shot lists, Key art briefs and Caption packs, grouped by territory and channel, built by code from the plan's findings and the rule library, with every line checked. It has the Kit and Evidence tabs.
* The headline is the bottom line's first move; moves point at the first finding they cite; the output's confidence is the lowest of those findings.

**Brand partnerships.** A brand rarely pays an independent film in cash: the realistic ask is in kind or a co-promotion (product, a venue or hospitality, ticket giveaways, data or ride credits, ad space or airtime) for premiere presence, stills, clip rights and access to the audience. Qloo ranks brands by how much this audience likes them, not by who will partner, so the writer is told to skip global giants and luxury brands for a small campaign, to scale the ask to the budget in the brief (an independent release when none is given), and to say who to approach, what to ask for and what the film offers.

### 6.2 Line check

`checkLine` in `apps/api/src/agent/launch/check.ts`, on every line the model writes. A line that fails is dropped and logged in `dropped`, and the writer is told why on its next draft (the red team loop, §6.1). A core section left empty is filled from the templates and checked again.

| Rule | Grounded | Playbook |
|---|---|---|
| Citations | at least one, each a finding of this run | none |
| Names | every name in `names` or written in the text that is a finding entity must be in a finding it cites, or in the brief | only names in the brief |
| Numbers | every number in the text must be one the cited findings state, or one in the brief | not checked |
| Taste | — | no claim about what an audience likes (`TASTE_CLAIM`, shared by the packs in `packages/packs/src/launch.ts`). Playbook lines may name any real launch entity; a name a finding returned makes the line grounded and cites that finding |
| Plain words | no data jargon (lift, index, affinity, cells, findings, confidence) and no talk of what could not be measured | same |
| Market figures | no money, admissions or screen counts the findings or a cited web fact do not state | none, unless a cited web fact states it |
| Web sources | every `sourceId` is a source of this plan; every number in a line citing a page is the page's own or the brief's | same |
| Shares | no percentage unless a cited finding states one: an index or a lift is not a share of people | — |
| Worth a look | only lines citing the Worth a look finding | none |
| Budget band | no flagship partner (tier A) the plan's band cannot carry, unless the team named it | same |
| Asset offers | no line that offers to generate, render or make an ad, trailer, image or video | same |
| Anywhere | no receipts, call ids or endpoints; the section must be in the plan; no repeated line in a section | same |
| Bottom line | at most three moves; no city the team did not choose. It may say who to lead the creative with, even when that is not the team's age band | same |

### 6.3 Audit report

`auditReportSchema` in `packages/schema/src/report.ts`, saved in `outputs.report` for an audit. It holds:

* **`items`**: one per belief in the plan: `subject` (age, gender, place, comps, partner, artist, media or other), `claim`, `source` (where the plan says it, or null), `unstated`, `verdict`, `confidence`, `findingIds`, `why` (built by code), and `fix`, a checked launch line or null.
* **`risks`** and **`alternatives`**: lines written from the verdicts by a model, or by templates with no key, and checked like plan lines (§6.2). An alternative that names a city cites the Worth a look finding.
* **`results`**: when the launch is out and the person gave results, each city's share, its planned and actual place, Qloo's lift for it, and whether it was ahead of, behind or as planned (§5.3), with the item the results contradict most.
* **`phase`** (`pre` or `post` launch), the comps used, the findings, the web sources and the lines the check dropped.

The headline is written by code: how many assumptions hold, are weak, break or could not be tested, and after launch the city the plan leaned on that fell short. Its moves are the fixes for what breaks, then for what is weak. The output's `brief` still holds the age, gender, place and comps assumptions, so older readers of an output keep working.

A **fix** saves two outputs in one run: the audit, then a plan written from it whose parent is the audit. The plan is written for the same brief with the team's cities ordered by where the audience is strongest (before launch) or by how the launch did (after it, with any city the results add), and the writer is told each weak or broken item and its fix. When a saved audit is fixed in a later message, its reading and comps are reused and only the plan is new. A fixed plan is presented with the report it answers, for its "What was fixed" tab.

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
POST   /projects/:projectId/threads   body `{ fresh? }` (§3.7)   GET /threads/:threadId
GET    /projects/:projectId/memory   PUT, DELETE /projects/:projectId/memory/:itemId   (§3.7; the memory list is also on `GET /projects/:projectId`)
POST   /threads/:threadId/messages    typed text or a card answer; 202, the reply comes on the stream; 409 while a run is going
POST   /threads/:threadId/cancel      stops the run on the thread (owner, editor); 204, 409 when nothing is running. The run ends at its next step, saves nothing, says it stopped, and the stream sends `run.stopped` with the reason `stopped`
POST   /threads/:threadId/read    marks what is stored so far as read
GET    /threads/:threadId/events?after=    SSE: stored events after that seq, then live ones, then the run status
GET    /rules                 the launch rule library with each rule's source, grade and date: the categories, the shared conventions, the partner, calendar and live show rules. Public, static, the same for every team
GET    /outputs/:id
GET    /outputs/:id/export/:format    md, docx or pdf, built from the stored plan (§6.1)
GET    /projects/:id/compare?a=&b=
PUT    /outputs/:id/reaction  body `{ kind }` with `useful`, `wrong` or `edited`, or `null` to take it back; one per person per output. Any member of the team. `GET /outputs/:id` carries the caller's own as `reaction`
PUT    /outputs/:id/partners  body `{ names }`; replaces the team's own partners on a saved plan. Code places each from the brands the plan already ranked, with no Qloo call. Owners and editors
PUT    /outputs/:id/share     body `{ enabled }`; turns the read only link on or off, makes the token the first time. Owners and editors
GET    /s/:token              read only view, no session. 404 for a wrong or turned off token. Receipts keep their endpoint, rule and confidence and lose what was sent to Qloo and what came back; the creator, chat and other outputs are left out
POST   /uploads               a PDF or Word (.docx) file as multipart `file`; answers `{name, text}`. Text only, nothing stored, 20 MB at most, text cut at 200,000 characters. A scanned PDF with no text layer is refused with a plain reason
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

SSE event types: `trace.step`, `finding` (a Qloo result as a sentence, §4.1, stored on the trace and folded into the trace item), `question`, `message`, `receipt`, `output.created`, `project.updated`, `run.stopped`, `error`, and `memory.used` (the notes a reply saved to the project's memory, as items with the source `saved`; chats saved before the "Using" line was removed still show it). `project.updated` carries the name, category, mode and chat name once the router has read them, so the workspace fills its skeleton without a reload. Events stored in the transcript carry their `seq` as the SSE id. Shapes are `threadEventSchema` in `packages/schema`. A `trace.step` names the agent that took it (`router`, `film`, `books→film` for a consult). A question has an id, the asking agent, its card type (single, multi, text, split, date, file, confirm, match) and its options. A `message` carries its claims, each with the receipt ids behind it. A `receipt` event streams each receipt as the tool makes it. `run.stopped` ends every run segment with a reason: `finished`, `waiting` (on a question), `budget`, `steps` or `error`. The web app renders cards from the event, and posts the answer back as a message.

## 9. Web app

Routes: `/` the landing page (see §9.5), `/sign-in`, `/sign-up`, `/forgot-password`, `/email-code`, `/verify`, `/reset-password`, `/overview`, `/projects`, `/projects/:id`, `/chats/:id`, `/outputs/:id`, `/team`, `/invite/:token`, `/s/:token`.

`/overview` is the team's home and where sign in lands: the message box to start something new, Needs you (chats waiting on an answer, projects that are out with no results, new results, runs in progress) and chats to pick up. `/start?category=&mode=` is the same message box on its own page, before anything is saved; both values are optional hints. The sidebar has New project, Overview (with the Needs you count), Projects, the person's pinned and recent projects, and Team. `/projects` is the project list; `?category=` filters it by one category id, and no value means every category. The project lists show the person's pinned projects first, and one category's list has a help button beside the filter that opens what Oraqul tests there in a dialog. A project has one address, `/projects/:id`, whatever its category. The project page is the workspace: the newest chat, the project's other chats beside it, the current plan above, and Project details (inputs, all outputs, plan lineage and compare, delete for owners) in a dialog. `/chats/:id` is the same workspace with that chat selected. The chats panel can be folded to a thin strip to give the chat more room. The older `/categories/...` and `/threads/:id` addresses redirect to these routes. The current team is the one in the `oraqul_team` cookie, never part of the address. The landing page header shows Open app instead of the sign in buttons when the visitor is signed in, and never redirects. The sign in pages take a `next` path and pass it between each other. `/verify` and `/reset-password` take the email from an `email` query value, set by the page before them. `/team` shows the team's members, a role select and remove for owners, pending invites, the invite form and sign out; the team comes from the sidebar switcher, remembered in an `oraqul_team` cookie and checked against the person's memberships. `/invite/:token` previews an invite and accepts it. A signed out visitor is sent to sign in and returned to the invite afterwards.

Output page tabs come from the output kind and the category pack: Summary, Audience, Assumptions, Plan, the category's signature tabs, Evidence, plus Changes, Results, Rival dates and Partner briefs where they fit. A plan with territories has **Territories**, one plan per territory (home first, then the diaspora cities) with its call, lead channels, partners and the plan's own lines for that city, and **Direction calls** (§5.12) when it has calls; a Film plan saved before territories were stored keeps the old regrouping by city. A creative kit has **Kit** and Evidence. Territories stays among the main tabs for a plan that has it. A Music plan has **Tour route** (the stops in the team's order, with the route score from the markets call) and **Support acts** (the acts Qloo lists for each city, as Qloo's affinity out of 100). The user-facing plan does not include a comparison of the product with and without Qloo; that value proposition belongs on the public Method page. Could not test is listed at the end of Assumptions and Risks at the end of Plan; old `?tab=cannot` and `?tab=risks` links open those tabs. Scenarios have one way in: the chat. Typed text with "what if" or matching a pack's scenario matcher runs it, and a suggested next step can start one. After a plan the chat offers up to three next steps, worked out in the web from the project's latest plan: a what-if on the lead city (the strongest city when the team started elsewhere, else the runner-up), a rival date check, a partner brief for the first brand Qloo listed, and Fix this plan. A step already done is left out, and each sends the message the person could have typed. Receipts open in a side drawer. A dock chat on the output page continues the thread on desktop; below 900px an Open chat button goes to it.

On the plan page, beneath the review of the plan, one question asks whether it was useful, with Useful and Not right; pressing the chosen answer again takes it back. It is not on a shared link or an example. In the chat, a launch plan appears as a readable document with Export and Open plan in its header; its grounded lines carry a quiet number that opens the finding behind them. Other outputs are one line that opens a summary card. Answered question cards fold to one line with the answer, and the trace folds once it finishes, so the chat stays clean. The chat header has a full-screen control that makes the chat the browser's fullscreen element, hiding all app and browser chrome for focused reading and writing; the control or Escape restores the workspace without losing chat state. Above the message box sit up to three suggested next steps built from the thread's plan and the project (a scenario not yet tried, results if none are in, a partner brief or rival date check not yet made). The message box takes text and files on every chat, not only the first. Typed corrections work at any point: "check my plan instead", "start fresh", "use an older plan", "compare with the last plan", or naming places, which replans with them.

Charts are inline SVG or CSS, each with a table toggle, a legend, and hover text. Colour never carries meaning alone: verdicts also carry an icon and a word.

### 9.1 Design system in code

The look is defined in the design system file. In code:

* Tokens live in `globals.css` as CSS variables, light on bare `:root`, dark in a guarded media query and again under `[data-theme="dark"]`, each with `color-scheme`. No component uses a literal colour.
* Fonts come from `next/font/google`: Geist for headings, running text and document reading in the signed-in product, Geist Mono for ids and keycaps, and Space Grotesk for the public brand and marketing headlines.
* Category colour is set by a `data-cat` attribute and a `--cat` variable. It is used for icon tiles and strokes, and to tint project cards (design-system §3.3).
* A small component set lives in `packages/ui`: Button, Input, Chip, VerdictPill, Confidence, ReceiptChip, Card, Line, Tabs, TabNote, StartComposer, ProjectCard, SummaryCard, QuestionCard, Trace, Chart, ReceiptDrawer, Palette, Modal, Toast, Icon. VerdictPill and Confidence take the data value and draw the glyph and word, so colour cannot appear alone.

### 9.2 Start modes

There is no form. Work starts in one message box, on the overview or on `/start` (opened from New project in the sidebar or on a project list, with the category when opened from a category's list). New project is the one name for it, whatever the job: an audit or a fix is still a project. The box saves nothing. The first message, text, files or both, creates the project and its first thread (`POST /projects`), so a box nobody uses leaves no empty project. Three optional hints under the box, Make a plan, Check my plan and Fix my plan, set a `mode` of `build`, `audit` or `fix`; they change the prompt and the default reading of the job, and a plan's own words cannot turn Check my plan or Fix my plan into a build. With no hint the agent reads the job from the message.

After sending, the person lands on the new chat at once. The project's name, category and chat name show as skeletons while the router reads the message, and fill in when it has (`project.updated`). A chat's name is a short summary of its first message; a chat made with New chat is named the same way once its first message is sent. The router never guesses the title, the category or the mode. It asks only when one of them is unclear: the category and the mode first, on one card that says back what it understood ("Looks like a music release or a game. What would you like to do?") with close options such as "Work on a song release" and "Work on a game launch"; then the title on a text card. Typing in the message box answers the open card too, for an answer the options miss. A message about something else ("what's my blood pressure") gets "Oraqul works on launches for films, series, music, books, podcasts and games, so I can't help with that here", and the draft stays hidden. The category agent asks which Qloo entity is theirs. Nobody is asked for the places or the category's extra input. The first reply says what was read, for example "Reading this as a new launch plan for “Tomorrow” (Music)." A correction typed later reruns what it changes: "check my plan instead" runs an audit, naming places replans with them.

### 9.3 Tabs, notes and search

* The tab list for an output comes from its kind and category pack. The client shows Summary, Plan, Assumptions and Evidence plus the current tab, and groups the rest under More. When there are five tabs or fewer, all show.
* Each tab has a note string, stored with the tab definition and shown above the content. Notes are product copy and are reviewed with the PRD.
* The search palette is client side over the team's categories, projects, outputs and fixed actions. It opens on Ctrl K or Cmd K and groups results by type. Number keys on the active question card pick the option with that index when no text field has focus.

### 9.4 Motion

Motion uses CSS only. New chat items are marked by a per thread seen count so a re render does not replay them. Agent text reveals word by word with a capped delay. The trace shows a progress bar from step count. Bars grow once on the first view of a tab. All durations drop to near zero under `prefers-reduced-motion`.

### 9.5 Public pages

The marketing and trust pages a signed out visitor sees.

**Launch set**

| Route | Holds |
|---|---|
| `/` | The pitch, the example answer, the three jobs. Exists |
| `/how-it-works` | Describe it, the agent asks only what it must, tests each assumption, ends with a bottom line and receipts |
| `/examples` | Three full read only sample outputs with every receipt openable: a Nigerian film planned for four territories, an Afrobeats album rollout and a podcast season sized to a micro budget, each a recorded run of the pipeline on the demo data (`apps/api/src/agent/examples.spec.ts` keeps them in step), picked with `?case=`. Built from the demo data and labelled as examples. The walkthrough video joins when it exists. `/example` redirects here |
| `/use-cases` | Make a plan, check my plan, fix one that missed, and keep going (rival dates, what ifs, the creative kit). One page, a section for each |
| `/categories` | One page for all five categories: what is tested, what else it handles, what the team brings. The same content as the in app help dialog |
| `/method` | How verdicts, lift, fit and confidence are computed, and what Oraqul never does (no forecasts). For people who judge the numbers |
| `/trust` | What data goes where: only public names, places and age bands to Qloo, results stored as aggregates, roles. Separate from Method because the readers differ (a marketer or judge against a reviewer or legal) |
| `/about` | Why it exists, the team, the global angle |
| `/guide` | How to get the best plan: what to put in a brief and why, a brief builder that writes the brief in the forms Oraqul reads and opens `/start?text=`, how to read a plan, what comes after, what it will not do, and the launch rules with their sources |
| `/developers` | The engine as an MCP server |
| `/privacy`, `/terms` | Required. Google sign in needs both links |

**No pricing page for now**, and no mention of pricing anywhere until there is real pricing. Access is by creating an account.

**Navigation.** A short header: Product (How it works, Examples, Method), Use cases, Categories, Guide, Sign in, Create account. Developers and Terms are in the footer. The footer carries the rest in four columns: Product, Resources, Company, Legal. Product is a small menu (Escape or a click outside closes it and returns focus to it); below 900px one Menu button opens a panel with every link; below 600px Sign in moves into that panel so the bar stays on one row.

**Rules.** Marketing pages use the app's tokens and Space Grotesk headlines, with art and motion the app does not use (design-system §6, Marketing pages). They are one designed rhythm of light and dark bands, pinned with `.scheme-light` and `.scheme-dark`, not the visitor's theme, and work at 375px. Words follow design-system §10: launch is the umbrella word (launch planning, launch plan), each category names its own event (a film release, a book launch, a podcast season), and Project is what a user creates. An example page never shows raw Qloo data (see the open point on Qloo's terms in the overview).

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
* **Golden runs.** Per category, fixed inputs for build, for audit and for fix, before and after launch, with expected verdicts, run on the plan pipeline (§3.2) over recorded Qloo responses in `packages/engine/fixtures`. Run on every change. A category does not ship without its golden runs, and the second category is not started until Film's pass with the grounding check and refusal tests.
* **Grounding check.** Every entity and number in an output must trace to a receipt. Fails the build if not.
* **Refusal tests.** Forecast, pricing and send requests are refused with the right message.
* **Coverage tests.** Cross-domain taste tests per category, Nigerian titles, Lagos against no location, podcasts and games, diaspora ranking.
* **UI.** Headless browser pass over every tab of every output in every category, checking for errors and for the words "undefined" or "NaN". Include the start message box and its three hints, the next step chips, the More tab toggle, the search palette, light and dark, and a 375px width with no horizontal scroll.
* **Comprehension.** A short test with real launch marketers on the prototype, including Nigerian users on mid range Android, before wording is locked.

## 12. Deployment

Vercel for web. VPS with Docker Compose for API and Postgres. Environment variables for the Qloo key, model key and session secret. Backups of Postgres nightly. Public repository with an open source licence and a README that runs the demo locally.
