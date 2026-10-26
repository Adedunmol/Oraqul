# Music

What "good" means for a Music plan, and what is Music's own in code. Shared rules are in [principles.md](../product/principles.md); the runtime every category shares is in [launch-runtime.md](../backend/launch-runtime.md). Film is the model for this one: where a rule is the same, [film.md](film.md) has the reasoning. Behaviour and numbers are in the [spec](../product/spec.md): §4.2 the query catalog, §5.4 and §5.5 the tests, §6.1 the modules.

## What a launch plan has to settle

A plan is a set of decisions, not a document:

| Decision | What it covers |
|---|---|
| Where, in what order | The cities and the order the artist plays them: where the audience is strongest, and whether the order starts strong |
| When | Release date or tour window, against rival releases and seasonal peaks |
| Who | Core and secondary audience, what each plays and watches, where it gathers |
| Who opens | Support acts for each tour city, from the artists that city's audience plays |
| How to reach them | Press, podcasts and playlists, creators and short video, sync (series and films the audience watches), campuses and neighbourhoods, brand partners |
| Cost and measures | A budget split and the numbers to track |
| Risks | A tour order that starts weak, a thin city, a support act that leans on one sound-alike, an artist Qloo does not know yet |

## Requirements 

1. **Plan for the team's decisions.** Their cities, the order they set, age band, sound-alike artists and window are constraints. Test them and say what Qloo found, never replace them. The tour order is scored against the strongest order and the plan says so, but it keeps the team's order and offers the other beside it. Every named city and sound-alike gets an answer. An act featured on the release or tour is part of what the team told us about the audience: it anchors the read like a sound-alike and is tested like a support act.
2. **Work with thin input.** Use everything given, ask for nothing beyond what is being released and one city, and end with what would sharpen the plan.
3. **Know whether Qloo knows the artist.** An artist Qloo finds by exact name leads the audience question. A debut it does not know is planned from the sound-alike artists named, and the plan says that is what it rests on. With neither, the genre's audience stands in and the line says so.
4. **Be realistic about scale.** An independent artist gets in-kind support, not sponsorship cash. Brand fit (what the audience likes) and ability to partner (who will say yes) are different questions, and so are a support act the audience plays and one who is free and willing. Qloo answers only the first of each pair.
5. **Be date-aware.** Windows, rival releases and today's date matter. Never advise around a release that has already come out.
6. **Be actionable.** Each line is the move, the reason and who does it. Readable in about five minutes, short lines, plain words, no data jargon in the plan.
7. **Never invent the music.** Its sound, lyrics, themes, collaborators and story come only from the brief. What the audience plays is what to speak to, never what the record contains.
8. **No forecasts.** No stream, chart or ticket predictions, and no pricing advice.
9. **Be exportable and revisable.** PDF, Word and Markdown built as documents; a what-if reruns the plan.

## What grounded means for Music

- **Examples.** A plain model names the biggest artists, the biggest playlists and the biggest brands. A grounded plan names the actual support acts, podcasts, series and campuses this audience ranks highest in each city.
- **The team's assumptions are tested.** The age band, each city and the tour order are checked against Qloo. A plan that starts the tour in a city that ranks last is told so, and keeps the team's order with the stronger one beside it.
- **Where a chatbot beats us.** Qloo has no venues, promoters, radio, playlists or ticket prices, so booking, routing and the playlist game come from launch knowledge, labelled as such. We win on who the audience is and what it plays in each city, not on logistics.

## Known limits

- **Artist signals are verified on one brief.** An artist works as a signal for support acts, series, films, brands, podcasts and campuses (an Afrobeats artist, [qloo.md](../backend/qloo.md)). Other genres and markets are not checked. Series for African cities lean on American shows, so those lines are leads, not facts about the city.
- **A debut is planned from its sound-alikes.** If those are off, the audience is off. The plan says what it rests on, and the sound-alikes test shows when one title carries the result.
- **No venues, promoters, radio or playlists.** Qloo does not rank them, so the plan gives practice, not names, and does not claim a venue fits.
- **The strongest order is not a routing.** The route score orders cities by audience strength, not by travel, venue availability or dates.
- **Support acts are who the audience plays**, not who is available or affordable. The plan ranks in Qloo's order and leaves booking to the team.
- **Neighbourhood readings are a lead.** The cells are coarse (about 3 to 7 km). Confirm on the ground.
- **Web research can find nothing for a city**, and what it finds can be stale. Check dates before acting on a rival or a window.
- **Ambiguous names** are settled in code (country, then popularity) and the plan says which was chosen. Artist names collide often. A wrong match is possible.
- **Cultural sensitivity.** Real scenes, institutions and neighbourhoods need care in anything the plan puts on screen or in a campaign.

## Launch rules

Thresholds and bands are in [launch-rules.md](../product/launch-rules.md). For Music:

* **Calendar.** A rollout of 6 to 8 weeks, worked back from the release date in code: delivery and playlist pitches 8 weeks out, pre-save at 6, press at 4, the video at 2, then follow-through for four weeks.
* **Signal.** Save rate and stream completion. Followers, views and playlist adds are secondary.
* **Channels.** TikTok, Reels and Shorts lead; Nigeria leads on Instagram and TikTok; WhatsApp is only a sharing layer.
* **Territories.** One plan per tour city, the home market first, then the diaspora cities, beside the tour route.

## How it works in code

### The one idea

An established artist is often already in Qloo, and a debut is not. So the agent describes the launch by the **artist** when Qloo knows it by name, plus up to four **sound-alike artists** (the comps), and asks Qloo what that audience likes. The artist is an anchor but never a comp: it is not listed under Comps, and a name Qloo does not know is not a failure, it is a debut. The plan then rests on the sound-alikes, says so, and names the artist under "Could not test" in the Assumptions tab.

The two stages are Film's: code runs the queries and turns each result into a finding, then the model writes the plan from the findings and code checks every line.

### What is shared and what is Music's

`apps/api/src/agent/launch/` is the runtime; `apps/api/src/agent/music/` is what Music adds, wired together in `music/config.ts` (`musicLaunch`, a `LaunchConfig`). Music has no code of its own for reading a plan, finding comps, asking Qloo, checking a line, saving or following up: those are the runtime's.

| Piece | File | Music's part |
|---|---|---|
| Config | `music/config.ts` | Anchor and rival types (artist), the one question a build may ask, the module rules, the budget split and "To sharpen" texts, the check and decision wording, `lead`, `beliefs` |
| Agent | `music/agent.ts` | `MusicAgent`, a `LaunchAgent` with `musicLaunch` |
| Reader | `music/read.ts` | Artist, release type, sound, country, cities in the order written, age bands, gender, budget, partners, booked support acts, featured acts, sound-alikes. Every value is kept only if its quote is in the person's words; the artist's name must also be in its own quote |
| Query planner | `music/planner.ts` | The pack's defaults, or the model's choices checked by code (scene, cities, brand candidates, neighbourhoods) |
| Findings | `music/findings.ts` | The Music queries (spec §4.2) and the route finding |
| Writer | `music/writer.ts` | The prompts, the brief block and the template lines for no key |
| Report writer | `music/report-writer.ts` | The audit's risks and alternatives, and the risk for a weak tour order |
| Researcher | `music/research.ts` | The web search prompts: touring and release context, never the artist's name or the record's title |
| Follow-up reader | `music/follow-up.ts` | The prompt that reads a later message |
| Run wrappers | `music/runs.ts` | `runMusicBuild`, `runMusicAudit`, `runMusicFix` with Music's dependencies, for the tests |
| Pack | `packages/packs/src/music/` | Query catalog (`catalog.ts`), module rules and budget convention (`modules.ts`), the pack (`index.ts`) |
| Route score | `packages/engine/src/scoring.ts`, `verdicts.ts` | `routeScore`, `bestRoute`, `routeVerdict` |

### Where Music differs from Film

**Anchors.** `findComps` looks the artist up with the comps (`config.lead`). An exact name, or a same-name pick settled by country, becomes an anchor. **Featured acts** (a feature or guest on the release or tour) join the lookup through `config.teamAnchors`: they anchor the audience question like the team's own sound-alikes, but come after the named sound-alikes so they never crowd one out, and count toward the three a plan wants. They are not listed as sound-alikes in the brief, and the audit tests each one like a support act. A close name is never used for the artist, since a guess would describe the wrong audience. Not found goes to Gaps. With no sound-alike found either, the genre fallback is the runtime's: the artists Qloo lists for the sound's genre tag stand in, and the comps are labelled as found from the genre.

**Modules.** `pickModules` in the Music pack (spec §6.1): Tour route needs two or more cities, Support acts are dropped for a single, Budget split is always offered. A narrow ask names one of these.

**Queries.** Support acts (artists per tour city in the sound's scene, the anchors excluded by `findTaste`), brands as in Film, podcasts, series and films for sync, neighbourhoods from the heatmap already pulled, and universities. There is no venue or theme query. An artist is a usable signal for each, checked live on one Afrobeats brief ([qloo.md](../backend/qloo.md)); Other genres and markets are not probed one by one: Qloo's coverage differs by genre and place, and thin data shows as "could not test" or lower confidence, never as a guess.

**The tour order** (`routeFinding` in `music/findings.ts`). The cities that could be ranked, in the order the team wrote them, are scored with `routeScore` against `bestRoute` over the same lifts. The ratio becomes a verdict with `routeVerdict` (spec §5.4). It is stored as the assumption `a-route` and the finding `f-a-route`, whose entities are the strongest order. A weak or broken order keeps the team's order and offers the other beside it; it never says to drop a city.

**Audit.** The shared tests (age, gender, place, comps, partner, window) plus the tour order and each support act the plan names (`testArtists`, by its rank among the artists Qloo returned). The results the person adds are tickets or streams by city, compared as in Film.

### Where to change things

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

## Also open

- Only demo goldens are recorded; no live golden run exists.
- The screens are the shared ones (Plan tab, receipts drawer, exports) plus this category's own tabs. They have not been compared with the prototype.
- The gaps every category shares are in [launch-runtime.md](../backend/launch-runtime.md#known-gaps).
