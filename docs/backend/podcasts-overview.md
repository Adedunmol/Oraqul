# How Podcasts planning works

A technical overview of the Podcasts agent, from the first message to a saved plan and its follow ups. Podcasts is the fourth configuration of the shared launch runtime, so most of the path is the one in [film-overview.md](film-overview.md): read that first, then [games-overview.md](games-overview.md), which Podcasts follows most closely. This page says what is different. Product rules are in the [spec](../product/spec.md): §4.4 the query catalog, §5.8 and §5.9 the tests, §6.1 the modules, §6.2 the line check. What a good plan is: [podcasts-agent.md](../product/podcasts-agent.md).

## The one idea

A podcast is described by the **show** itself when Qloo knows it by name, by its **earlier shows** (by the same host or network), and by up to four **comparable shows**. The agent asks Qloo what that audience likes and which topics it carries that rival shows' audiences do not. The show is an anchor but never a comp. A new show that Qloo does not know is planned from the comparable shows, and the plan says so.

The two stages are Film's: code runs the queries and turns each result into a finding, then the model writes the plan from the findings and code checks every line. Podcasts adds a **launch kind** (a new show or a new season) and a **format** (audio, video or both) that decide the sections and the calendar, and the **topic map**, which no other category has.

## What is shared and what is Podcasts'

`apps/api/src/agent/launch/` is the runtime; `apps/api/src/agent/podcasts/` is what Podcasts adds, wired together in `podcasts/config.ts` (`podcastsLaunch`, a `LaunchConfig`).

| Piece | File | Podcasts' part |
|---|---|---|
| Config | `podcasts/config.ts` | Anchor and rival types (podcast), the one question a build may ask (what the show is), the module choice, the budget split by kind, the "To sharpen" texts, the calendar built in code (`timeline`), the swap part of a what-if (`applyChange`, which reads `addCollabs` as swaps), `lead`, `teamAnchors` (earlier shows), `beliefs` (a named swap) |
| Agent | `podcasts/agent.ts` | `PodcastsAgent`, a `LaunchAgent` with `podcastsLaunch` |
| Reader | `podcasts/read.ts` | Show, launch kind, format, style, platforms, earlier shows, swaps, rivals, topics, hosts, guests, markets, genre, producer country, budget, sponsors, comparable shows, cities, age bands, gender, window. Every value is kept only if its quote is in the person's words; a name must also be in its own quote |
| Kind and format | `podcasts/launch-kind.ts` | The kind (the one read, or a new show with `assumed` set), the format (or audio, `assumed`) and the platforms (the ones named, or the usual ones for the format) |
| Query planner | `podcasts/planner.ts` | The pack's defaults, or the model's choices checked by code (genre phrase, brand categories and candidates, cities, Worth a look) |
| Findings | `podcasts/findings.ts` | The Podcasts queries (spec §4.4): the topic map and its topic tests, cross promotion, sponsors, guests, crossover |
| Writer | `podcasts/writer.ts` | The prompts, the brief block and the template lines for no key |
| Report writer | `podcasts/report-writer.ts` | The audit's risks and alternatives, and the risk for a topic that is not the team's alone |
| Researcher | `podcasts/research.ts` | The web search prompts: editorial rules, rival shows, sponsor norms, how the market listens. Never the show's name |
| Follow-up reader | `podcasts/follow-up.ts` | The prompt that reads a later message, including a swap to add |
| Run wrappers | `podcasts/runs.ts` | `runPodcastsBuild`, `runPodcastsAudit`, `runPodcastsFix` with Podcasts' dependencies, for the tests |
| Pack | `packages/packs/src/podcasts/` | Query catalog and fallback shows (`catalog.ts`), launch kinds, formats, platforms, calendars, measures, budget splits and module rules (`modules.ts`), the pack (`index.ts`) |
| Engine | `packages/engine/src/` | `topicMap` tool (`tools/topic-map.ts`), `topicVerdict` (`verdicts.ts`), `compareAudiences` with a podcast rival type, and the demo data (`qloo/demo-fetch.ts`) |

Sections for a plan are the module keys of spec §6.1. Podcasts adds `crosspromo`, `guests`, `live` and `video` to `launchModuleKeys`, and uses `partnerships` for Sponsors, `publicity` for Press and newsletters and `cadence` for Episode cadence. The shared partner brief writes into `partnerships`, so Sponsors keeps that key.

## Where Podcasts differs from Film, Music and Games

**Anchors.** `findComps` looks the show up with the comps (`config.lead`). The earlier shows join the lookup through `config.teamAnchors`: they anchor the audience question like the comparable shows, after the named ones so they never crowd one out, and count toward the three a plan wants.

**Thin briefs.** `checkReading` fills `suggestedComps` from `fallbackComps` (`packages/packs/src/podcasts/catalog.ts`) when the person named fewer than three and the model proposed none, so a build does not stop to ask for comps. A show the team named as a swap, a rival or an earlier show is never added as a comp. A nationality in the brief becomes a market, which the region table or the city table turns into cities.

**What Qloo cannot measure.** The reader keeps `audienceNote`, the language, culture or community the show is made for, in the person's words (quote-checked). It goes to the writer, the query planner and the web search, never to a Qloo call.

**The launch kind and the format.** The reader takes them from the brief (a model's choice kept only with its quote, or code's rule over the words, `kindFrom` and `formatFrom`). With nothing said, the kind is a new show and the format audio, and "To sharpen this plan" says what was assumed. The kind picks the modules in order (`KIND_PROFILES[kind].modules`), the beats, the measures and the budget split. The format and style then remove what does not apply: video needs a filmed show, guests are dropped for a narrative show unless named.

**The calendar is written by code.** `config.codeSections.timeline` builds Launch beats from the kind and the platforms with `beatsFor` and the shared `datedBeats`. With a release date (a day in the window), each beat has dates; without one, weeks. A beat that is over on `today` is dropped, so no plan advises around a past date, and a release date in the past gives one line that says there is nothing left to plan.

**Markets.** A region word (Europe, West Africa) stands for table cities (`REGION_CITIES`). Those cities are ranked in the same heatmap call but never become the team's own assumptions: only a city the person named does. With none named, the five usual markets are ranked and shown as the plan's markets (`standInPlaces`).

**The topic map** (`topicMap` in `podcasts/findings.ts`). `findTaste` lists the shows the audience hears in the genre (one call, shared by cross promotion and the topic map). The rivals are the shows the team named, or with none those shows. `tools.topicMap` makes one `analysis.compare` call, anchors against rivals, and `topicOwnership` splits the tags: a topic only the anchors' side lists is yours, one on both sides is shared, one only the rivals' side lists is theirs. A yours topic's weight is its count against the mean count of a rival topic, which orders and sizes topics and never decides who owns one. The topics go to `brief.topics` (the Topic map tab). Each topic the team named is an assumption (`a-topic-<slug>`) with a finding of the same name, tested with `topicVerdict`: yours holds, shared is weak, the rivals' breaks, not returned is cannot test.

**Cross promotion** (`crossPromotion`). `findTaste` lists shows, then one `compareAudiences` of type podcast scores them together with any swap the team named, so a named show is a ranked row (`f-promo-<slug>`). The rows go to `brief.fan` with medium podcast and the note "Your pick"; `before` and `after` are equal, since a swap is a ranked row, not a moved bar. A swap is found by exact name with `searchEntity`; several exact matches are not guessed.

**Guests and crossover.** `GUESTS_GROUNDED` and `CROSSOVER_GROUNDED` in `packages/packs/src/podcasts/catalog.ts` are false: the live probe (2026-10-20) returned people, artists and series for a podcast audience, but with no subject context they drifted (reality TV personalities and comedies for a true crime audience). While false, the Guests section is playbook and the crossover query is not run; the gaps say so.

**Audit.** The shared tests (age, gender, place, comps, partner, window) plus each named topic (from the findings' assumptions) and each named swap (its rank among the shows scored in one call, by thirds). Guests are not tested. The results the person adds are by market, compared as in Film. A weak or broken topic or swap keeps the team's choice and offers what to add beside it.

## Data and events

The same tables and events as Film ([film-overview.md](film-overview.md#data-and-events)). A Podcasts run's `agent` is `podcasts`, its trace steps carry `podcasts`, and its question ids start with `podcasts.`. An output with `brief.topics` gets the Topic map tab, one with `fan` rows the Cross promotion tab and one with two or more places the Markets tab (`outputs/present.ts`, which also words their labels and the limits copy for Podcasts). The Plan tab renders the new sections with the same component as every other section.

## Limits and config

The same settings as Film: `QLOO_MODE`, `QLOO_CALL_BUDGET`, `LLM_API_KEY`, `LLM_MODEL`. With no key, the scripted reader, the pack's default queries and the template writer still give a complete plan. A full plan uses a search per named show, two calls for the shows and the topic map, a call per brand pool and a heatmap call; if the budget runs out the plan is not saved and says so.

## Where to change things

| To change | Edit |
|---|---|
| A threshold or formula | spec §5 first, then `engine/verdicts.ts` or `tools/topic-map.ts` |
| What the reader pulls from a brief | `PODCASTS_READ_SYSTEM` and `podcastsReadingSchema` in `podcasts/read.ts` |
| Which queries exist, and their defaults | spec §4.4, then `packages/packs/src/podcasts/catalog.ts` and `podcasts/findings.ts` |
| A launch kind's sections, calendar, measures or budget | spec §6.1, then `KIND_PROFILES` in `packages/packs/src/podcasts/modules.ts` |
| The words that read the kind, format and style | `kindFrom`, `formatFrom` and `styleFrom` in `packages/packs/src/podcasts/modules.ts` |
| Which shows stand in when none is named | `FALLBACK_COMPS` in `packages/packs/src/podcasts/catalog.ts` |
| What a region word stands for | `REGION_CITIES` in `packages/packs/src/podcasts/catalog.ts` and the city table in `packages/engine/src/places.ts` |
| How the model shapes queries | `QUERY_PLAN_SYSTEM` and `checkPlan` in `podcasts/planner.ts` |
| What the writer is told | `PLAN_WRITER_SYSTEM`, `ANSWER_WRITER_SYSTEM`, `RULES` in `podcasts/writer.ts` |
| The tab words and limits copy | `PODCAST_TABS` and `LIMITS` in `apps/api/src/outputs/present.ts` |
