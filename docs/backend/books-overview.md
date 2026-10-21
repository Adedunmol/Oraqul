# How Books planning works

A technical overview of the Books agent, from the first message to a saved plan and its follow ups. Books is the fifth configuration of the shared launch runtime, so most of the path is the one in [film-overview.md](film-overview.md): read that first, then [podcasts-overview.md](podcasts-overview.md), which Books follows most closely. This page says what is different. Product rules are in the [spec](../product/spec.md): §4.5 the query catalog, §5.10 and §5.11 the tests, §6.1 the modules, §6.2 the line check. What a good plan is: [books-agent.md](../product/books-agent.md).

## The one idea

A book is described by the **book** itself when Qloo knows it by name, by the **earlier books** by the same author or in the same series, and by up to four **comparable books**. The agent asks Qloo what that readership picks up next and follows on screen and in audio. The book is an anchor but never a comp, and the author is never an anchor: Qloo rejects a person as a signal. A debut that Qloo does not know is planned from the comparable books, and the plan says so.

The two stages are Film's: code runs the queries and turns each result into a finding, then the model writes the plan from the findings and code checks every line. Books adds a **launch kind** (a debut, a new book by an author, the next book in a series, a reissue), a **route** (a publisher, or self-published), a **readership** (adult, young adult, children) and **formats**, which decide the sections and the calendar. It also adds the **comp shelf** and the **adaptation bridge**, which no other category has.

## What is shared and what is Books'

`apps/api/src/agent/launch/` is the runtime; `apps/api/src/agent/books/` is what Books adds, wired together in `books/config.ts` (`booksLaunch`, a `LaunchConfig`).

| Piece | File | Books' part |
|---|---|---|
| Config | `books/config.ts` | Anchor and rival types (book), the one question a build may ask (what the book is), the module choice, the budget split by kind and route, the "To sharpen" texts, the calendar built in code (`timeline`), the screen part of a what-if (`applyChange`, which reads `addCollabs` as screen titles), `lead`, `teamAnchors` (earlier books), `beliefs` (a named screen title, a named bookshop) |
| Agent | `books/agent.ts` | `BooksAgent`, a `LaunchAgent` with `booksLaunch` |
| Reader | `books/read.ts` | Book, author, launch kind, route, readership, formats, earlier books, screen titles, bookshops, genre, country, markets, budget, partners, comparable books, cities, age bands, gender, window. Every value is kept only if its quote is in the person's words; a name must also be in its own quote. The route follows plain words before the model: "an independent press" is a publisher |
| Kind, route, readership | `books/launch-kind.ts` | The kind (the one read, a new book when earlier books are named, or a debut with `assumed` set), the route and readership (or a publisher and adult readers, `assumed`), and whether there is an audiobook |
| Query planner | `books/planner.ts` | The pack's defaults, or the model's choices checked by code (genre phrase, shelf city, bookshop cities, brand categories and candidates, screen titles, Worth a look) |
| Findings | `books/findings.ts` | The Books queries (spec §4.5): the shelf and the comp recency tests, the bridge, podcasts, themes, brands, bookshops |
| Writer | `books/writer.ts` | The prompts, the brief block and the template lines for no key |
| Report writer | `books/report-writer.ts` | The audit's risks and alternatives, and the risk for a bookshop that ranks low |
| Researcher | `books/research.ts` | The web search prompts: festivals and prizes, rival releases, retail norms, where the market buys books. Never the book's title or its author |
| Follow-up reader | `books/follow-up.ts` | The prompt that reads a later message, including a screen title to add |
| Run wrappers | `books/runs.ts` | `runBooksBuild`, `runBooksAudit`, `runBooksFix` with Books' dependencies, for the tests |
| Pack | `packages/packs/src/books/` | Query catalog, fallback books and screen titles (`catalog.ts`), launch kinds, routes, readerships, formats, calendars, measures, budget splits and module rules (`modules.ts`), the pack (`index.ts`) |
| Engine | `packages/engine/src/` | `bookProfiles` tool (`tools/book-profiles.ts`), `compAgeVerdict` (`verdicts.ts`), `findTaste` and `compareAudiences` with a book type, series-mark matching in `normalizeTitle`, and the demo data (`qloo/demo-fetch.ts`) |

Sections for a plan are the module keys of spec §6.1. Books adds `comps`, `adaptation`, `retail`, `audio` and `schools` to `launchModuleKeys`, and uses `partnerships` for Brand partners, `publicity` for Press and reviews, `events` for Events and festivals, `creators` for BookTok and creators, `community` for Book clubs and community and `cadence` for Series and backlist. The shared partner brief writes into `partnerships`, so Brand partners keeps that key.

## Where Books differs from Film, Music, Games and Podcasts

**Anchors.** `findComps` looks the book up with the comps (`config.lead`). The earlier books join the lookup through `config.teamAnchors`: they anchor the audience question like the comparable books, after the named ones so they never crowd one out, and count toward the three a plan wants. A title the team named for the screen angle is never added as a comp.

**Series marks.** Qloo lists a book in a series with its series ("Fourth Wing (The Empyrean, #1)") and writes an ampersand as HTML. `normalizeTitle` ignores both, so a name matches with or without them. A comp the team named and the same book proposed as a fallback are one book, whatever the spelling.

**Thin briefs.** `checkReading` fills `suggestedComps` from `fallbackComps` (`packages/packs/src/books/catalog.ts`) when the person named fewer than three and the model proposed none, so a build does not stop to ask for comps. A nationality in the brief becomes a market, which the region table or the city table turns into cities.

**What Qloo cannot measure.** The reader keeps `audienceNote`, the language, culture or community the book is for, in the person's words (quote-checked). It goes to the writer, the query planner and the web search, never to a Qloo call.

**The kind, route, readership and formats.** The reader takes them from the brief (a model's choice kept only with its quote, or code's rule over the words: `kindFrom`, `routeFrom`, `readershipFrom` and `formatsFrom`). With nothing said, the kind is a debut (a new book when earlier books are named), the route a publisher's and the readers adults, and "To sharpen this plan" says what was assumed. The kind picks the modules in order (`KIND_PROFILES[kind].modules`), the beats, the measures and the budget split by route. The route, readership and formats then remove what does not apply: retail sell-in is for a publisher's book, schools are for young readers, an audiobook section needs an audiobook.

**The calendar is written by code.** `config.codeSections.timeline` builds Launch beats from the kind, the route, the readership and the formats with `beatsFor` and the shared `datedBeats`. With a publication date (a day in the window), each beat has dates; without one, weeks. A beat that is over on `today` is dropped, so no plan advises around a past date, and a date in the past gives one line that says there is nothing left to plan.

**Markets.** A region word (Europe, West Africa) stands for table cities (`REGION_CITIES`). Those cities are ranked in the same heatmap call but never become the team's own assumptions: only a city the person named does. With none named, the five usual markets are ranked and shown as the plan's markets (`standInPlaces`).

**The shelf** (`shelfAndAges` in `books/findings.ts`). `bookProfiles` reads what Qloo lists for each anchor (publication year, pages, series, genre, format) in one lookup. `findTaste` of type book, with the genre tag, the home city, the age band and a first publication year five years before the launch (and never later than today), lists the books the readers pick up. A book of an anchor's own series and an omnibus entry are dropped, one book stands for each series, and the first six become the `brief.shelf` rows, with overlap = affinity × 100 and a receipt each. The finding is `f-shelf`.

**Comp recency** (`compAges`). Each comp the team named is an assumption (`a-comp-age-<slug>`) with a finding of the same name, tested with `compAgeVerdict` from the publication year in the profile and the year of the launch: five years or fewer holds, six to ten is weak, older breaks, no year is cannot test. A weak or broken comp keeps its place, and its fix names the recent shelf books beside it.

**The bridge** (`bridge`). For series and for films, candidates are the titles the team named (a name is looked up as a series first, then as a film; of several same-name titles the best known is used) and the planner's or the pack's choices (`SCREEN_CANDIDATES`). One `compareAudiences` call per medium scores them, so a named title is a ranked row (`f-screen-<slug>`, with `place` and `of`). Podcasts come from `findTaste` of type podcast with the books genre tag, which Qloo lists on topic. The rows go to `brief.bridge` with a medium; the web ranks them only inside their medium. Qloo's open lists of series and films for a book audience drift, so none is asked.

**Bookshops** (`bookshops`). `findTaste` of type place with the book store category, per city (up to three). A venue filter drops landmarks. The findings feed Events and festivals and the audit's bookshop belief.

**Creators.** `CREATORS_GROUNDED` in `packages/packs/src/books/catalog.ts` is false: the live probe returned authors for a literary fiction audience but voice actors and narrators for a fantasy one. While false, the Creators section is playbook and the gaps say so.

**Audit.** The shared tests (age, gender, place, comps, partner, window) plus each comp's age (from the findings' assumptions), each named screen title (its rank among the titles scored in one call, by thirds, with at least three ranked) and each named bookshop (in the top three of Qloo's list holds, listed lower is weak, not listed is cannot test). The results the person adds are by market, compared as in Film. A weak or broken item keeps the team's choice and offers what to add beside it.

## Data and events

The same tables and events as Film ([film-overview.md](film-overview.md#data-and-events)). A Books run's `agent` is `books`, its trace steps carry `books`, and its question ids start with `books.`. An output with `brief.shelf` gets the Comp shelf tab, one with `brief.bridge` the Adaptation bridge tab, and one with two or more places the Markets tab (`outputs/present.ts`, which also words their labels and the limits copy for Books). The Plan tab renders the new sections with the same component as every other section.

## Limits and config

The same settings as Film: `QLOO_MODE`, `QLOO_CALL_BUDGET`, `LLM_API_KEY`, `LLM_MODEL`. With no key, the scripted reader, the pack's default queries and the template writer still give a complete plan. A full plan uses a search per named book and screen title, a lookup for the profiles, a list for the shelf, one scoring call per medium, a list of podcasts, a call per brand pool, a bookshop list per city and a heatmap call: about 35 to 50 Qloo calls. If the budget runs out the plan is not saved and says so.

## Where to change things

| To change | Edit |
|---|---|
| A threshold or formula | spec §5 first, then `engine/verdicts.ts` |
| What the reader pulls from a brief | `BOOKS_READ_SYSTEM` and `booksReadingSchema` in `books/read.ts` |
| Which queries exist, and their defaults | spec §4.5, then `packages/packs/src/books/catalog.ts` and `books/findings.ts` |
| A launch kind's sections, calendar, measures or budget | spec §6.1, then `KIND_PROFILES` in `packages/packs/src/books/modules.ts` |
| The words that read the kind, route, readership and formats | `kindFrom`, `routeFrom`, `readershipFrom` and `formatsFrom` in `packages/packs/src/books/modules.ts` |
| Which books stand in when none is named | `FALLBACK_COMPS` in `packages/packs/src/books/catalog.ts` |
| Which series and films the bridge scores by default | `SCREEN_CANDIDATES` in `packages/packs/src/books/catalog.ts` |
| What a region word stands for | `REGION_CITIES` in `packages/packs/src/books/catalog.ts` and the city table in `packages/engine/src/places.ts` |
| How the model shapes queries | `QUERY_PLAN_SYSTEM` and `checkPlan` in `books/planner.ts` |
| What the writer is told | `PLAN_WRITER_SYSTEM`, `ANSWER_WRITER_SYSTEM`, `RULES` in `books/writer.ts` |
| The tab words and limits copy | `BOOK_TABS` and `LIMITS` in `apps/api/src/outputs/present.ts` |
