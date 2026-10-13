# Qloo

Qloo supplies the taste data. What we compute on top is in [spec §5](../product/spec.md). This file is the one place that says what Qloo offers, how our client groups it, and what is confirmed.

## Status

Written 2026-10-13 from docs.qloo.com (the Insights API Deep Dive OpenAPI definition, Entity Type Parameter Guide, Parameter Reference, the lookup, analysis and trending references, and the demographics, taste analysis, heatmap and location guides).

- **Documented** means the docs say so. **Nothing here is confirmed with our own key yet.** `QLOO_API_KEY` is empty, so `qloo:smoke` has not run.
- Where the docs disagree with themselves, the item is listed under [Conflicts to settle live](#conflicts-to-settle-live) and marked `TODO(verify)` in the code.
- After the first smoke run, change the status of each item below to **verified (date)** or fix it.

| Area | Status |
|---|---|
| Host and `X-Api-Key` auth | documented. `hackathon.api.qloo.com` answers 401 without a key (checked 2026-10-13); `hackathon.qloo.com` does not resolve |
| `/search`, `/entities` | documented |
| `/v2/tags`, `/v2/tags/types`, `/v2/audiences`, `/v2/audiences/types` | documented. Audiences and the two `types` responses have no sample in the docs |
| `/v2/insights` for movie, tv_show, artist, book, podcast, videogame, brand, person | documented. Parameter support differs between sources, see conflicts |
| `/v2/insights` for place, destination, locality | documented, not needed for the first build |
| `/v2/insights` with `urn:tag`, `urn:demographics`, `urn:heatmap` | documented, with sample responses |
| `/v2/analysis/compare` | documented, but the response shape is in doubt |
| `/v2/trending` | documented, with a sample response |
| Coverage of Nigerian titles, artists, authors, podcasts, games | unknown. The smoke script checks |
| Whether a recorded response may be committed or shown on a public share link | unknown. Ask Qloo |

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

One `QlooClient` per agent run. Every call returns `{ data, call }`: `data` is the response, checked against a Zod schema, and `call` is the record of what was sent and received. A tool turns calls into receipts with `toReceipt(call, { rule, confidence })`. The client never sets confidence, because that is computed by code from [spec §5](../product/spec.md).

- **Retry.** Once, on a network error, a timeout, a 429 (waiting for `Retry-After`, at most 10 s) or a 5xx. Not on other 4xx. Then it throws `QlooError` with `kind` (`http`, `network`, `timeout`, `invalid_response`) and the `call`, so the line can still cite what happened ([spec §10](../product/spec.md): "could not test", never filled by the model).
- **Budget.** `callBudget` (from `QLOO_CALL_BUDGET`) counts network calls. A retry is not a second call. When it is spent, `QlooBudgetError` is thrown before any request, which ends the run with what is tested so far.
- **Memory.** An identical call later in the run, or made while the first is in flight, costs nothing and returns its own `call` with `cached: true`. Failures are not remembered.
- **Validation.** `responses.ts` checks the body once. Objects are loose, so fields we do not read are kept in `returned`.
- **404.** Treated as an error until we confirm it means "no results" (see conflicts). The error carries the call, so a receipt can still be built.

Functions take the client first and are grouped by what you ask Qloo:

| Group | Import | Functions |
|---|---|---|
| Lookup | `lookup` | `search`, `entities`, `entitiesByExternalId`, `tags`, `tagTypes`, `audiences`, `audienceTypes` |
| Insights | `insights` | `entities`, `tags`, `demographics`, `heatmap`, `heatmapByLocality` |
| Analysis | `analysis` | `compare`, `trending` |

Parameter names are Qloo's own, dotted, so a receipt's `input` shows exactly what was sent. `insights.entities` takes a request that is a union on `filter.type`: a filter that belongs to another type does not compile. Qloo itself **silently ignores** parameters a type does not support, so this is the only guard.

## Tools to Qloo ([spec §4](../product/spec.md))

The plan for the tools, which are not built yet.

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

## Conflicts to settle live

The docs disagree with themselves here. The smoke script tests the first four directly.

| # | Question | What the sources say | In code |
|---|---|---|---|
| 1 | Does `signal.location(.query)` work for movie, tv_show, artist, book, podcast, videogame? | The Parameter Reference lists it for every entity type and the location guide calls movie with `signal.location.query`. The Entity Type Parameter Guide omits it | `UnconfirmedParams` |
| 2 | Do weights (`signal.interests.entities.weight`, `.tags.weight`, age and gender weights), `page` and `feature.explainability` work for every type? | In the OpenAPI definition and the Reference, not in the Guide's tables for most types | `UnconfirmedParams` |
| 3 | What does compare return? | The OpenAPI definition shows an entity list. Another project's code reads shared tags with `query.score` in `results.tags`, and each group's own tags in `results.a` and `results.b` | `compareResponseSchema` |
| 4 | Does Qloo reject or ignore an unknown parameter? | Not stated. Another project's notes say ignored | the client's typed requests |
| 5 | Is the audiences list at `results.audiences` or `results.entities`? | The docs say `entities`. Another project's code reads `audiences` | `audiencesResponseSchema` |
| 6 | Which tag id field: `tag_id` or `id`? | `tag_id` in the taste analysis sample. Entity tags unseen | `tagSchema` (both optional) |
| 7 | Exclude-tags operator name | Guide and Reference: `operator.exclude.tags`. OpenAPI: `operator.filter.exclude.tags` | `operator.exclude.tags` |
| 8 | Resy filter names | Guide: `filter.properties.resy.rating.*`, `filter.resy.rating.party.*`, `filter.resy.rating_count.*`. OpenAPI: `filter.external.resy.rating|count|party_size.*` | the OpenAPI names |
| 9 | Hotel price range names | OpenAPI and Guide: `filter.price_range.from|to`. Reference: `.min|max` | `from|to` |
| 10 | Which params does `urn:tag` take? | The Guide lists only paging and `diversify`. The taste analysis guide requires signals or `filter.tag.types` | `TagInsightsRequest` |
| 11 | `filter.parents.types` values | The OpenAPI enum lists audience parent types; the tag guide passes entity types | `string[]` |
| 12 | Heatmap `bias.trends` and `.audiences.weight` | In the heatmap guide, not in the Guide's heatmap table | `HeatmapRequest` |
| 13 | What does a 404 mean? | The docs list 404 as an error. Another project treated it as "no results" | the client throws |
| 14 | Shapes of `/v2/tags/types` and `/v2/audiences/types` | not shown | `typesResponseSchema` (not read) |

## Seen in another project's code, not yet checked here

Shelva (books) ran against the live API. These are its findings, kept as things to test, not facts:

- A book entity id is rejected as a signal outside book insights, demographics and compare. A book's tags can be read from compare's `results.a`. Does the same hold for movies?
- Insights from a tag signal can take 10 to 60 seconds on non-book types, and the locality heatmap is slow. The default timeout here is 30 s.
- `/entities` returned no tags for books. The smoke script checks movies.

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
3. Settle each conflict above. Fix the schemas and types, remove the `TODO(verify)` markers that are confirmed, and update the status table with the date.
4. Contract tests that parse the fixtures arrive with the first tools ([testing.md](../testing.md)).

## Open questions

From [PRD §9](../product/prd.md): coverage of Nigerian titles, artists and authors; Lagos against no location; whether location changes age and gender splits; podcast and game coverage; the quota header (reported near 10,000 calls a month); what may be shown on public share links. Add: whether recorded responses may be committed to a public repository.
