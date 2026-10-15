# Qloo

Qloo supplies the taste data. What we compute on top is in [spec §5](../product/spec.md). This file is the one place that says what Qloo offers, how our client groups it, and what is confirmed.

## Status

Written 2026-10-13 from docs.qloo.com, then checked against the live API the same day with `pnpm --filter @oraqul/engine qloo:smoke` (51 calls, `hackathon.api.qloo.com`, our key). Cross-domain taste tests were checked on 2026-10-15 with `qloo:cross-domain` (21 calls, same host and key).

- **Verified (2026-10-13)** means a live response confirmed it. **Documented** means only the docs say so.
- Things the docs got wrong or left open are in [Conflicts](#conflicts-and-how-they-were-settled) and [What the live run showed](#what-the-live-run-showed).

| Area | Status |
|---|---|
| Host `hackathon.api.qloo.com` and `X-Api-Key` auth | verified. `hackathon.qloo.com` does not resolve |
| `/search`, `/entities` (by Qloo id and by IMDb id) | verified |
| `/v2/tags`, `/v2/tags/types`, `/v2/audiences`, `/v2/audiences/types` | verified |
| `/v2/insights` for movie, tv_show, artist, book, podcast, videogame, brand | verified |
| `/v2/insights` for person, place, destination, locality | documented, not exercised. Not needed for the first build |
| `/v2/insights` with `urn:tag`, `urn:demographics`, `urn:heatmap` (geohash and locality) | verified |
| `/v2/analysis/compare` | verified, shape differs from the OpenAPI definition |
| `/v2/trending` | verified, with caveats on the date window |
| Nigerian film and series | three titles checked by year and country, all present, popularity 0.09 to 0.65. Artists, books and other categories not checked. See below |
| Age and gender profiles by category (2026-10-15) | measured on 50 titles: books 5 of 10, every other category 37 of 40 (films, series, artists, podcasts, games). Hand picked, mostly popular titles. See below |
| A bundle of comps as the signal for books (2026-10-15) | verified for similar books and for scoring a candidate list. Demographics from a bundle are patchy, places from a bundle are unstable, tags alone are noisy and a person was rejected as a signal. See below |
| Cross-domain taste tests (one type's fans as the signal for another) | verified on one run (2026-10-15): artist signals return books, podcasts, games and movies, and scoring a candidate list separates books by taste. One kind of book and three artists only. See below |
| Whether a recorded response may be committed or shown on a public share link | unknown. Ask Qloo |

## How Oraqul uses Qloo

Qloo is a taste graph. It says who likes what, and where, for the things it knows. It is not a catalogue we look the launch up in. Most of what a team brings is not in Qloo: a book before publication, an album before release, a series still in development. A live title can also be a poor signal on its own, because Qloo may know it barely. So we never expect to find the thing being launched. We describe it by what surrounds it, and ask Qloo about that.

- **Anchors.** Anything with a public name that Qloo can take as a signal: the title when it exists, comparable titles, the author, artist, cast or host, themes and tags, partner brands, places and age bands (hard rule 7). An anchor Qloo knows well is strong. One it barely knows (no `popularity`, few tags) is weak.
- **Questions.** What we ask of the anchors: who the audience is (demographics), where it concentrates (heatmap), who overlaps with whom (compare), what is rising (trending), and what else that audience likes (entities of any type, tags).
- **Cross-domain tests.** Qloo takes an entity of one type as the signal for another (conflict 16). So we can ask what the fans of a bestselling musician also read, and see whether our kind of book sits inside that taste. An overlap is evidence for. Qloo does not return "no overlap" as an absence: every candidate came back with a score, so a low score is the only form of "no". A low score can count as weak only when code compares it with a baseline (comparable titles of other kinds, scored in the same call) and the anchors were strong enough to be fair. What the first run showed is in [What the live run showed](#what-the-live-run-showed).
- **Thin.** A signal is thin when it rests on few or weak anchors: few comparable titles, anchors with no `popularity`, a place that returned few results. It is worked out per claim in each run and lowers that claim's confidence. It is not a property of a category. What is known so far about where Qloo is sparse is in [What the live run showed](#what-the-live-run-showed), and it is small.
- **Modes.** Design intent, not built. Before release the anchors are the surroundings only. After release the title joins them as one more anchor, and often a weaker one than the comps. For a rescue, the audience the launch actually reached (from the team's results) is compared with the one the plan assumed.

The anchors that describe an item differ by category. See [Categories](#categories).

### Recommended approach (subject to change)

This is the current best view, written 2026-10-15. It is a design, not a verified behaviour, and it will be revised when each category agent is worked on, because the anchors differ by category (for music the artist is often already in Qloo, for podcasts the host matters most) and because of what the proxy probe shows ([Still open](#still-open)).

1. **Build the bundle from comparable titles first.** Three to five comps that belong together. A grab bag of unrelated anchors collapses into generic titles (2026-10-15 run). Check in code that the comps agree before trusting the bundle. A person cannot be the signal on the evidence so far, so use the author's other books as comps. Tags alone gave noisy books; keep them as a filter, once tested, not as an anchor.
2. **Ask the user to confirm the comps.** They decide the result and Qloo cannot choose them. The agent proposes comps from the pitch and asks one question card to confirm.
3. **Ask each question of the whole bundle in one call:** one for the audience, one for places, one to score titles of our kind against other kinds. Scores from separate calls are never compared. After the 2026-10-15 runs the scoring call is solid. The audience call works for most categories but about half of books have no profile, so a book bundle can lean on the comps that have one, then on the genre tag, labelled as the genre's audience. The place call is unstable (see [What the live run showed](#what-the-live-run-showed)).
4. **Compute confidence from stability and coverage.** Count how many comps actually returned data, since demographics rows are missing for most books, and how well Qloo knows each (`popularity`). Rerun candidate scoring with each comp left out: if the ranking holds, confidence is higher. All of it is code over Qloo values and costs a few extra calls, which `QLOO_CALL_BUDGET` must allow for. Stability is our own design. Leave-one-out on audiences did not work (2 rows), and on places it flipped the ranking.
5. **Cross-domain tests are supporting evidence.** A clear gap above the baseline can back a line. It does not drive a headline until checked on more kinds of book and on other categories.
6. **After release the title joins the bundle** as one more anchor. It does not replace the comps, because a live title can still be thin.

## Host, auth, limits

| Item | Value |
|---|---|
| Base URL | `QLOO_BASE_URL`. Production is `https://api.qloo.com`. We use `https://hackathon.api.qloo.com`. Which host our key works on is unverified |
| Auth | header `X-Api-Key: <key>`. Not a query parameter |
| Method | `GET` with a query string. `POST` bodies exist for some `*.query` parameters. The client does not use them |
| `take` | 1 to 50, default 20. Page with `page` (1 to 100) or `offset` |
| Radius | `filter.location.radius` and `signal.location.radius` in metres, up to 800 000. `/search` `filter.radius` is in miles, up to 100 |
| Errors | the docs list 404 and 429 with `{ code, reason, message }`. Rate limits are not published |
| Avoid | `/recommendations` and `/recs` (legacy), `urn:entity:audience` (deprecated), and the legacy search-only types actor, album, author, director. Use `person` |

## The client (`packages/engine/src/qloo`)

One `QlooClient` per agent run. Every call returns `{ data, call }`: `data` is the response, checked against a Zod schema, and `call` is the record of what was sent and received. A tool turns calls into receipts with `toReceipt(call, { returned, rule, confidence })`. `returned` is the part of the response the line used, not the whole body: live responses are large (see below). The client never sets confidence, because that is computed by code from [spec §5](../product/spec.md).

- **Retry.** Once, on a network error, a timeout, a 429 (waiting for `Retry-After`, at most 10 s) or a 5xx. Not on other 4xx. Then it throws `QlooError` with `kind` (`http`, `network`, `timeout`, `invalid_response`) and the `call`, so the line can still cite what happened ([spec §10](../product/spec.md): "could not test", never filled by the model).
- **Budget.** `callBudget` (from `QLOO_CALL_BUDGET`) counts network calls. A retry is not a second call. When it is spent, `QlooBudgetError` is thrown before any request, which ends the run with what is tested so far.
- **Injected `fetch`.** `fetch` in the options replaces the global one. Tests and demo mode use it so no request leaves the process.
- **Memory.** An identical call later in the run, or made while the first is in flight, costs nothing and returns its own `call` with `cached: true`. Failures are not remembered.
- **Validation.** `responses.ts` checks the body once. Objects are loose, so fields we do not read are kept in `returned`.
- **Errors.** A non-2xx status throws `QlooError` carrying the call, so a receipt can still be built. No 404 was seen in the live run, so we do not yet know what Qloo returns for "no results": a search for nonsense still returned a (fuzzy) 200.

Functions take the client first and are grouped by what you ask Qloo:

| Group | Import | Functions |
|---|---|---|
| Lookup | `lookup` | `search`, `entities`, `entitiesByExternalId`, `tags`, `tagTypes`, `audiences`, `audienceTypes` |
| Insights | `insights` | `entities`, `tags`, `demographics`, `heatmap`, `heatmapByLocality` |
| Analysis | `analysis` | `compare`, `trending` |

Parameter names are Qloo's own, dotted, so a receipt's `input` shows exactly what was sent. `insights.entities` takes a request that is a union on `filter.type`: a filter that belongs to another type does not compile. Qloo itself **silently ignores** parameters a type does not support, so this is the only guard.

## Demo mode

`QLOO_MODE=demo` (the default) serves `demoFetch` (`packages/engine/src/qloo/demo-fetch.ts`): a few hand-written titles shaped like Qloo's `/search` and demographics responses. Ids start with `DEMO-`, receipts built from it carry `source: 'demo'`, and the trace says "on demo data". It is not Qloo data and proves nothing about coverage. Any other endpoint answers 404. `QLOO_MODE=live` needs `QLOO_API_KEY` and `QLOO_BASE_URL`.

## Tools to Qloo ([spec §4](../product/spec.md))

Built: `searchEntity` and `audienceBySegment` (`packages/engine/src/tools`). Their confidence is a placeholder until spec §5's full rule is coded (`TODO` in each file). The rest are planned.

| Tool | Qloo call |
|---|---|
| `searchEntity` | `lookup.search`, or `lookup.entitiesByExternalId` when the user gives an IMDb, Spotify or ISBN id |
| `resolveBundle` | `lookup.tags` for the phrases, then `insights.tags` or an insights call with `signal.interests.tags` |
| `audienceBySegment` | `insights.demographics` for the entities, or `signal.demographics.*` on an entity insights call |
| `lift` | one `insights.entities` call with `filter.results.entities` set to the candidates, so all scores share one ranking |
| `rankPlaces` | `insights.heatmap` or `insights.heatmapByLocality`, one call |
| `compareAudiences` | `analysis.compare`, one call |
| `partnerFit` | `insights.entities` for `brand`, `person` or `artist` with an audience signal |
| `tagWeights` | `insights.tags` |
| `momentum` | `analysis.trending` |

## Categories

Each pack declares the Qloo types it uses in `qloo` (`packages/packs`). Every category also asks about people, brands and places.

| Category | Titles | Talent | Partners | Places |
|---|---|---|---|---|
| Film and series | `movie`, `tv_show` | `person` | `brand` | `locality`, `place`, `destination` |
| Music | `artist` | `person` | `brand` | same |
| Books | `book` | `person` | `brand` | same |
| Podcasts | `podcast` | `person` | `brand` | same |
| Games | `videogame` | `person` | `brand` | same |

**Anchors by category.** What could stand in for an item that does not exist in Qloo yet. This is a hypothesis for each pack to work out and test. Nothing in this table is verified.

| Category | Likely anchors, strongest first | Cross-domain tests to try |
|---|---|---|
| Books | comparable books, the author (weak for a debut), themes and tags, an adaptation angle | fans of bestselling musicians, films and series in the same genre, brands the readers like |
| Film and series | comparable titles, director and cast, source material, genre and theme tags | fans of the same artists, books and games |
| Music | the artist (often already in Qloo before the release), sound-alike artists, tags | fans of related films, brands and places |
| Podcasts | the host, comparable shows, topic tags, likely guests | fans of related books, artists and brands |
| Games | the studio or franchise, comparable games, genre tags | fans of related films, series, music and anime |

## Parameters by `filter.type`

From the Entity Type Parameter Guide, with differences noted in conflicts. Types are in `insights/filters.ts`.

**Shared by every entity type:** `filter.type` (required), `take`, `offset`, `bias.trends`, `filter.popularity.min|max` (0 to 1), `filter.tags` and `operator.filter.tags`, `filter.exclude.tags` and `operator.exclude.tags`, `filter.exclude.entities`, `filter.results.entities` and `.query`, `filter.external.exists` and its operator, `filter.parents.types`, `signal.interests.entities`, `signal.interests.tags`, `signal.demographics.age`, `.gender`, `.audiences` and `.audiences.weight`.

| Type | Adds |
|---|---|
| `movie` | `filter.content_rating`, `filter.release_year.min|max`, `filter.release_country` and its operator, `filter.rating.min|max` (0 to 5) |
| `tv_show` | the movie set, plus `filter.finale_year.min|max`, `filter.latest_known_year.min|max` |
| `book` | `filter.publication_year.min|max`. **No location filters** |
| `artist`, `podcast`, `videogame`, `brand` | nothing. **No location filters** |
| `person` | `filter.gender`, `filter.date_of_birth.min|max`, `filter.date_of_death.min|max` |
| `destination` | `signal.interests.entities` **required**; location filters (`filter.location`, `.radius`, `.geohash`, `filter.geocode.*`) |
| `place` | the destination location set, plus `sort_by`, `bias.quality`, `filter.address`, `filter.hours`, price, hotel class, business rating, `filter.references_brand`, Tripadvisor and Resy filters |
| `locality` | partial: only `signal.interests.entities`, and only localities |
| `urn:tag` | taste analysis. `filter.tag.types`, `filter.parents.types`, signals, `diversify.by=subtype` with `diversify.take` |
| `urn:demographics` | `signal.interests.entities` or `signal.interests.tags` (one is enough) |
| `urn:heatmap` | `filter.location` or `filter.location.query` **and** a signal; `output.heatmap.boundary` (`urn:geohash` or `urn:entity:locality`), `heatmap.dimensions` (`quality`, `popularity`, `hotel_class`, `price_level`), `filter.dimensions.*` |

**Signals.** `signal.interests.entities` and `.tags` say what the results should be near. `signal.demographics.age` takes `24_and_younger`, `25_to_29`, `30_to_34`, `35_to_44`, `45_to_54`, `55_and_older`, and also the coarse `35_and_younger` and `36_to_55`. Weights are a number or `very_low`, `low`, `mid`, `medium`, `high`, `very_high`. Audience urns come from `lookup.audiences`, never hardcoded. Tag urns come from `lookup.tags`.

**Not supported by the client:** parameters that need a `POST` body (`signal.interests.entities.query` and `filter.exclude.entities.query` with names and addresses, and tags with per-tag weights). Resolve names with `lookup.search` first.

## Response shapes we read

Checked once in `responses.ts`.

| Response | Shape |
|---|---|
| `/search`, `/entities` | `results: Entity[]` |
| `/v2/insights` entity types | `results.entities: Entity[]`; each may carry `query.affinity` and, with `feature.explainability`, `query.explainability` |
| `urn:tag` and `/v2/tags` | `results.tags: Tag[]` with `tag_id`, `name`, `subtype`, `types`, `query` (`{}` on plain lookups) |
| `urn:demographics` | `results.demographics: [{ entity_id, query: { age: {band: n}, gender: {male, female} } }]`. Values are affinities and can be negative. `entity_id` is a tag urn for a tag signal |
| `urn:heatmap` | `results.heatmap: [{ location: { latitude, longitude, geohash }, query: { affinity, affinity_rank, popularity } }]` |
| `/v2/trending` | `results.trending: [{ date, population_percentile, population_rank, population_rank_velocity, velocity_fold_change, population_percent_delta }]`, newest first |
| `Entity` | `entity_id`, `name`, `subtype` (`urn:entity:movie`), `popularity`, `properties` (movie: `release_year`, `release_date`, `description`, `content_rating`, `duration`, `image.url`, `akas`, `production_companies`), `tags` |

## Conflicts and how they were settled

| # | Question | Result (2026-10-13) |
|---|---|---|
| 1 | Does `signal.location.query` work for every title type? | **Yes.** Adding `Lagos` changed the results for movie, tv_show, artist, book, podcast and videogame. The Entity Type Parameter Guide omits it, the Reference was right |
| 2 | Do weights, `page` and `feature.explainability` work? | **Yes**, tested on movie: `signal.interests.entities.weight` (very_high against very_low, with a tag signal) changed results, `page=2` differed from page 1, and all 5 results carried `query.explainability`. Age, gender and location weights not tested |
| 3 | What does compare return? | `results.tags` (shared tags, each with `query.score`), `results.a` and `results.b` (each group's own tags, with `query.count` as text), and an empty `matchEntities`. Not the entity list in the OpenAPI definition |
| 4 | Does Qloo reject unknown parameters? | **No, it ignores them** (a `bogus.param` returned normally). The typed requests are our only guard |
| 5 | Audiences: `results.audiences` or `results.entities`? | `results.audiences`. Each has both `id` and `entity_id`, and they differ. **`signal.demographics.audiences` takes `id`**: `entity_id` had no effect on movie results, `id` changed them |
| 6 | Tag id field | `/v2/tags` lookups use `id`. `urn:tag` insights and compare use `tag_id`. Tags inside entities vary (`id` or `tag_id`, sometimes no name) |
| 7 | Exclude-tags operator name | not tested. We send `operator.exclude.tags` |
| 8 | Resy filter names | not tested. We use the OpenAPI names (`filter.external.resy.*`) |
| 9 | Hotel price range names | not tested. We use `from` and `to` |
| 10 | Which params does `urn:tag` take? | An entity signal works. `filter.tag.types` and `filter.parents.types` not tested |
| 11 | `filter.parents.types` values | not tested |
| 12 | Heatmap `bias.trends` and audience weight | not tested |
| 13 | What does a 404 mean? | Not seen. A search with no real match returns a 200 with fuzzy results, not an error |
| 14 | Shapes of the two `types` responses | `results.tag_types` and `results.audience_types`, each a list of `{ type, parents }` |
| 15 | Film filters | `filter.release_year.min` and `filter.content_rating` really filter: all 10 results were 2020 or later and PG-13 |
| 16 | Cross-domain | A movie as the signal returned results for tv_show, artist, book, podcast, videogame and brand |
| 17 | Does an artist signal work for books, with a score? | **Yes** (2026-10-15). Three artists each returned 20 books with `query.affinity` on all 20. Podcast, videogame and movie targets also returned results |
| 18 | Does `filter.results.entities` score a list of candidates we choose? | **Yes**, for books with an artist signal. All 8 candidates came back, each with an affinity, for each of 3 signals. Nothing was dropped for lack of overlap |
| 19 | Can a person be a signal? | **Not the one tried** (2026-10-15). An author with no `popularity` gave 400 "All of the provided signal.interests.entities were invalid" for book and movie targets. One person tested, so other people are untested |
| 20 | Does every entity have a demographics row? | **No, and books are the gap** (2026-10-15). Books 5 of 10, other categories 37 of 40. A title without one returns a normal 200 with no rows. A call with several entities returns rows only for those that have data. Popularity and tag count do not predict it (see below) |

## What the live run showed

These shape the agent. They are all from 2026-10-13.

**Search never says "not found".** It always returns the closest fuzzy matches. A made-up title, `Lagos Nights Of The Silent River`, returned unrelated films (*Nights of Cabiria*, *Talladega Nights*), and a nonsense string returned one film. The first hit is also not always the right one: searching `Lionheart` returned a 1990 US film first and the 2018 Nigerian film second. So **"not in Qloo" is a decision we make** by matching name, year and country on the candidates, and an ambiguous match becomes an entity match question ([spec §10](../product/spec.md)). For an unreleased title "not in Qloo" is the expected answer, not a failure, and the flow moves straight to the anchors ([How Oraqul uses Qloo](#how-oraqul-uses-qloo)). The match question is for a live title that is ambiguous.

**Missing popularity marks obscure titles.** `popularity` is a 0 to 1 percentile and is `null` or absent for some titles: 3 of the 5 `Black Panther` hits (duplicate and minor listings), and several 2020 to 2025 releases. Treat it as "thin data", not as zero.

**Nigerian film and series: present, some with low popularity.** This is the only coverage that was measured, and it is three titles. Present, checked by year and country: *Lionheart* (2018, Nigeria, popularity 0.65), *Gangs of Lagos* (2023, 0.46), *Blood Sisters* (2022, 0.09). Matched by exact name only, not checked further: Wizkid and *Half of a Yellow Sun*. Not present: the 1992 *Living in Bondage*, though a 2019 sequel is. Low popularity means a weaker signal, which feeds confidence. Nothing here says anything about music, books, podcasts or games, or about other regions: those are untested, not known to be thin.

**Cross-domain tests work, if we score a candidate list against a baseline (2026-10-15).** Signals were three artists (Burna Boy, Taylor Swift, Metallica). Candidates were four African literary novels (the "kind" of book) and four bestsellers of other kinds (the baseline), all with popularity above 0.99, scored in one call per signal.

- With Burna Boy as the signal, all four African novels scored above all four baseline books (mean 0.71 against 0.45). With Taylor Swift (0.57 against 0.58) and Metallica (0.43 against 0.46) the two groups did not separate. That is the direction a real taste signal should give, on one kind of book and three artists. It is not yet evidence for any other category, and the controls were chosen by hand.
- **Absence never appears.** Every candidate came back with an affinity from 0.33 to 0.75, for every signal. So "no overlap" is a low score, not a missing result, and a low score means little without a baseline scored in the same call. Affinity values from separate calls are not comparable ([Rules](#rules)).
- **Open-ended lists are the wrong tool.** The top 20 books for each artist shared nothing with the others, which shows the signal discriminates, but they were mostly non-fiction (memoirs, business, music biographies) and not the kind of book being launched. Mixing three unrelated artists as one signal gave generic business and memoir titles. Score a candidate list with coherent anchors instead. Whether a genre filter (`filter.tags`) keeps open-ended lists on topic is untested.
- Artist signals also returned podcasts, games and movies. Whether those are good results was not judged beyond a look at the top few.
- Popularity was not varied. Whether low-popularity candidates (the realistic case for a debut) score as cleanly is untested.

**A bundle of comps works as a signal for books, but only the first step is solid (2026-10-15, `qloo:proxy-bundle`).** The pretend launch was an unreleased Nigerian crime thriller. The bundle was four comps: two Nigerian crime novels (one with popularity 0.80), a Swedish bestseller and a US bestseller. A second bundle of four romance titles was the control.

- **Similar books and candidate scoring work.** The thriller bundle returned thrillers. Scored in one call against four more thrillers and four books of other kinds, every thriller beat every other kind (lowest thriller 0.69, highest other 0.63).
- **The control was a poor one, and shows a trap.** The romance bundle mixed a classic with modern titles and returned unrelated books (a boxed set, poetry, plays), shared nothing with the thriller list, and did not separate the kinds when scoring. So a comp set that is not coherent gives noise, and we cannot yet tell a coherent-but-different bundle from a bad one. The bundle's own coherence should be checked in code before it is trusted.
- **Demographics are patchy for books, and silently.** Only 3 of 9 books returned any (conflict 20). The thriller bundle got rows for 2 of its 4 comps and the romance bundle for none, all as normal 200 responses. Leave-one-out on 2 rows moved the age profile by up to 0.36, which is too few to measure stability with. Any audience line from a bundle must count how many comps actually returned a row. The coverage run below shows this is a book problem, not a general one.
- **Places from a bundle were unstable.** Ranking Nigerian localities (`heatmapByLocality`) gave 161 localities for the thriller bundle and 55 with one comp left out. Not one of the first 10 was shared, and Lagos moved from position 64 to 12. A locality outside Nigeria came first for the full bundle. Do not build city ranking on this call as it is.
- **Tags alone are noisy.** A tag lookup returns one tag per namespace (`genre:media`, `subgenre:qloo`, `keyword:qloo`, `theme:qloo`). As the only signal for books, `thriller` gave a mixed list, and the subgenre tag gave young adult and science fiction titles. One larger call returned 504, a smaller one took 5.5 s and another 0.8 s, so timings vary a lot.
- **A person is not a usable signal so far** (conflict 19). The author's other books can serve as comps instead.

**Age and gender profiles exist for most things except books (2026-10-15, `qloo:demographics-coverage`).** Each title was asked on its own: 10 books, 8 films, 4 series, 10 artists, 8 podcasts and 10 games, hand picked, public names, mostly popular, including Nigerian films, series and artists.

- **Books: 5 of 10 have a profile. Everything else: 37 of 40** (films 7 of 8, series 4 of 4, artists 9 of 10, podcasts 7 of 8, games 10 of 10).
- **Popularity does not explain it.** The mean popularity of books with a profile and without was the same (0.959). *Atomic Habits* (0.995) and *Dune* (1.000) had none, and a series at 0.106 had one. The number of tags on the entity did not predict it either: a book with no tags had a profile. The cause is unknown.
- **The Nigerian worry is not supported on this measure.** All three Nigerian films and the one Nigerian series had a profile, and 8 of 9 Nigerian artists did. The misses were one artist (popularity 0.64) and one film with no popularity value. This says nothing about other signals (places, scoring, trends), other regions, or titles less known than these.
- **A genre tag can stand in, with a weaker claim.** For 5 titles without a profile, the title's own genre tag returned one for 3 (two books and a podcast), and none for a film and an artist. That profile describes the genre's audience, not the title's, and must be labelled so.
- **Podcast entities carry 2 to 3 tags, films 60 to 335**, so tag based questions will be thinner for podcasts.
- **Search can pick the wrong entity.** Searching `The Daily` returned *The Daily Zeitgeist* first. This is the match question from [spec §10](../product/spec.md) again: a first hit is a candidate, not an answer.
- Limits: small, hand picked, popular titles, hackathon host. It does not cover new or obscure titles, which is the realistic case for a launch's comps.

**Responses are big.** One movie carries about 335 tags. Ten movie results from insights were about 780 KB, a Lagos heatmap about 250 KB, and a Nigeria locality heatmap 6.8 MB. A receipt must hold the excerpt a line used, which is why `toReceipt` requires `returned`. Raw Qloo data also must not reach public share links ([PRD](../product/prd.md)).

**`take` is not a limit everywhere.** `take=20` on a Lagos heatmap returned 558 cells and `take=10` on the locality heatmap returned 224 localities. On compare, `take=20` gave 12 shared tags but 30 and 34 tags on the two sides. Slice results in code.

**Trending needs an entity and a long window.** Without `signal.interests.entities` Qloo answers 400. A 60 or 90 day window returned no points, 180 days or more returned 20. `population_rank` is a number written as text, `population_percentile` is 0 to 1, and points come newest first.

**Entities are rich.** A movie's `properties` include `genres`, `keywords`, `plot_summary`, `plot_themes_description`, `audience_identity`, `situational_contexts`, `emotional_tone_description`, `collaborators`, `production_companies`, `release_country`, `release_date`, `content_rating`, `duration` and `wikidata_id`. Insights results also carry `query.measurements.audience_growth`.

**Search results and insights results differ.** `/search` and `/entities` give `types: ['urn:entity:movie']` and no `subtype`. Insights gives `subtype`.

## Still open

- Whether tag-signal calls are slow on non-book types (another project saw 10 to 60 seconds). The smoke run did not record timings.
- Whether a book id can be used as a signal outside book insights. A movie id can.
- Cross-domain tests beyond the first run: other kinds of book, podcasts and games as targets, film and brand signals, candidates with low popularity, and how large a gap between kind and baseline counts as a real signal. The anchors table in [Categories](#categories) is still a hypothesis. `TODO(verify)`.
- After the proxy run: why about half of books have no demographics when other categories mostly do (not popularity, not tag count) and whether it differs for obscure titles; a place ranking that holds when a comp is dropped (a geohash heatmap, or a different region size, instead of `heatmapByLocality`); whether a coherent bundle of a different kind (not a mixed romance set) separates cleanly from the thriller one; how tags behave as a filter instead of a signal; whether any person can be a signal. `TODO(verify)`.
- Coverage per category: a probe of about ten real titles each (well known, new, and local-language) to replace the guesses about podcasts, games and other regions with measured counts.
- `person`, `place`, `destination` and `locality` insights; the weights for age, gender and location; the names in conflicts 7 to 12.
- Lagos against no location for age and gender splits (does location change the demographics?). Location changes the ranking, but no location parameter is documented for the demographics call, so this may need a different approach.

## Rules

- Every call produces a call record, and every claim cites a receipt built from it ([spec §6](../product/spec.md), table `receipts`).
- Scores from separate calls are not comparable. Rival overlap, city ranking and scenario diffs must come from one call.
- Cache within a run. Respect `QLOO_CALL_BUDGET`.
- Only public entity names, place names and age bands go out. No personal data.
- No harness, no starter kit, no sidecar. Everything goes through `QlooClient` straight to the Qloo API. Validation, tests and evals are ours.
- Never fill a missing result from the model.

## Verifying

1. Put `QLOO_API_KEY` and `QLOO_BASE_URL` in `.env`.
2. `pnpm --filter @oraqul/engine qloo:smoke`. It prints counts and yes/no only, makes about 50 calls, and saves one response per endpoint and category type to `packages/engine/fixtures` (gitignored).
3. Settle anything still open above. Fix the schemas and types, remove the `TODO(verify)` markers that are confirmed, and update the status table with the date.
4. `pnpm --filter @oraqul/engine qloo:cross-domain` (about 21 calls) and `qloo:proxy-bundle` (about 40 calls, three of them large and slow) and `qloo:demographics-coverage` (about 120 calls) rerun the cross-domain, proxy and demographics checks. Unlike the smoke run it prints titles and scores to the terminal so they can be judged by eye, and saves nothing. Copy conclusions into the docs, not names or scores.
5. Contract tests that parse the fixtures arrive with the first tools ([testing.md](../testing.md)).

## Open questions

From [PRD §9](../product/prd.md), still open: coverage for podcasts, games, books and music (assumed uneven, not measured); the quota header (reported near 10,000 calls a month; the smoke run uses about 50); what may be shown on public share links; whether recorded responses may be committed to a public repository.
