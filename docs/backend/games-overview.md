# How Games planning works

A technical overview of the Games agent, from the first message to a saved plan and its follow ups. Games is the third configuration of the shared launch runtime, so most of the path is the one in [film-overview.md](film-overview.md): read that first, then [music-overview.md](music-overview.md). This page says what is different. Product rules are in the [spec](../product/spec.md): §4.3 the query catalog, §5.6 and §5.7 the tests, §6.1 the modules, §6.2 the line check. What a good plan is: [games-agent.md](../product/games-agent.md).

## The one idea

A game is described by the **game** itself when Qloo knows it by name, by its **franchise** (earlier games, or by the same studio), and by up to four **comparable games**. The agent asks Qloo what that audience likes, kind of media by kind of media, because the question a games team asks is which fan bases to collaborate with and which regions to lead with. The game is an anchor but never a comp. A debut that Qloo does not know is planned from the comparable games, and the plan says so.

The two stages are Film's: code runs the queries and turns each result into a finding, then the model writes the plan from the findings and code checks every line. Games adds one thing the other two do not have: a **launch kind** (premium, early access, free to play, mobile) that decides the sections, the calendar, the measures and the budget split.

## What is shared and what is Games'

`apps/api/src/agent/launch/` is the runtime; `apps/api/src/agent/games/` is what Games adds, wired together in `games/config.ts` (`gamesLaunch`, a `LaunchConfig`).

| Piece | File | Games' part |
|---|---|---|
| Config | `games/config.ts` | Anchor and rival types (video game), the one question a build may ask (what the game is), the module choice, the budget split by kind, the "To sharpen" texts, the calendar built in code (`timeline`), the collab part of a what-if (`applyChange`), `lead`, `teamAnchors` (franchise), `beliefs` |
| Agent | `games/agent.ts` | `GamesAgent`, a `LaunchAgent` with `gamesLaunch` |
| Reader | `games/read.ts` | Game, launch kind, platforms, franchise, collabs, store tags, regions, creators, genre, studio country, budget, partners, comparable games, cities, age bands, gender, window. Every value is kept only if its quote is in the person's words; a name must also be in its own quote |
| Kind and platforms | `games/launch-kind.ts` | The kind a plan is for (the one read, or premium with `assumed` set) and its platforms (the ones named, or the kind's usual) |
| Query planner | `games/planner.ts` | The pack's defaults, or the model's choices checked by code (podcast genre, brand categories and candidates, cities, Worth a look) |
| Findings | `games/findings.ts` | The Games queries (spec §4.3): the profile and its two tests, the fan base bridge, theme tags, brands, podcasts, creators, campuses |
| Profile maths | `games/profile.ts` | Platform shares, shared tags and the matches, from what Qloo lists for the comparable games |
| Writer | `games/writer.ts` | The prompts, the brief block and the template lines for no key |
| Report writer | `games/report-writer.ts` | The audit's risks and alternatives, and the risks for the platforms and the store tags |
| Researcher | `games/research.ts` | The web search prompts: festival, sale and showcase dates, rivals, platform rules. Never the game's name |
| Follow-up reader | `games/follow-up.ts` | The prompt that reads a later message, including a collab to add |
| Run wrappers | `games/runs.ts` | `runGamesBuild`, `runGamesAudit`, `runGamesFix` with Games' dependencies, for the tests |
| Pack | `packages/packs/src/games/` | Query catalog and fan bases (`catalog.ts`), launch kinds, platform rules, calendars, measures, budget splits and module rules (`modules.ts`), the pack (`index.ts`) |
| Engine | `packages/engine/src/` | `gameProfiles` tool (`tools/game-profiles.ts`), `platformVerdict` and `storeTagVerdict` (`verdicts.ts`), `compareAudiences` with a rival type |

## Where Games differs from Film and Music

**Anchors.** `findComps` looks the game up with the comps (`config.lead`). The franchise joins the lookup through `config.teamAnchors`: it anchors the audience question like the comparable games, after the named ones so it never crowds one out, and counts toward the three a plan wants.

**Thin briefs.** `checkReading` fills `suggestedComps` from `fallbackComps` (`packages/packs/src/games/catalog.ts`) when the person named fewer than three and the model proposed none, so `findComps` always has games to look up and the build does not stop to ask for comps. A nationality in the brief becomes a region, which `REGION_CITIES` turns into cities.

**What Qloo cannot measure.** The reader keeps `audienceNote`, the language, culture or community the game is built for, in the person's words (quote-checked). It goes to the writer, the query planner and the web search, never to a Qloo call. The writer is told to cover it from its own knowledge as playbook lines, and the web step searches how players in the named regions get and pay for games. The planner may also name local brands for any ranked region (`askCities`), which Qloo then ranks for the audience.

**The launch kind.** The reader takes it from the brief (a model's choice kept only with its quote, or code's rule over the words: early access first, then mobile, then free to play). With nothing said, `kindOf` returns premium with `assumed` true, and "To sharpen this plan" says what was assumed. The kind picks the modules in order (`KIND_PROFILES[kind].modules`), the beats, the measures and the budget split (`packages/packs/src/games/modules.ts`). The platforms then remove what does not apply: festivals need a PC or console, a soft launch needs iOS or Android.

**The calendar is written by code.** `config.codeSections.timeline` builds Launch beats from the kind and the platforms with `beatsFor` and `datedBeats`. With a release date (a day in the window), each beat has dates; without one, weeks. A beat that is over on `today` is dropped, so no plan advises around a past date, and a release date in the past gives one line that says there is nothing left to plan. The writer is not asked for the timeline, and its other sections cite web sources for festival and sale dates. `WriteInput.today` carries the date.

**Regions.** A region word (Europe, Southeast Asia) stands for table cities (`REGION_CITIES`). Those cities are ranked in the same heatmap call but never become the team's own assumptions: only a city the person named does. With no region named, the kind's usual markets are ranked and shown as the plan's regions (`standInPlaces`), and the text says they are the regions a launch like this usually checks. A region word the table has no cities for is a gap.

**The fan base bridge** (`fanBases` in `games/findings.ts`). For each of the seven media (music, series, anime, film, brand, podcast, game) it asks `findTaste` for what the anchors' audience likes and ranks the top four by `affinity × 100`. Qloo gives the same affinity open as scored, so a medium with no collab costs one call. With a collab of that medium, one `compareAudiences` call of that type scores the collab with the rest, without leave one out, and its confidence is capped at medium. The rows go to `brief.fan` grouped by medium and carry a `medium`. Because Qloo scores one entity type per call, a row is compared with its own medium only. A collab is found by name across the media with `searchEntity` and belongs to the medium of its entity type; several exact matches are not guessed. Anime is asked first so the series list does not repeat it. `before` and `after` are equal: a collab is a ranked row, not a moved bar.

**Two tests only Games has.** `gameProfiles` reads what Qloo lists for the comparable games (`/entities`). The platforms the team named are tested against how many of them list each (`platformVerdict`), and the store tags against the tags at least half of them share (`storeTagVerdict`). They are the assumptions `a-platform` and `a-store-tags` with findings of the same names.

**Creators.** `CREATORS_GROUNDED` in `packages/packs/src/games/catalog.ts` is false until the creators probe says Qloo returns streamers for a game signal and [qloo.md](qloo.md) records it. While false, the Creators section is playbook, and the gap says creators were not measured.

**Audit.** The shared tests (age, gender, place, comps, partner, window) plus the platforms, the store tags, each named collab (its rank among the partners scored in its medium, by thirds) and each named creator when creators are grounded. The results the person adds are by region, compared as in Film. A weak or broken platform, tag or collab keeps the team's choice and offers what to add beside it.

## Data and events

The same tables and events as Film ([film-overview.md](film-overview.md#data-and-events)). A Games run's `agent` is `games`, its trace steps carry `games`, and its question ids start with `games.`. The brief's `fan` array holds the bridge; an output with `fan` rows gets the Fan base bridge tab, and one with two or more regions gets the Regions tab (`outputs/present.ts`). The Plan tab renders the new sections with the same component as every other section.

## Limits and config

The same settings as Film: `QLOO_MODE`, `QLOO_CALL_BUDGET`, `LLM_API_KEY`, `LLM_MODEL`. With no key, the scripted reader, the pack's default queries and the template writer still give a complete plan. The bridge costs one call per medium, plus one for each medium that has a collab, and one lookup per collab, so a plan with every medium and several regions uses most of the default 80 calls; if the budget runs out the plan is not saved and says so.

## Where to change things

| To change | Edit |
|---|---|
| A threshold or formula | spec §5 first, then `engine/verdicts.ts` or `scoring.ts` |
| What the reader pulls from a brief | `GAMES_READ_SYSTEM` and `gamesReadingSchema` in `games/read.ts` |
| Which queries exist, and their defaults | spec §4.3, then `packages/packs/src/games/catalog.ts` and `games/findings.ts` |
| A launch kind's sections, calendar, measures or budget | spec §6.1, then `KIND_PROFILES` in `packages/packs/src/games/modules.ts` |
| A store or platform rule | `PLATFORM_RULES` in `packages/packs/src/games/modules.ts` |
| Which fan bases the bridge ranks | `FAN_MEDIA` in `packages/packs/src/games/catalog.ts` |
| What a region word stands for | `REGION_CITIES` in `packages/packs/src/games/catalog.ts` and the city table in `packages/engine/src/places.ts` |
| How the model shapes queries | `QUERY_PLAN_SYSTEM` and `checkPlan` in `games/planner.ts` |
| What the writer is told | `PLAN_WRITER_SYSTEM`, `ANSWER_WRITER_SYSTEM`, `RULES` in `games/writer.ts` |
