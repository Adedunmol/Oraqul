# Oraqul: Backlog

Ideas agreed worth building, not yet in the PRD. Each moves into [prd.md](prd.md) with an ID and a priority when we pick it up, and leaves this file. Nothing here is built.

Noted 2026-10-15, from a look at similar tools and work on agent receipts, and from a review of each category's packs and output screens.

Sections: [A. New across the product](#a-new-across-the-product) · [B. Changes to existing features](#b-changes-to-existing-features) · [C. New per category](#c-new-per-category) · [D. Open decision: overlap](#d-open-decision-overlap)

## A. New across the product

### 1. Receipt quality, measured

Claim-level auditability is becoming a research area of its own ([arXiv 2602.13855](https://arxiv.org/html/2602.13855v1)). It proposes four measures: provenance coverage (share of claims with evidence), provenance soundness (the evidence really supports the claim), contradiction transparency and audit effort.

- Add the first two to `packages/eval` and track them per category. Hard rules 1 and 2 already make soundness checkable by code: the number in a claim must equal the value in its receipt.
- Make receipts tamper-evident: a hash of each Qloo response and a hash chain per run, so a saved output can prove it was not edited later. IETF drafts exist ([AER-1](https://datatracker.ietf.org/doc/draft-zambo-aer1/18/), [SCITT agent receipts](https://ftp.kaist.ac.kr/ietf/draft-noa-scitt-ai-agent-receipt-01.xml)) but are single author drafts. Follow them, do not depend on them.

Touches: `packages/schema` (receipt), `packages/engine/src/receipts.ts`, `packages/eval`.

### 2. Verdict track record

Rescue already brings in what really happened. Keep each verdict a plan made and, when results arrive, whether it held. Over time this shows "when Oraqul said Holds, it held N of M times", per category.

- Stays inside the no forecasts rule: it scores past verdicts, it predicts nothing.
- Needs a stored link from a rescue result back to the plan lines it tests, and a rule, written in [spec §5](spec.md), for when a result confirms or contradicts a verdict.
- Shown per team first. Across teams only as counts, and only if teams agree.

Touches: schema and a migration, the rescue flow, a new view.

### 3. Watch mode

Rerun a saved output on a schedule (weekly by default) with fresh Qloo data and tell the team when a verdict changes. PRD E7 already asks for reruns; this adds the schedule and the notice.

- Each scheduled run counts against the Qloo call budget, so the budget per team must allow it.
- Notice by email first (Brevo is already a processor), Slack later (item 5).
- The notice says only what changed and links to the Changes tab.

### 4. MCP server first class

PRD G3 has it at P1. Move it forward: it lets other agents (Claude, ChatGPT, in house tools) call Oraqul's tools and get receipts back, which is distribution we do not have to build screens for.

- Publish it in the public MCP directories once it runs.
- Every MCP result carries the same receipts as the app.
- Auth per team, with the same call budget.

### 5. Bring your own data, then connectors

Rescue needs the team's own numbers. Take them as files first, connectors later.

- CSV and XLSX templates per category, matching each pack's results format: box office or viewing by territory, streams and tickets by city, pre orders by market, host dashboard exports for podcasts, wishlists by region for games.
- Then connectors, read only, aggregates only (hard rule 7): Spotify for Artists, Steamworks, podcast hosts, Slack for notices, Notion or Google Docs for briefs.
- Do not build on the Spotify Web API. Reports say it removed Recommendations and Audio Features for new apps and limits apps in development mode to 5 users. `TODO(verify)` against developer.spotify.com.
- Any second source shown beside Qloo is labelled as external on the line (spec §4) and never replaces Qloo evidence. Check that it does not go against the PRD non goal on social metrics before adding one.

### 6. Deck export

Export a saved output as a short deck (bottom line, up to three moves, the evidence appendix) besides the one page brief (PRD O3). Same receipts and confidence per line.

### Connectable sources, not checked

Leads only. Each is `TODO(verify)` until probed like Qloo was.

| Source | What it could add | Catch |
|---|---|---|
| TMDB | Film and series metadata, upcoming release dates for the rival date check | Commercial use needs a licence |
| IGDB | Game metadata and release dates | Twitch login. Metadata only, no wishlists |
| Open Library | Book metadata, editions, dates | Goodreads has closed its API |
| Chartmetric | Music audience by city | Paid, from about $350 a month. City data in the API not confirmed |
| Parrot Analytics, Luminate | Demand and viewing data | Paid, enterprise terms |

## B. Changes to existing features

### 7. Category knowledge moves into the real packs

What each category asks, plans, tests and shows lives today in the web demo (`apps/web/src/lib/demo/packs/`). The packs the agents use (`packages/packs`) have empty plan sections and coverage and two tools, and the live category agents are placeholders. Move fields, plan sections, assumption checklists, scenarios, results formats and signature tabs into `packages/packs`, and serve what the screens need through the API, since the web app imports types from `schema` only ([spec §2](spec.md#2-monorepo)).

### 8. Tabs, questions and results follow the format

Each pack lists formats (`kinds`) but the output looks the same for all of them. The format should pick the signature tabs, the rescue results format, the scenarios and the follow up questions.

| Category | Formats that need their own shape |
|---|---|
| Film and series | Film: territories, opening weekend, weekend two hold. Series: episode drop off, weekly or all at once, season against season |
| Music | Tour: route, support acts, first show date, sell through. Single, EP or album: lead cities and markets, collabs, no route |
| Books | Debut: rests on comps. Series book: book one is the strongest anchor |
| Podcasts | New show: hosts and comp shows. Season two: season one is an anchor |
| Games | Premium: wishlists, sales. Free to play: day 1, 7 and 30 retention, no wishlists |

### 9. Every plan line says where its evidence comes from

Some plan sections name things Qloo has no entity type for: playlists and radio, newsletters, festivals and showcases, book club networks, retailers. Guests, creators and streamers would be people, and person insights are documented but not exercised ([qloo.md](../backend/qloo.md#status)). Segment names such as "superfans", "playlist only listeners", "book club readers" or "co op players" are not age or gender bands, and only hold if they come back from `/v2/audiences`.

Each such line carries one of three labels: tested against Qloo, read from a proxy (say which), or you bring this. Lines with no receipt never get a fit score (hard rule 1).

### 10. Coverage pages claim only what is tested

The coverage columns on `/categories` and in the help dialog must match what the packs can test. Games lists "platform habit", which Qloo does not have: move it to "You bring". Recheck every column against [qloo.md](../backend/qloo.md) when item 7 lands.

### 11. Audience lines say when they rest on the genre

About half of books have no age and gender profile in Qloo, and the read then falls back to the comps that have one or to the genre tag. The audience line should say so ("read from the genre's audience") and lower its confidence, in every category where it happens.

### 12. Gender in rescue

Rescue compares results by age and by place. Qloo returns gender skews too, and most dashboards report it. Accept a gender split in the results format where the category's source has one.

### 13. Copy fixes

- Never assume a person's gender. The lead and support act are names the user typed: "their fans", "the lead actor", "their lift".
- Drafts sign off with the team's name, not a made up one.

## C. New per category

All of these use Qloo values that are verified, unless marked `TODO(verify)`.

### Film and series

- **Festival route.** A plan section ranking festivals by audience fit. Festivals are not a Qloo entity type, so this rests on item 9's proxy rule. `TODO(verify)`
- **Rights by territory.** A column on the Territories tab the team fills in: sold, open, or which distributor. Sales agents plan by it. Not from Qloo.
- **Pairings for streaming.** "Trailer pairings" fits cinemas. For streaming, the section becomes titles to pair with.

### Music

- **Sync shelf.** Films, series and games whose audience fits the artist, as places to pitch sync. An artist signal returning movies and videogames is verified ([qloo.md](../backend/qloo.md#what-the-live-run-showed)).
- **Collab finder.** Artists whose fans overlap with the headliner's, by city.
- **Momentum.** Whether the headliner and similar artists are rising or fading, from `/v2/trending` (verified, needs a window of 180 days or more). No screen uses trending yet.
- **Route by distance.** The route tab also shows the order by travel distance, computed by code from city coordinates and labelled as not from Qloo.

### Books

- **Comp checks.** Flag a comp that is too big to pitch against (Qloo `popularity`) or too old (release year). These are the rules editors use.
- **Rights markets.** Countries ranked by lift, as markets for translation rights.

### Podcasts

- **Episode slate.** Turns the topics only the show owns into an order of episodes.
- **Guest ranking** rests on person insights. Probe them before building. `TODO(verify)`

### Games

- **Store page tags.** Qloo tags from the comp games' audience, as the tags to lead the store page with.
- **Localisation order.** Languages in the order of the region ranking.

## D. Open decision: overlap

Rival overlap (above 60 risky), the comp shelf, guest and creator overlap and the fan base bridge all show a 0 to 100 overlap. According to [qloo.md](../backend/qloo.md#conflicts-and-how-they-were-settled), compare returns shared tags with scores, not an overlap between two audiences. What is verified is scoring a candidate list in one call (affinity about 0.33 to 0.75), which means something only as lift over a baseline. The comp shelf also says "Share of readers who also read your book", which the data cannot say.

Options:

1. **Lift over a baseline, from one call.** Same bands as cities (1.5 and 1.2). Uses only verified calls. Changes the rival thresholds in [spec §5](spec.md#5-scoring-layer) and the `overlap` fields in the schema.
2. **A shared tag score from compare.** Keeps 0 to 100, but the formula is ours and untested.
3. **Fix the wording only for now.** Drop "percent" and "share of readers", decide the source later.

Not decided. Until it is, no new screen should add another overlap number.
