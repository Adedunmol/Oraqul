# Qloo

Qloo supplies the taste data. What we compute on top is in [spec §5](../product/spec.md). This file is the one place that says what Qloo offers, how our client groups it, and what is confirmed.

## Status

Written 2026-10-13 from docs.qloo.com, then checked against the live API the same day with `pnpm --filter @oraqul/engine qloo:smoke` (51 calls, `hackathon.api.qloo.com`, our key).

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
| Cross-domain taste tests (one type's fans as the signal for another) | one case seen: a movie signal returned other types (conflict 16). Whether the results are useful for a launch is not tested |
| Whether a recorded response may be committed or shown on a public share link | unknown. Ask Qloo |

## How Oraqul uses Qloo

Qloo is a taste graph. It says who likes what, and where, for the things it knows. It is not a catalogue we look the launch up in. Most of what a team brings is not in Qloo: a book before publication, an album before release, a series still in development. A live title can also be a poor signal on its own, because Qloo may know it barely. So we never expect to find the thing being launched. We describe it by what surrounds it, and ask Qloo about that.

- **Anchors.** Anything with a public name that Qloo can take as a signal: the title when it exists, comparable titles, the author, artist, cast or host, themes and tags, partner brands, places and age bands (hard rule 7). An anchor Qloo knows well is strong. One it barely knows (no `popularity`, few tags) is weak.
- **Questions.** What we ask of the anchors: who the audience is (demographics), where it concentrates (heatmap), who overlaps with whom (compare), what is rising (trending), and what else that audience likes (entities of any type, tags).
- **Cross-domain tests.** Qloo takes an entity of one type as the signal for another (conflict 16). So we can ask what the fans of a bestselling musician also read, and see whether our kind of book sits inside that taste. An overlap is evidence for. A missing overlap is "no signal", never a weak verdict on its own. It can count as weak only when code compares it with a baseline (comparable successful titles tested against the same audience) and the anchors were strong enough to be fair. Cross-domain tests are unverified beyond conflict 16: see [Still open](#still-open).
- **Thin.** A signal is thin when it rests on few or weak anchors: few comparable titles, anchors with no `popularity`, a place that returned few results. It is worked out per claim in each run and lowers that claim's confidence. It is not a property of a category. What is known so far about where Qloo is sparse is in [What the live run showed](#what-the-live-run-showed), and it is small.
- **Modes.** Design intent, not built. Before release the anchors are the surroundings only. After release the title joins them as one more anchor, and often a weaker one than the comps. For a rescue, the audience the launch actually reached (from the team's results) is compared with the one the plan assumed.

The anchors that describe an item differ by category. See [Categories](#categories).

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

## What the live run showed

These shape the agent. They are all from 2026-10-13.

**Search never says "not found".** It always returns the closest fuzzy matches. A made-up title, `Lagos Nights Of The Silent River`, returned unrelated films (*Nights of Cabiria*, *Talladega Nights*), and a nonsense string returned one film. The first hit is also not always the right one: searching `Lionheart` returned a 1990 US film first and the 2018 Nigerian film second. So **"not in Qloo" is a decision we make** by matching name, year and country on the candidates, and an ambiguous match becomes an entity match question ([spec §10](../product/spec.md)). For an unreleased title "not in Qloo" is the expected answer, not a failure, and the flow moves straight to the anchors ([How Oraqul uses Qloo](#how-oraqul-uses-qloo)). The match question is for a live title that is ambiguous.

**Missing popularity marks obscure titles.** `popularity` is a 0 to 1 percentile and is `null` or absent for some titles: 3 of the 5 `Black Panther` hits (duplicate and minor listings), and several 2020 to 2025 releases. Treat it as "thin data", not as zero.

**Nigerian film and series: present, some with low popularity.** This is the only coverage that was measured, and it is three titles. Present, checked by year and country: *Lionheart* (2018, Nigeria, popularity 0.65), *Gangs of Lagos* (2023, 0.46), *Blood Sisters* (2022, 0.09). Matched by exact name only, not checked further: Wizkid and *Half of a Yellow Sun*. Not present: the 1992 *Living in Bondage*, though a 2019 sequel is. Low popularity means a weaker signal, which feeds confidence. Nothing here says anything about music, books, podcasts or games, or about other regions: those are untested, not known to be thin.

**Responses are big.** One movie carries about 335 tags. Ten movie results from insights were about 780 KB, a Lagos heatmap about 250 KB, and a Nigeria locality heatmap 6.8 MB. A receipt must hold the excerpt a line used, which is why `toReceipt` requires `returned`. Raw Qloo data also must not reach public share links ([PRD](../product/prd.md)).

**`take` is not a limit everywhere.** `take=20` on a Lagos heatmap returned 558 cells and `take=10` on the locality heatmap returned 224 localities. On compare, `take=20` gave 12 shared tags but 30 and 34 tags on the two sides. Slice results in code.

**Trending needs an entity and a long window.** Without `signal.interests.entities` Qloo answers 400. A 60 or 90 day window returned no points, 180 days or more returned 20. `population_rank` is a number written as text, `population_percentile` is 0 to 1, and points come newest first.

**Entities are rich.** A movie's `properties` include `genres`, `keywords`, `plot_summary`, `plot_themes_description`, `audience_identity`, `situational_contexts`, `emotional_tone_description`, `collaborators`, `production_companies`, `release_country`, `release_date`, `content_rating`, `duration` and `wikidata_id`. Insights results also carry `query.measurements.audience_growth`.

**Search results and insights results differ.** `/search` and `/entities` give `types: ['urn:entity:movie']` and no `subtype`. Insights gives `subtype`.

## Still open

- Whether tag-signal calls are slow on non-book types (another project saw 10 to 60 seconds). The smoke run did not record timings.
- Whether a book id can be used as a signal outside book insights. A movie id can.
- Cross-domain tests per category (see the table in [Categories](#categories)): does the audience of well known artists, films or brands, used as the signal, return plausible books, podcasts and games, and is the result stable enough to read an overlap, or its absence, from? Needs a baseline of comparable successful titles. `TODO(verify)`.
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
4. Contract tests that parse the fixtures arrive with the first tools ([testing.md](../testing.md)).

## Open questions

From [PRD §9](../product/prd.md), still open: coverage for podcasts, games, books and music (assumed uneven, not measured); the quota header (reported near 10,000 calls a month; the smoke run uses about 50); what may be shown on public share links; whether recorded responses may be committed to a public repository.
