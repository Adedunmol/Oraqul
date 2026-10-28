# Podcasts

What "good" means for a Podcasts plan, and what is Podcasts's own in code. Shared rules are in [principles.md](../product/principles.md); the runtime every category shares is in [launch-runtime.md](../backend/launch-runtime.md). Film, Music and Games are the models for this one. Behaviour and numbers are in the [spec](../product/spec.md): the query catalog (§4.3), the tests and §6.1 the modules.

## What a launch plan has to settle

A plan is a set of decisions, not a document:

| Decision | What it covers |
|---|---|
| Where | The markets to lead with and in what order: where the show's listeners are strongest, and where the spend and the live work go |
| When | The release date or window, and every beat before it |
| Who | Core and secondary audience, what else they hear, watch and follow |
| What to own | The topics the show can be known for that rival shows do not own, and the topics the team wanted that it does not own alone |
| Which swaps | The shows the audience already hears, to trade trailers, ads and guests with. A show the team already has in mind is ranked beside them |
| Who pays | Sponsors that could realistically say yes to a new show, ranked for the listeners |
| How to reach them | Guests, press and newsletters, clips and video, live recordings, community |
| Cost and measures | A budget split and the numbers to track for this kind of launch |
| Risks | A market that grows slowly, a topic every rival already carries, a date that slips |

## Launch kinds and formats

A podcast is launched in one of two ways, in audio, video or both. The agent reads the kind and the format from the brief. When the brief does not say, it plans a new show in audio and says so in "To sharpen this plan".

| Kind | Sections it gets, in order | The calendar | What to track |
|---|---|---|---|
| **New show** | Cross promotion shows, Guests, Sponsors, Press and newsletters, Video and clips, Live shows, Community, Episode cadence | The cover art and the feed, an editorial pitch to Apple Podcasts and Spotify, a trailer, the swaps booked, launch with three episodes, the first weeks for follows and reviews, a first read of the month | Followers by market and age band in the first month, downloads at 7 and 30 days, completion, where new listeners came from |
| **New season** | Cross promotion shows, Sponsors, Guests, Video and clips, Press and newsletters, Live shows, Community, Episode cadence | An announcement to the current feed, a trailer, the swaps, the best earlier episodes pinned as the way in, the premiere, a read of the month against the last season | Followers added against the last season, premiere and episode downloads, how many of the last season's listeners return, where new listeners came from |

The format shapes the calendar and the sections inside a kind. Video and clips need a filmed show (or YouTube). The editorial pitch is for Apple Podcasts and Spotify. Guests are dropped for a narrative show unless guests are named. Every plan also has Markets, Launch beats, Budget split and What to measure.

## Requirements 

1. **Plan for the team's decisions.** Their markets, platforms, launch kind, format, age band, comparable shows, topics, swaps, sponsors and window are constraints. Test them and say what Qloo found, never replace them. A topic that rival shows carry as much as the team does, or a swap that ranks low, is said plainly, and the team's choice stays beside the stronger one. Every named market, comparable show, topic and swap gets an answer.
2. **Work with thin input.** A one-line description, such as "a Nigerian true crime podcast", is enough. Ask for nothing beyond what the show is, and never ask for comparable shows. With no market named, plan for the usual markets of a launch like this; a nationality ("for Nigerians") names the market. With no platform named, assume the format's usual platforms. End with what would sharpen the plan. A name alone, with no sense of what the show is about and nowhere to launch, gets one welcoming card asking for both; nothing is guessed.
3. **Describe the audience with shows like it, so the person need not.** Comparable shows the person names lead. Fewer than three, and the analyst works out who the listeners are from the description and chooses comparable shows for them, each with its reason and labelled as chosen by Oraqul. With no model, or when none resolves, the shows Qloo lists for the genre stand in, at lower confidence. A show Qloo finds by exact name leads the audience question. A new show it does not know is planned from the comparable shows, and the plan says so. A show the team named as a swap or a rival is never added as a comp.
4. **Say which topics are yours.** The topic map compares the audience with the audience of rival shows in one call. A topic only the show's side carries is yours; one both carry is shared. The team's own topics are tested against it. When the team named no rival, the comparison is with shows in the same genre, and the plan says so.
5. **Cover what Qloo cannot measure from knowledge.** When the brief says who the show is made for by language, culture or community, Qloo cannot target it and never receives it (only public entity names, place names and age bands go to Qloo). The model covers it as labelled playbook lines: the language of the feed and the description, where people there hear shows, local newsletters and communities. When search is configured, the web step also looks up how people in the named markets listen, and a line may state such a fact only with its source. The plan never claims what that audience likes without a finding, and never stereotypes.
6. **Be date-aware.** Beats are dates when the release date is known, and weeks before it when not. A beat that is already over is never advised. A date or a rival release appears only when a web source states it, with the source. If the release date has passed, the plan says there is nothing left to plan and points to an audit.
7. **Be realistic about scale.** A new independent show gets in-kind support from a brand, not sponsorship cash. Who will sponsor a show and what the audience likes are different questions, and Qloo answers only the second. Code answers the second from the budget and who is launching (a solo or small launch is not offered a national brand, and the brands Qloo finds for the audience are offered only when the launch can reach them), read from the brief and never guessed.
8. **Be actionable.** Each line is the move, the reason and who does it. Readable in about five minutes, short lines, plain words, no data jargon in the plan. People who hear the show are listeners.
9. **Never invent the show.** Its episodes, stories and guests come only from the brief. What the audience hears is what to speak to, never what the show contains.
10. **No forecasts.** No download, listener, chart or ad rate predictions, and no pricing advice.
11. **Be exportable and revisable.** PDF, Word and Markdown built as documents; a what-if reruns the plan, such as adding a swap, a market or a comparable show.

## What grounded means for Podcasts

- **Examples.** A plain model names the biggest shows. A grounded plan names the actual shows, brands, artists and series this audience ranks highest.
- **Swaps are ranked within one call.** Qloo scores shows against the audience in one call, so a swap the team named is scored with the rest and shows where it stands. Scores from separate calls are never compared.
- **The team's assumptions are tested.** The age band, each named market and city, and each topic are checked against Qloo's data on the comparable shows.
- **Where a chatbot beats us.** Qloo has no downloads, charts, ratings, ad rates or editorial rules, so the calendar, the editorial pitch and the guests section come from launch knowledge, labelled as such. We win on who the audience is, which topics are theirs, and what else they follow.

## Known limits

- **Checked on one subject only.** The queries were verified live on one true crime brief ([qloo.md](../backend/qloo.md)). Other subjects and markets are not probed one by one; where Qloo has little data the plan says so, and it is not claimed to beat a chatbot there. Re-run `pnpm --filter @oraqul/engine qloo:podcasts-probes` after any change to the queries.
- **The topic map rests on one call.** Qloo lists the tags each group of shows carries, and only subject tags count. Where a team's own topic is not among them ("storytelling" was not), it is cannot test, never weak. With very few rival shows the weights are coarse.
- **Guests, artists and series are launch practice.** Qloo returned people, artists and series for a podcast audience, but with no subject context they drifted (reality TV personalities and comedies for a true crime audience). Until a list with context fits, the Guests section is playbook, the crossover query is off, and Gaps says so.
- **Some shows must be named in full.** A show matches by its exact title, so "Casefile" is found as "Casefile True Crime" (a longer title that starts with the name is accepted when there is no exact one), and a show Qloo lacks (such as "The Daily") is not found.
- **Qloo knows few local shows.** Its podcast catalogue is US-centric: for a Nigerian football show it found no Nigerian podcast, "football" means American football, and the swap list is mostly US sports shows with a few soccer ones. The plan ranks who the audience resembles, not who is local, so local swap partners come from launch knowledge and the team's own list. A football brief outside the US is asked with the soccer tag, then topped up with sports.
- **African markets are thin for some subjects.** For true crime, Lagos had 3 heatmap cells and Johannesburg 23, under the 25 needed to rank, so those markets say could not rank; for football Lagos ranked (lift 1.24).
- **A new show is planned from its comparable shows.** If those are off, the audience is off. The plan says what it rests on.
- **Editorial and platform rules change.** They come from web research when search is configured, and are otherwise left out of the plan.
- **Markets are cities.** A region such as West Africa is ranked through the cities in Qloo's table that stand for it. A region the table does not cover is not ranked, and the plan says so.
- **Overlap is not a share of listeners.** It is how close another audience is to the show's, scored by Qloo, on a scale of 0 to 100.
- **Ambiguous names** are settled in code and the plan says which was chosen. Show names collide often. A wrong match is possible.

## Launch rules

Thresholds and bands are in [launch-rules.md](../product/launch-rules.md). For Podcasts:

* **Calendar.** Days 1 to 60 after release are the campaign, with the read at day 30 and day 60. The beats are the launch kind's (`podcasts/modules.ts`).
* **Signal.** Downloads per episode at day 30 and day 60. Followers, views and ratings are secondary.
* **Channels.** YouTube leads, then Instagram and TikTok.
* **Territories.** One plan per named market, home first, beside the markets ranking.

## How it works in code

### The one idea

A podcast is described by the **show** itself when Qloo knows it by name, by its **earlier shows** (by the same host or network), and by up to four **comparable shows**. The agent asks Qloo what that audience likes and which topics it carries that rival shows' audiences do not. The show is an anchor but never a comp. A new show that Qloo does not know is planned from the comparable shows, and the plan says so.

The two stages are Film's: code runs the queries and turns each result into a finding, then the model writes the plan from the findings and code checks every line. Podcasts adds a **launch kind** (a new show or a new season) and a **format** (audio, video or both) that decide the sections and the calendar, and the **topic map**, which no other category has.

### What is shared and what is Podcasts'

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
| Engine | `packages/engine/src/` | `topicMap` tool (`tools/topic-map.ts`), `topicVerdict` (`verdicts.ts`), `scoreRivals` with a podcast rival type, and the demo data (`qloo/demo-fetch.ts`) |

Sections for a plan are the module keys of spec §6.1. Podcasts adds `crosspromo`, `guests`, `live` and `video` to `launchModuleKeys`, and uses `partnerships` for Sponsors, `publicity` for Press and newsletters and `cadence` for Episode cadence. The shared partner brief writes into `partnerships`, so Sponsors keeps that key.

### Where Podcasts differs from Film, Music and Games

**Anchors.** `findComps` looks the show up with the comps (`config.lead`). The earlier shows join the lookup through `config.teamAnchors`: they anchor the audience question like the comparable shows, after the named ones so they never crowd one out, and count toward the three a plan wants.

**Thin briefs.** The analyst (`launch/analyse.ts`) fills `suggestedComps` from the description when the person named fewer than three; there is no hardcoded list. With no model, or when none resolves, the genre's own shows from Qloo stand in, and a build does not stop to ask for comps. A show the team named as a swap, a rival or an earlier show is never added as a comp. A nationality in the brief becomes a market, which the region table or the city table turns into cities.

**What Qloo cannot measure.** The reader keeps `audienceNote`, the language, culture or community the show is made for, in the person's words (quote-checked). It goes to the writer, the query planner and the web search, never to a Qloo call.

**The launch kind and the format.** The reader takes them from the brief (a model's choice kept only with its quote, or code's rule over the words, `kindFrom` and `formatFrom`). With nothing said, the kind is a new show and the format audio, and "To sharpen this plan" says what was assumed. The kind picks the modules in order (`KIND_PROFILES[kind].modules`), the beats, the measures and the budget split. The format and style then remove what does not apply: video needs a filmed show, guests are dropped for a narrative show unless named.

**The calendar is written by code.** `config.codeSections.timeline` builds Launch beats from the kind and the platforms with `beatsFor` and the shared `datedBeats`. With a release date (a day in the window), each beat has dates; without one, weeks. A beat that is over on `today` is dropped, so no plan advises around a past date, and a release date in the past gives one line that says there is nothing left to plan.

**Markets.** A region word (Europe, West Africa) stands for table cities (`REGION_CITIES`). Those cities are ranked in the same heatmap call but never become the team's own assumptions: only a city the person named does. With none named, the five usual markets are ranked and shown as the plan's markets (`standInPlaces`).

**The topic map** (`topicMap` in `podcasts/findings.ts`). `findTaste` lists the shows the audience hears in the genre (one call, shared by cross promotion and the topic map). The rivals are the shows the team named, or with none those shows. `tools.topicMap` makes one `analysis.compare` call, anchors against rivals, and `topicOwnership` splits the tags: a topic only the anchors' side lists is yours, one on both sides is shared, one only the rivals' side lists is theirs. A yours topic's weight is its count against the mean count of a rival topic, which orders and sizes topics and never decides who owns one. The topics go to `brief.topics` (the Topic map tab). Each topic the team named is an assumption (`a-topic-<slug>`) with a finding of the same name, tested with `topicVerdict`: yours holds, shared is weak, the rivals' breaks, not returned is cannot test.

**Cross promotion** (`crossPromotion`). `findTaste` lists shows, then one `scoreRivals` of type podcast scores them together with any swap the team named, so a named show is a ranked row (`f-promo-<slug>`). The rows go to `brief.fan` with medium podcast and the note "Your pick"; `before` and `after` are equal, since a swap is a ranked row, not a moved bar. A swap is found by exact name with `searchEntity`; several exact matches are not guessed.

**Guests and crossover.** `GUESTS_GROUNDED` and `CROSSOVER_GROUNDED` in `packages/packs/src/podcasts/catalog.ts` are false: the live probe returned people, artists and series for a podcast audience, but with no subject context they drifted (reality TV personalities and comedies for a true crime audience). While false, the Guests section is playbook and the crossover query is not run; the gaps say so.

**Audit.** The shared tests (age, gender, place, comps, partner, window) plus each named topic (from the findings' assumptions) and each named swap (its rank among the shows scored in one call, by thirds). Guests are not tested. The results the person adds are by market, compared as in Film. A weak or broken topic or swap keeps the team's choice and offers what to add beside it.

### Where to change things

| To change | Edit |
|---|---|
| A threshold or formula | spec §5 first, then `engine/verdicts.ts` or `tools/topic-map.ts` |
| What the reader pulls from a brief | `PODCASTS_READ_SYSTEM` and `podcastsReadingSchema` in `podcasts/read.ts` |
| Which queries exist, and their defaults | spec §4.4, then `packages/packs/src/podcasts/catalog.ts` and `podcasts/findings.ts` |
| A launch kind's sections, calendar, measures or budget | spec §6.1, then `KIND_PROFILES` in `packages/packs/src/podcasts/modules.ts` |
| The words that read the kind, format and style | `kindFrom`, `formatFrom` and `styleFrom` in `packages/packs/src/podcasts/modules.ts` |
| Which shows stand in when none is named | The analyst's prompt (`ANALYST_SYSTEM` in `launch/analyse.ts`); the genre's own shows from Qloo when it chooses none |
| What a region word stands for | `REGION_CITIES` in `packages/packs/src/podcasts/catalog.ts` and the city table in `packages/engine/src/places.ts` |
| How the model shapes queries | `QUERY_PLAN_SYSTEM` and `checkPlan` in `podcasts/planner.ts` |
| What the writer is told | `PLAN_WRITER_SYSTEM`, `ANSWER_WRITER_SYSTEM`, `RULES` in `podcasts/writer.ts` |
| The tab words and limits copy | `PODCAST_TABS` and `LIMITS` in `apps/api/src/outputs/present.ts` |

## Also open

- Only demo goldens are recorded; no live golden run exists.
- The screens are the shared ones (Plan tab, receipts drawer, exports) plus this category's own tabs. They have not been compared with the prototype.
- The gaps every category shares are in [launch-runtime.md](../backend/launch-runtime.md#known-gaps).
