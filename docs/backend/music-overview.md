# How Music planning works

A technical overview of the Music agent, from the first message to a saved plan and its follow ups. Music is the second configuration of the shared launch runtime, so most of the path is the one in [film-overview.md](film-overview.md): read that first. This page says what is different. Product rules are in the [spec](../product/spec.md): §4.2 the query catalog, §5.4 and §5.5 the tests, §6.1 the modules, §6.2 the line check. What a good plan is: [music-agent.md](../product/music-agent.md).

## The one idea

An established artist is often already in Qloo, and a debut is not. So the agent describes the launch by the **artist** when Qloo knows it by name, plus up to four **sound-alike artists** (the comps), and asks Qloo what that audience likes. The artist is an anchor but never a comp: it is not listed under Comps, and a name Qloo does not know is not a failure, it is a debut. The plan then rests on the sound-alikes, says so, and names the artist under "Could not test" in the Assumptions tab.

The two stages are Film's: code runs the queries and turns each result into a finding, then the model writes the plan from the findings and code checks every line.

## What is shared and what is Music's

`apps/api/src/agent/launch/` is the runtime; `apps/api/src/agent/music/` is what Music adds, wired together in `music/config.ts` (`musicLaunch`, a `LaunchConfig`). Music has no code of its own for reading a plan, finding comps, asking Qloo, checking a line, saving or following up: those are the runtime's.

| Piece | File | Music's part |
|---|---|---|
| Config | `music/config.ts` | Anchor and rival types (artist), the one question a build may ask, the module rules, the budget split and "To sharpen" texts, the check and decision wording, `lead`, `beliefs` |
| Agent | `music/agent.ts` | `MusicAgent`, a `LaunchAgent` with `musicLaunch` |
| Reader | `music/read.ts` | Artist, release type, sound, country, cities in the order written, age bands, gender, budget, partners, booked support acts, sound-alikes. Every value is kept only if its quote is in the person's words; the artist's name must also be in its own quote |
| Query planner | `music/planner.ts` | The pack's defaults, or the model's choices checked by code (scene, cities, brand candidates, neighbourhoods) |
| Findings | `music/findings.ts` | The Music queries (spec §4.2) and the route finding |
| Writer | `music/writer.ts` | The prompts, the brief block and the template lines for no key |
| Report writer | `music/report-writer.ts` | The audit's risks and alternatives, and the risk for a weak tour order |
| Researcher | `music/research.ts` | The web search prompts: touring and release context, never the artist's name or the record's title |
| Follow-up reader | `music/follow-up.ts` | The prompt that reads a later message |
| Run wrappers | `music/runs.ts` | `runMusicBuild`, `runMusicAudit`, `runMusicFix` with Music's dependencies, for the tests |
| Pack | `packages/packs/src/music/` | Query catalog (`catalog.ts`), module rules and budget convention (`modules.ts`), the pack (`index.ts`) |
| Route score | `packages/engine/src/scoring.ts`, `verdicts.ts` | `routeScore`, `bestRoute`, `routeVerdict` |

## Where Music differs from Film

**Anchors.** `findComps` looks the artist up with the comps (`config.lead`). An exact name, or a same-name pick settled by country, becomes an anchor. A close name is never used for the artist, since a guess would describe the wrong audience. Not found goes to Gaps. With no sound-alike found either, the genre fallback is the runtime's: the artists Qloo lists for the sound's genre tag stand in, and the comps are labelled as found from the genre.

**Modules.** `pickModules` in the Music pack (spec §6.1): Tour route needs two or more cities, Support acts are dropped for a single, Budget split is always offered. A narrow ask names one of these.

**Queries.** Support acts (artists per tour city in the sound's scene, the anchors excluded by `findTaste`), brands as in Film, podcasts, series and films for sync, neighbourhoods from the heatmap already pulled, and universities. There is no venue or theme query. Whether an artist is a usable signal for each is `TODO(verify)` until `pnpm --filter @oraqul/engine qloo:music-probes` has been run and [qloo.md](qloo.md) says so.

**The tour order** (`routeFinding` in `music/findings.ts`). The cities that could be ranked, in the order the team wrote them, are scored with `routeScore` against `bestRoute` over the same lifts. The ratio becomes a verdict with `routeVerdict` (spec §5.4). It is stored as the assumption `a-route` and the finding `f-a-route`, whose entities are the strongest order. A weak or broken order keeps the team's order and offers the other beside it; it never says to drop a city.

**Audit.** The shared tests (age, gender, place, comps, partner, window) plus the tour order and each support act the plan names (`testArtists`, by its rank among the artists Qloo returned). The results the person adds are tickets or streams by city, compared as in Film.

## Data and events

The same tables and events as Film ([film-overview.md](film-overview.md#data-and-events)). A Music run's `agent` is `music`, its trace steps carry `music`, and its question ids start with `music.`. The Plan tab renders the new sections (`tour`, `support`, `sync`) with the same component as every other section.

## Limits and config

The same settings as Film: `QLOO_MODE`, `QLOO_CALL_BUDGET`, `LLM_API_KEY`, `LLM_MODEL`. With no key, the scripted reader, the pack's default queries and the template writer still give a complete plan.

## Where to change things

| To change | Edit |
|---|---|
| A threshold or formula | spec §5 first, then `engine/scoring.ts` or `verdicts.ts` |
| What the reader pulls from a brief | `MUSIC_READ_SYSTEM` and `musicReadingSchema` in `music/read.ts` |
| Which queries exist, and their defaults | spec §4.2, then `packages/packs/src/music/catalog.ts` and `music/findings.ts` |
| How the model shapes queries | `QUERY_PLAN_SYSTEM` and `checkPlan` in `music/planner.ts` |
| Which modules a plan gets | spec §6.1, then `pickModules` in `packages/packs/src/music/modules.ts` |
| A finding's sentence | `music/findings.ts` (Music's queries), `launch/findings.ts` (audience and cities) |
| What the writer is told | `PLAN_WRITER_SYSTEM`, `ANSWER_WRITER_SYSTEM`, `RULES` in `music/writer.ts` |
| The template wording | `templateSection` in `music/writer.ts` |
| The tour order test | `routeFinding` in `music/findings.ts` |
| Expected results of the golden runs | `packages/eval/golden/music/*.json` (`UPDATE_GOLDEN=1`) |
