# Qloo

Qloo supplies the taste data. What we compute on top is in [spec §5](../product/spec.md). This file says what Qloo offers, how our client groups it, and what is confirmed. An endpoint or parameter not marked verified here is not to be relied on (hard rule 3).

## What is verified

| Area | Status |
|---|---|
| Host `hackathon.api.qloo.com`, `X-Api-Key` auth | verified |
| `/search`, `/entities` (by Qloo id and by IMDb id) | verified |
| `/v2/tags`, `/v2/tags/types` | verified on our key. Qloo's reference pages for Search Tags and Tag Types return 404, so the parameters are checked only by our probes (`TODO(verify)` against the docs when the pages return) |
| `/v2/audiences`, `/v2/audiences/types` | worked on the hackathon host, but Qloo marks `/v2/audiences` deprecated and names no replacement. Not used: the client has no call for them |
| `/v2/insights` for movie, tv_show, artist, book, podcast, videogame, brand, place | verified. Place needs `filter.tags` set to a place category and `filter.location.query` set to a city |
| `/v2/insights` for person, destination, locality | documented, not exercised. A person as the only signal is rejected |
| `/v2/insights` with `urn:tag`, `urn:demographics`, `urn:heatmap` (geohash) | verified. Locality heatmaps are unstable and not used |
| `/v2/analysis/compare` | verified, shape differs from the OpenAPI definition |
| `/v2/trending` | verified, with caveats on the date window |
| Context that shapes a Film query | verified on one brief: genre tag on artists, `filter.release_country` (full country name), `signal.location.query`, `signal.demographics.age`, place categories per city, brand categories (`urn:tag:genre:brand:*`), theme, archetype and audience tags on comps, tags shared with genre peers from compare |
| Ranking a candidate list we choose (`filter.results.entities`) | verified for films, books and brands |
| Whether a recorded response may be committed or shown on a public share link | unknown. Ask Qloo. Qloo's public Terms of Use say nothing about showing API output; they bar selling, redistributing or sublicensing the Services, which include data obtained from the APIs, and a signed agreement overrides them. Share links therefore carry the plan and finding summaries only, never a receipt's `input` or `returned` |

Anything below marked `TODO(verify)` is untested. Re-run the probes (see [Verifying](#verifying)) before relying on it for a new category.

## How Oraqul uses Qloo

Qloo is a taste graph. It says who likes what, and where, for the things it knows. It is not a catalogue we look the launch up in: most of what a team brings (an unreleased film, a book before publication) is not in Qloo. So we describe the launch by what surrounds it and ask Qloo about that.

- **Anchors.** Anything with a public name that Qloo can take as a signal: the title when it exists, comparable titles, the cast or author, themes and tags, partner brands, places and age bands (hard rule 7). An anchor Qloo knows well is strong; one it barely knows (no `popularity`, few tags) is weak.
- **Questions.** Who the audience is (demographics), where it concentrates (heatmap), what else that audience likes (entities of any type, tags), who overlaps with whom (compare), what is rising (trending).
- **Comps first.** Three to five comparable titles that belong together. A grab bag of unrelated anchors collapses into generic titles. A person cannot be the signal, so use the author's or cast member's other work.
- **Ask each question of the whole bundle in one call.** Scores from separate calls are never compared.
- **Context makes data sharp.** A comp signal alone drifts to what is popular overall. A tag, release country, city or age band makes it specific.
- **Rank a list we choose, not an open list.** For partner brands the model names candidates that could realistically say yes and Qloo ranks only those (`filter.results.entities`). Open lists return the biggest names.
- **Qloo ranks, the model explains.** The model may skip a poor fit but must not re-rank a list Qloo ranked. Qloo is stateless: resolve names to ids once and resend them.
- **Thin signals lower confidence.** A signal is thin when it rests on few or weak anchors. It is worked out per claim in each run ([spec §5.1](../product/spec.md#51-confidence)), and leave-one-out reruns show when an answer rests on one comp.

Detail on why, and what a good plan is, is in [principles](../product/principles.md).

## Host, auth, limits

| Item | Value |
|---|---|
| Base URL | `QLOO_BASE_URL`. Production is `https://api.qloo.com`. We use `https://hackathon.api.qloo.com` |
| Auth | header `X-Api-Key: <key>`. Not a query parameter |
| Method | `GET` with a query string. `POST` bodies exist for some `*.query` parameters. The client does not use them |
| `take` | 1 to 50, default 20. Page with `page` (1 to 100) or `offset`. Not a limit everywhere (heatmaps, compare): slice in code |
| Radius | `filter.location.radius` and `signal.location.radius` in metres, up to 800 000. `/search` `filter.radius` is in miles, up to 100 |
| Rate | about 5 requests a second and about 10,000 a month on hackathon keys (unofficial). Parallel calls got 429, so the client keeps 2 in flight |
| Avoid | `/recommendations` and `/recs` (legacy), `urn:entity:audience` and `/v2/audiences` (deprecated), and the legacy search-only types actor, album, author, director. Use `person` |

## The client (`packages/engine/src/qloo`)

One `QlooClient` per agent run. Every call returns `{ data, call }`: `data` is the response, checked against a Zod schema, and `call` is the record of what was sent and received. A tool turns calls into receipts with `toReceipt(call, { returned, rule, confidence })`. `returned` is the part of the response the finding used, not the whole body: live responses are large (one movie carries about 335 tags; a heatmap is hundreds of KB). The client never sets confidence.

- **Concurrency.** At most 2 requests in flight (`maxConcurrent`).
- **Retry.** Once on a network error, a timeout or a 5xx; twice on a 429, waiting for `Retry-After` (at most 10 s) or 2 s then 4 s. Not on other 4xx. Then it throws `QlooError` with `kind` (`http`, `network`, `timeout`, `invalid_response`) and the `call`.
- **Budget.** `callBudget` (from `QLOO_CALL_BUDGET`, default 80) counts network calls; a retry is not a second call. When it is spent, `QlooBudgetError` is thrown before any request and the run ends with what is tested so far. A Film plan uses about 45 to 65 calls.
- **Memory.** An identical call later in the run, or made while the first is in flight, costs nothing and returns its own `call` with `cached: true`. Failures are not remembered.
- **Lookup cache.** An optional `LookupCache` shared across runs keeps `/search` and `/entities` answers for 14 days (at most 2000). The hit keeps the original `calledAt`. Insights calls are never kept across runs.
- **Injected `fetch`.** Tests and demo mode pass their own, so no request leaves the process.
- **Validation.** `responses.ts` checks the body once. Objects are loose, so fields we do not read are kept in `returned`.

Functions take the client first and are grouped by what you ask Qloo:

| Group | Import | Functions |
|---|---|---|
| Lookup | `lookup` | `search`, `entities`, `entitiesByExternalId`, `tags`, `tagTypes` |
| Insights | `insights` | `entities`, `tags`, `demographics`, `heatmap`, `heatmapByLocality` |
| Analysis | `analysis` | `compare`, `trending` |

Parameter names are Qloo's own, dotted, so a receipt's `input` shows exactly what was sent. `insights.entities` takes a request that is a union on `filter.type`: a filter that belongs to another type does not compile. Qloo **silently ignores** parameters a type does not support, so this is the only guard.

## Demo mode

`QLOO_MODE=demo` (the default) serves `demoFetch` (`packages/engine/src/qloo/demo-fetch.ts`): a few hand-written titles shaped like Qloo's responses. Ids start with `DEMO-`, receipts carry `source: 'demo'`, and the trace says "on demo data". It is not Qloo data. Any endpoint it does not know answers 404. `QLOO_MODE=live` needs `QLOO_API_KEY` and `QLOO_BASE_URL`.

## Tools to Qloo ([spec §4](../product/spec.md))

Tools live in `packages/engine/src/tools`. Their confidence follows [spec §5.1](../product/spec.md#51-confidence).

| Tool | Qloo call |
|---|---|
| `searchEntity` | `lookup.search` by name. It does not take an external id; `lookup.entitiesByExternalId` exists in the client but no tool calls it yet |
| `resolveBundle` | `lookup.search` per name, exact match first (ignoring case and accents). The Film pipeline takes the closest result when there is none |
| `resolveTags` | `lookup.tags` per phrase, keeping the first tag under the wanted urn prefix (brand categories need `filter.parents.types=urn:entity:brand`) |
| `findTaste` | `insights.entities` for one type with the comps as the signal and context: `filter.tags`, `signal.location.query` (or `filter.location.query` for places), `signal.demographics.age`, `filter.release_country`, `filter.release_year.min`, and `only` (sent as `filter.results.entities`) to rank a candidate list |
| `themeTags` | `insights.tags` with `filter.tag.types=urn:tag:<kind>:qloo`, one call per kind |
| `audienceBySegment` | `insights.demographics`, or `signal.demographics.*` on an entity insights call |
| `lift` | one `insights.entities` call with `filter.results.entities` set to the candidates, so all scores share one ranking |
| `rankPlaces` | `insights.heatmap` with all city boxes as one `MULTIPOLYGON`, one call; cells are assigned to cities in code |
| `rankPlaces` (areas) | no call: `readAreas` reads neighbourhoods from the cells already returned (nearest 8 within 0.1 degrees, at least 3, relative to the city mean). A lead, not a measurement of the neighbourhood |
| `scoreRivals` | a scoring call, not `/v2/analysis/compare`: one `insights.entities` call with `filter.results.entities` set to the rivals, and `filter.type` set to the rivals' type (movie, series, artist, video game, brand or podcast): a rival of another type is not scored |
| `bookProfiles` | `lookup.entities` for the anchors. The publication year, pages, series and typed tags (genre, book format such as Audiobook, age range) a book carries. Verified: `/entities` returns `publication_year` and `page_count` in `properties`, and the tags carry a type. Nothing is scored |
| `gameProfiles` | `lookup.entities` for the anchors. The platforms, age rating, developer, publisher and typed tags a game carries. Verified live on 8 games: `/entities` returns `platforms`, `content_rating`, `developer`, `publisher`, `release_date` and the tag kinds genre, category, gameplay_type, player_mode, skill_level, art_style and emotional_tone. The store tags (Souls-like, Roguelite, Indie, Open World) are under `category`. It returns no `genre`, `steam_tags` or `universe` property, so the franchise comes only from what the team says |
| `partnerFit` | `insights.entities` with no context. Not used by Film builds: open lists drift |
| `topicMap` | one `analysis.compare` call with the anchors as `a` and the rival shows as `b`. Verified live (2026-10-20): `results.a` and `results.b` list every tag each group carries with `query.count`, the number of that group's shows that carry it (a string); `results.tags` are the tags both share, with a near constant `query.score`. A topic is yours when only `a` lists it. Tags repeat under several namespaces, and only `theme`, `keyword`, `subgenre` and `genre` tags are subjects (`style`, `host`, `audience`, `content` and `archetype` are not), so topics are told apart by name within those |
| `momentum` | `analysis.trending` (not built) |

## Categories

Each pack declares the Qloo types it uses in `qloo` (`packages/packs`). Every category also asks about people, brands and places.

| Category | Titles | Talent | Partners | Places |
|---|---|---|---|---|
| Film and series | `movie`, `tv_show` | `person` | `brand` | `place` |
| Music | `artist` | `person` | `brand` | same |
| Books | `book` | `person` | `brand` | same |
| Podcasts | `podcast` | `person` | `brand` | same |
| Games | `videogame` | `person` | `brand` | same |

The anchors that stand in for an item not yet in Qloo differ by category. Film's are worked out and tested; Music's are built on demo data and unverified on the live host.

| Category | Likely anchors, strongest first (`TODO(verify)`) |
|---|---|
| Film and series | comparable titles, director and cast, source material, genre and theme tags |
| Books | the book when Qloo knows it by name, its earlier books, comparable books, a genre tag when it knows none. The author is not an anchor: a person is rejected as a signal. Verified live (a literary fiction brief and a romantasy brief, then whole plans for self help and middle grade): a book works as a signal for age rows, the heatmap, books with a genre tag, a city and a first publication year, podcasts with the books tag, brands with a category and a city, bookshops with the book store category in a city, and theme and archetype tags. A debut is `not_found`. Open lists of series and films drift (see Behaviour to know). `TODO(verify)`: other genres and markets |
| Music | the artist when Qloo knows it by name, sound-alike artists, a genre tag when it knows neither Verified live (2026-10-20, 40 calls, an established Afrobeats artist with three sound-alikes touring Lagos, London, Accra and Atlanta, see Behaviour to know): an artist works as a signal for age rows, the heatmap, artists with a genre tag and a city, series, films, brands, podcasts, campuses and theme tags. A genre tag as the only signal works for artists but gives one demographics row (`TODO(verify)`: other genres and markets) |
| Podcasts | the show when Qloo knows it by name, its earlier shows, comparable shows, a genre tag when it knows none. Verified live (2026-10-20, 23 calls, a true crime brief): a known show works as a signal for age and gender rows, the heatmap, shows with a genre tag and a city, brands, artists, series and people (`TODO(verify)`: other genres, other markets, and the quality of the open lists, see Behaviour to know). A host is not an anchor: a person is rejected as a signal |
| Games | the game when Qloo knows it by name, its franchise (earlier games), comparable games, a genre tag when it knows none. Verified live (`qloo:games-probes`): a game works as the only signal for artists, series, films, brands, podcasts, other games and people; a debut is `not_found`; `/entities` returns platforms, content rating and typed tags; the heatmap returns cells for a game signal; a game genre resolves in `urn:tag:genre:media`. `TODO(verify)`: anime (a series list with the anime tag came back empty), and the genre-only fallback, which returned unrelated games |

## Parameters by `filter.type`

From the Entity Type Parameter Guide, with differences noted under [Behaviour to know](#behaviour-to-know). Types are in `insights/filters.ts`.

**Shared by every entity type:** `filter.type` (required), `take`, `offset`, `bias.trends`, `filter.popularity.min|max` (0 to 1), `filter.tags` and `operator.filter.tags`, `filter.exclude.tags` and `operator.exclude.tags`, `filter.exclude.entities`, `filter.results.entities` and `.query`, `filter.external.exists` and its operator, `filter.parents.types`, `signal.interests.entities`, `signal.interests.tags`, `signal.demographics.age` and `.gender`.

| Type | Adds |
|---|---|
| `movie` | `filter.content_rating`, `filter.release_year.min|max`, `filter.release_country` and its operator, `filter.rating.min|max` (0 to 5) |
| `tv_show` | the movie set, plus `filter.finale_year.min|max`, `filter.latest_known_year.min|max` |
| `book` | `filter.publication_year.min|max`. **No location filters**, but `signal.location.query` changes the ranking (checked for a book signal) |
| `artist`, `podcast`, `videogame`, `brand` | nothing. **No location filters**, but `signal.location.query` changes the ranking |
| `person` | `filter.gender`, `filter.date_of_birth.min|max`, `filter.date_of_death.min|max` |
| `destination` | `signal.interests.entities` **required**; location filters (`filter.location`, `.radius`, `.geohash`, `filter.geocode.*`) |
| `place` | the destination location set, plus `sort_by`, `bias.quality`, `filter.address`, `filter.hours`, price, hotel class, business rating, `filter.references_brand`, Tripadvisor and Resy filters |
| `locality` | partial: only `signal.interests.entities`, and only localities |
| `urn:tag` | taste analysis. `filter.tag.types`, `filter.parents.types`, signals, `diversify.by=subtype` with `diversify.take` |
| `urn:demographics` | `signal.interests.entities` or `signal.interests.tags` (one is enough) |
| `urn:heatmap` | `filter.location` or `filter.location.query` **and** a signal; `output.heatmap.boundary` (`urn:geohash` or `urn:entity:locality`), `heatmap.dimensions` (`quality`, `popularity`, `hotel_class`, `price_level`), `filter.dimensions.*` |

**Signals.** `signal.demographics.age` takes `24_and_younger`, `25_to_29`, `30_to_34`, `35_to_44`, `45_to_54`, `55_and_older`, and the coarse `35_and_younger` and `36_to_55`. Weights are a number or `very_low`, `low`, `mid`, `medium`, `high`, `very_high`. Tag urns come from `lookup.tags`; never hardcode them.

**Not supported by the client:** parameters that need a `POST` body (`signal.interests.entities.query` and `filter.exclude.entities.query`, and tags with per-tag weights). Resolve names with `lookup.search` first.

## Response shapes we read

Checked once in `responses.ts`.

| Response | Shape |
|---|---|
| `/search`, `/entities` | `results: Entity[]`, with `types: ['urn:entity:movie']` and no `subtype` |
| `/v2/insights` entity types | `results.entities: Entity[]` with `subtype`; each may carry `query.affinity` and, with `feature.explainability`, `query.explainability` |
| `urn:tag` and `/v2/tags` | `results.tags: Tag[]` with `tag_id`, `name`, `subtype`, `types`, `query` (`{}` on plain lookups) |
| `urn:demographics` | `results.demographics: [{ entity_id, query: { age: {band: n}, gender: {male, female} } }]`. Values are affinities and can be negative. `entity_id` is a tag urn for a tag signal |
| `urn:heatmap` | `results.heatmap: [{ location: { latitude, longitude, geohash }, query: { affinity, affinity_rank, popularity } }]` |
| `/v2/trending` | `results.trending: [{ date, population_percentile, population_rank, population_rank_velocity, velocity_fold_change, population_percent_delta }]`, newest first. `population_rank` is a number written as text |
| `Entity` | `entity_id`, `name`, `subtype`, `popularity`, `properties` (movie: `release_year`, `release_date`, `description`, `content_rating`, `duration`, `image.url`, `akas`, `production_companies`, `genres`, `keywords`, `plot_summary`), `tags` |

## Behaviour to know

**Search never says "not found".** It returns the closest fuzzy matches, and the first hit is not always right (`Lionheart` returns a 1990 US film before the 2018 Nigerian one; `The Daily` returns *The Daily Zeitgeist*). "Not in Qloo" is a decision we make by matching name, year and country on the candidates. For an unreleased title it is the expected answer. Same-name films are common, and curly and straight apostrophes differ between how people type and how Qloo stores names.

**Missing popularity means thin data, not zero.** `popularity` is a 0 to 1 percentile and is `null` or absent for some titles.

**No result is a low score, not a missing result.** Scoring a candidate list returns every candidate with an affinity, so "no overlap" shows as a low score. A low score means little without a baseline scored in the same call. Affinities from separate calls are not comparable.

**Open-ended lists drift.** With no context they return what is popular overall: the same US R&B names for artists in every city, luxury names for brands, Korean and Indian titles for recent films. A tag, a release country, a city or an age band makes them sharp.

**Parameters**
- `signal.location.query` changes the ranking for every title type, though the Entity Type Parameter Guide omits it.
- `filter.release_country` takes the full country name (`Nigeria`); `NG` returns nothing.
- Lookup tags use `id`; `urn:tag` insights and compare use `tag_id`; tags inside entities vary.
- `filter.release_year.min` and `filter.content_rating` really filter.
- Qloo ignores unknown parameters rather than rejecting them.
- `insights.tags` with no type returns mostly style adjectives. `filter.tag.types=urn:tag:theme:qloo` gives themes, and `archetype:qloo` and `audience:qloo` work the same way. `plot:qloo` returns style adjectives too (Competitive, Bold, Timely), so it is not used. `theme:media` returns nothing.
- Brand categories need `filter.parents.types=urn:entity:brand` on the tag lookup, otherwise you get place categories. The fashion category still gives luxury names.
- Place categories work per city (`urn:tag:category:place:movie_theater`, churches, universities). Lists carry some poor fits (a hotel among cinemas, a theology school).
- A genre tag on podcasts gives genre shows; with only a city they are US-heavy.
- **Podcasts, checked live (2026-10-20, a true crime brief).** A show must match by exact title: "Casefile" is "Casefile True Crime", "My Favorite Murder" is "My Favorite Murder with Karen Kilgariff and Georgia Hardstark", "Armchair Expert" is "Armchair Expert with Dax Shepard", and "The Daily" and "The Rest Is Football" are not there at all (a search returns the nearest titles, which can be a different show). A debut is a miss, as expected. Podcast genre tags resolve in `urn:tag:genre:media` (`true_crime`, `comedy`, `business`).
- A genre tag with a city gives different show lists for London and Lagos. Scoring a candidate list works, but every show in the same genre scored 81 to 93, so the ranking is tight and the thirds in the audit are fine margins. Heatmap cells for a podcast signal: London 535, New York 658 and Toronto 168 ranked, Lagos 3 and Johannesburg 23 not ranked (under 25 cells), so African markets are mostly "could not rank" for podcasts.
- Podcast open lists with no genre context drift: artists and series for a true crime audience included comedies (Drunk History, Portlandia), and people included reality TV and internet personalities. The crossover and guests queries stay off (`CROSSOVER_GROUNDED`, `GUESTS_GROUNDED`) until a list with context is shown to fit. Brands asked by a category with a city returned US snack brands for London, which is why the model names candidate brands and Qloo ranks only those.
- **Podcasts for a Nigerian football show, checked live (2026-10-20).** Qloo's podcast catalogue is US-centric. A search for "Naija", "Nigeria", "Lagos", "Afrobeats" or "Pidgin" finds no podcast, "Nigerian football" returns fantasy football shows, and "Super Eagles" returns Philadelphia Eagles shows, so "football" means American football there. A Lagos or Abuja location query changes the show list a little and the two return the same list. `urn:tag:genre:media:soccer` exists but lists only two shows (American Fiasco, The Best Soccer Show); `urn:tag:genre:media:sports` lists American sports shows (PTI, The Bill Simmons Podcast). So a football brief outside the US is asked with the soccer tag, then topped up with sports when soccer lists fewer than three shows. Lagos did rank for a football signal (lift 1.24, 18 to 20 calls for a whole plan), unlike for true crime.
- **Books, checked live (a literary fiction brief and a romantasy brief; whole plans for a self help and a middle grade brief).**
  - A book matches by name with or without its series: Qloo lists "Fourth Wing (The Empyrean, #1)", "Dune (Dune, #1)" and "Things Fall Apart (The African Trilogy, #1)", and escapes an ampersand as HTML ("Atomic Habits: An Easy &amp; Proven Way..."). Our match ignores both. Several books or screen titles can share one name (a series and its remake), so a same-name pick is settled by popularity. A book with a long subtitle may stand in as the nearest title.
  - `/entities` returns `publication_year`, `page_count`, an ISBN and typed tags (genre in `urn:tag:genre:media` and `urn:tag:genre:qloo`, book format, age range, theme, setting, character). A book genre phrase resolves in `urn:tag:genre:media` (literary fiction, romance, fantasy romance, fantasy, thriller, mystery, historical fiction, science fiction, young adult, children, memoir, biography, self help, business, non fiction, poetry, graphic novels, cookbooks, religion, african literature).
  - Books with a genre tag and a first publication year list recent books on topic; a city changes the list. Scoring a candidate list works, but scores sit close together (0.93 to 0.98 in the probe), so the order is a lead and not a margin. The list can hold later books of the anchors' own series, an omnibus entry that joins the anchors' titles with " / ", and several books of one series, so the shelf drops them.
  - Open lists of series and films for a book audience drift, even with a genre tag: the probe returned documentaries and independent dramas. A city makes series more plausible without fixing it. Scoring series and films we choose works, one medium per call. Podcasts with the books tag are on topic.
  - Age and gender rows came back for every anchor probed, and the heatmap gave hundreds of cells for popular books in London, Lagos, New York and Johannesburg (Toronto fewer). That does not hold for every book (see Demographics).
  - Brands with a category tag and a city work (beverage and telecom). Bookshops work with the book store category in London, Lagos and New York; Johannesburg and Toronto can return none.
  - People for a book signal are authors for a literary fiction audience but voice actors and narrators for a fantasy romance one, so they are not used (`CREATORS_GROUNDED`).
  - Theme, archetype and audience tags come back for a book signal.
- Compare returns shared tags (`results.tags`, each with `query.score`) and each side's own tags (`results.a`, `results.b`), not an entity list. What sets the comps apart is in each side's own tags.
- **Catalog candidates, checked live (a Nigerian crime film brief, then an Afrobeats artist; `pnpm --filter @oraqul/engine qloo:catalog-probes`).** Video games with a city and no tag give plausible lists for a crime audience (open-world and action games); a game genre tag returned nothing. Books with a crime or thriller tag, a city and a first year drift to political non fiction and US titles, so they are not asked for a film audience. Bar and night club categories per city list real venues (Lagos and London); restaurants and coffee shops mix in hotels and chains; a gym, record store and bookstore are off topic for a film and thin for Lagos. For an artist signal, night clubs and concert halls work in London and Lagos (Lagos concert halls are few), and the music venue category is thin in Lagos. A bar list can carry a stray non venue (a police union); the venue filter drops police and union names. `TODO(verify)`: other genres and markets.
- Trending needs `signal.interests.entities` (else 400) and a window of 180 days or more (shorter returned no points).

**Demographics**
- Age and gender profiles exist for most things (films, series, artists, podcasts, games) but only about half of books. A title without one returns a normal 200 with no rows; a call with several entities returns rows only for those with data. Popularity and tag count do not predict it.
- A genre tag can stand in, labelled as the genre's audience.
- Any audience line must count how many comps actually returned a row.

**Signals**
- A person is not a usable signal: an author or cast member with no `popularity` gave 400 "All of the provided signal.interests.entities were invalid".
- A bundle that is not coherent gives noise. Check in code that the comps agree before trusting it.
- A bundle can rest on one comp. Dropping the others changes nothing, dropping that one changes the answer. Count the comps that change the answer, not the comps given.
- Locality insights accept only a locality as the signal.
- Artist signals return books, podcasts, games and films, so cross-domain tests work when a candidate list is scored against a baseline in one call.

**Heatmaps**
- One geohash `urn:heatmap` call over several city boxes (a `MULTIPOLYGON`) works, is repeatable, and its order follows the bundle. Cells are assigned to cities in code.
- Books gave far fewer cells than artists in the first measurement, and hundreds for popular books in the Books probe, so a city still needs a minimum number of cells before it is ranked.
- The mean cell affinity depends on how the city box is drawn. A fixed box and a minimum cell count are a start, not a validated rule.
- Cells are coarse (about 3 to 7 km), so neighbourhood readings from them are leads.

**Music (artist signals, 2026-10-20, one Afrobeats brief; other genres and markets are `TODO(verify)`)**
- Qloo knows an established artist by exact name and does not know a made-up debut (`not_found`), so the debut path is reached by name. An artist alone, its sound-alikes alone and both together all return age rows, and the heatmap ranks cells for each. Leave-one-out holds on the bundle and returns nothing for a single anchor.
- Support acts: artists with the genre tag and a city work, differ by city, and an age filter reorders them. The anchors did not come back even with no exclude, so excluding them costs nothing. With the artist alone the list is mostly the sound-alikes themselves.
- Series with a city and a release year: London and Atlanta differ and read well. Lagos and Accra return nearly the same mostly American sitcoms as Atlanta, so per-city series lines for African cities are weak leads, not city facts. Films with no country drift to unrelated recent titles; with a release country they are relevant.
- Brands with a category tag and a city work (telecom in London); with no tag Lagos returns a plausible local mix. Podcasts with no genre tag drift to general self-help shows; with a genre tag they are on topic. Campuses work for London, Atlanta and Accra.
- Theme, archetype and audience tags come back for an artist signal, so a `themes` query is possible. It is not in the catalog.
- The tour order test ([spec §5.4](../product/spec.md)) compresses on live lifts: with city lifts from 0.4 to 1.6, the best order scores 100%, an adjacent swap of a 1.3 and a 0.6 city scores about 98%, and the worst possible order about 88%. The 95% and 85% edges can barely trip.

**Size.** One movie result is about 335 tags; ten movie results were about 780 KB; a Lagos heatmap about 250 KB; a Nigeria locality heatmap 6.8 MB. A receipt holds the excerpt a finding used, which is why `toReceipt` requires `returned`. A share link carries receipts without their `input` and `returned`, so raw Qloo data does not reach it ([PRD](../product/prd.md)).

**Coverage.** Nigerian films, series and artists were present when checked, some with low popularity (a weaker signal, feeding confidence). Nigerian and other African literary books were present (Americanah, Half of a Yellow Sun, Purple Hibiscus; Things Fall Apart with its series mark). Coverage for podcasts, games, music and other regions is not measured.

## Not yet verified (`TODO(verify)`)

- The exclude-tags operator name (`operator.exclude.tags`), the Resy filter names, hotel price range names, `filter.parents.types` values, and heatmap `bias.trends`.
- `person`, `place`, `destination` and `locality` insights beyond the cases above, and the weights for age, gender and location.
- Whether location changes the demographics (no location parameter is documented for that call).
- Whether tag-signal calls are slow on non-book types, and what Qloo returns for a true 404.
- Cross-domain tests beyond the cases above: other kinds of book, podcasts and games as targets, low-popularity candidates, and how large a gap between kind and baseline counts as a real signal.
- Games: an anime tag on a game signal (the list came back empty); what a genre tag as the only signal returns (unrelated games in the probe); theme and audience tags for games, which read as generic ("Health Optimization") where gameplay type, tone and platform read well. `person` returned mostly streamers and video creators with some executives and designers, so `CREATORS_GROUNDED` stays false until someone decides that mix is good enough to name.
- Games, settled: `filter.results.entities` scores every medium probed, and an open discovery call and a scored call give the same affinity for one id, so scoring is needed only for a candidate discovery would not list, such as a collab.
- Books: other genres and markets, a book genre tag as the only signal for a book Qloo does not know (one demographics row in the probe), the franchise or series property, `filter.publication_year.max`, and how many books carry age and gender rows (about half in the first measurement). `person` is not used for authors until a list that fits every genre is shown.
- Whether explainability (`feature.explainability`) can replace our leave-one-out reruns.
- Quota header, and whether recorded responses may be committed or shown on a public share link.

## Rules

- Every call produces a call record, and every grounded line cites a finding built from calls ([spec §6](../product/spec.md)).
- Scores from separate calls are not comparable. Rival overlap, city ranking and scenario diffs must come from one call.
- Cache within a run. Respect `QLOO_CALL_BUDGET`.
- Only public entity names, place names and age bands go out. No personal data.
- Everything goes through `QlooClient` straight to the Qloo API. No harness, starter kit or sidecar. Validation, tests and evals are ours.
- Never fill a missing result from the model.

## Verifying

1. Put `QLOO_API_KEY` and `QLOO_BASE_URL` in `.env`.
2. `pnpm --filter @oraqul/engine qloo:smoke` makes about 50 calls, prints counts and yes/no only, and saves one response per endpoint and category type to `packages/engine/fixtures` (gitignored).
3. `pnpm --filter @oraqul/engine qloo:film-probes` (about 50 calls) reruns the Film query catalog checks. It prints titles and scores so they can be judged by eye, and saves nothing. Copy conclusions into this file, not names or scores.
4. `pnpm --filter @oraqul/engine qloo:music-probes` (about 40 calls) does the same for the Music catalog: an artist as an anchor and a debut as a miss, heatmap cells for artist anchors, support acts with the anchors excluded, a genre tag as the only signal, series, films, brands, podcasts, campuses and theme tags on an artist signal.
5. `pnpm --filter @oraqul/engine qloo:games-probes` (about 70 calls) does the same for the Games catalog: a game as an anchor and a debut as a miss, `/entities` metadata, heatmap cells for game anchors, a location query on a game list, tag lookup for a genre, anime and gaming podcasts, what a game audience likes in each kind of media and whether scoring a candidate list agrees with the open list, theme and gameplay tags, gaming podcasts, people as creators, brands, campuses and a genre tag as the only signal.
6. `pnpm --filter @oraqul/engine qloo:podcasts-probes` (about 40 calls) does the same for the Podcasts catalog: a podcast as an anchor and a debut as a miss, heatmap cells for podcast anchors, tag lookup for a podcast genre, the shows a podcast audience hears with a genre tag and a city, scoring a candidate list of shows in one call, the shape of `analysis.compare` for two groups of shows (the topic map), brands, artists and series, people as guests, and a genre tag as the only signal.
7. `pnpm --filter @oraqul/engine qloo:books-probes` (about 140 calls) does the same for the Books catalog: a book as an anchor and a debut as a miss, the fallback books by exact name, what `/entities` carries for a book, heatmap cells for book anchors, tag lookup for book genres, the shelf with a genre tag, a city and a first year, scoring a candidate list of books in one call, series, films and podcasts a book audience follows with and without context, scoring named screen titles, theme tags, brands, bookshop, library and university categories, people as creators, a second genre (romantasy), the exact names of the screen titles, and a genre tag as the only signal.
8. Settle anything open above, fix the schemas and types, and remove the `TODO(verify)` markers that are confirmed.
