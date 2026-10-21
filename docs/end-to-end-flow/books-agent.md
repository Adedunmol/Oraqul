# Books agent: how it works end to end

A plain-language map of what the Books agent does from the first message to the saved output, what it can produce, and where it falls short of the docs. Product behaviour is in [product/spec.md](../product/spec.md); the technical map is [backend/books-overview.md](../backend/books-overview.md). It runs on the same runtime as the Film, Music, Games and Podcasts agents, so the path of a message is the one in [film-agent.md](film-agent.md#the-path-of-a-message), with category `books`. Where this file and those disagree, they win.

Status: built on the shared launch runtime, and tested on demo data (unit specs, golden runs, and an end-to-end spec through the API). Run against live Qloo on briefs for literary fiction, romantasy, self help and middle grade.

## What it can do

| Job | Reply type | What it does |
|---|---|---|
| Build | plan | Turns a description into a launch plan: bottom line, positioning, audience, markets, and the sections that fit the launch kind, route, readership and formats (comp titles, screen and audio angles, retail and pre-orders, press and reviews, events, creators, brand partners, book clubs, audiobook, schools and libraries, series and backlist), then launch beats, budget split, what to measure and risks. The team's markets, kind, route, comparable books, screen comparisons and bookshops stay as chosen. |
| Audit | report | Tests each assumption in an existing plan: age, gender, each market, the comparable books and their age, each screen title, each bookshop and each brand partner. Output: assumptions grouped by verdict, risks, Worth a look, results against the plan when the book is out, and a fix for each weak or broken item. |
| Fix | report, then plan | Audits first, then writes a new plan. It asks whether the book is out, and for results by market if it is. |
| Answer | message only | A question about the plan, answered from its saved findings and checked like a plan line. |
| What-if | plan (`scenario`) | Reruns the plan with changed markets, comparable books, screen comparisons, age or gender and shows what changed. |
| Rival date check | small brief | Scores rival books against the plan's readers on the dates given. |
| Partner brief | small brief | A drafted pitch to a brand or a podcast, scored against the plan's findings. Nothing is ever sent. |

## What is different from Film, Music, Games and Podcasts

- **The launch kind, route, readership and formats decide the plan.** A debut, a new book by an author, the next book in a series and a reissue get their own sections, calendar, measures and budget split. A self-published book swaps the retail sell-in for ads and newsletters, a book for young readers adds schools and libraries, and an audiobook adds its own section. The agent never asks which: it plans a debut through a publisher for adults and says what it assumed.
- **The calendar is built by code from today.** Beats become dates when the publication date is known, and a beat already over is never advised. Festival and prize dates and rival releases appear only when a web source states them.
- **The comp shelf.** The plan lists the recent books the readers pick up, which are the comps to pitch against. The comps the team named are tested for how recent they are, and an older one stays beside a recent book.
- **The adaptation bridge.** The plan ranks the series and films the readers also watch, and the podcasts they hear, as comparisons for the pitch, each only against titles of its own medium. A screen title the team named is scored in the same call as the rest. It is never presented as an adaptation that exists.
- **Bookshops.** Qloo lists the bookshops the readers go to per city, which feed events and stock.
- **The author is never a signal.** Qloo rejects a person as one, so the earlier books and the comparable books describe the readers.
- **Markets, not only cities.** A region such as West Africa is ranked through the cities that stand for it. With none named, the usual markets are ranked and said to be an assumption.

## Rules held in code

The same as Film's ([film-agent.md](film-agent.md#rules-held-in-code)): verdicts, scores and confidence come from Qloo values; a line that claims something about taste or place cites a finding; code checks every line; forecasts, pricing advice and sending are refused before any model or Qloo call; only public names and age bands go to Qloo; an audit or a fix never tells a team to drop a market, a comparable book, a screen comparison or a bookshop it chose. A line that states a copies, pre-order, sales, review or listens count needs a web source like any money figure.

## What it does not yet do

- **Wide live coverage.** The queries were run live on four briefs. Other genres and markets are `TODO(verify)` in [qloo.md](../backend/qloo.md), and Qloo holds age and gender for only about half of books. Run `pnpm --filter @oraqul/engine qloo:books-probes` after any change to the queries.
- **A default screen angle for non fiction.** Qloo's open lists of series and films drift, so the bridge scores titles we choose. For a memoir or a self help book the pack has none, and the bridge shows the podcasts until the model or the team names a title.
- **Creators and authors.** Qloo returns lists, but they do not fit every genre, so Creators is launch practice.
- **Recorded live golden runs.** Books has demo goldens only.
- **The gaps Film has** ([film-agent.md](film-agent.md#what-the-docs-say-it-should-do-that-it-does-not-yet)): memory, next-step suggestions, the results cards, and the missing engine tools.
- **The screens** are the shared ones (Plan tab, receipts drawer, exports) plus the Comp shelf, Adaptation bridge and Markets tabs. They have not been compared with the prototype.
