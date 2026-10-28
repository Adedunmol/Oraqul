# Description-first: remove hardcoded stand-ins, work from what the person wrote

Working note, not product docs. Nothing in this note has been applied. The working tree was left clean.

## The problem in one line

Oraqul describes a launch by anchors (comps) looked up in Qloo. Most people do not give comps; they describe the launch in their own words. Today the code does not turn that description into anchors well, so hardcoded lists and defaults fill the gap.

Example brief to keep in mind:
"I just wrote a book titled 'how to be a man', about motivation, rules, etiquette of moving from boyhood to manhood. I don't know how to go about the launch and where to launch."

## What the code does today

Path (`apps/api/src/agent/launch/pipeline.ts`):

1. Reader (per category `read.ts`) extracts quote-checked facts, and also proposes `suggestedComps` when fewer than 3 comps are named.
2. Analyst (`launch/analyse.ts`) runs after the reader and fills empty genre, country, places, ages. It does not influence the comps.
3. `findComps` (pipeline.ts:1392) looks up the named comps, then the model's proposals, up to 4.
4. If nothing resolves, `findGenreComps` (pipeline.ts:1508) lists titles for the genre tag from Qloo.
5. If that fails, `noCompsStop` says "tell me what it is about".
6. Everything (audience, markets, partners, rival overlap, leave-one-out) is computed from those anchors.

The only comp-free path is `regionSeeds` (launch/findings.ts:804): artists and brands only, first two cities, needs an age band.

## Problems found

1. The analyst does not feed the comps. Comps are chosen by the reader before it runs.
2. The comp proposal is one clause inside a long extraction prompt. Nothing makes the model work out who the readers are first, then pick comps for them. Nothing checks the picks fit the subject.
3. Hardcoded comp lists. Books, Games and Podcasts have `FALLBACK_COMPS` (books/catalog.ts, games/catalog.ts, podcasts/catalog.ts). Film, Music, Live shows have none. They fire only when the model proposes none (no model key, or a failed call). Keyword matching misses ("motivation", "etiquette" fall to the catch-all: Where the Crawdads Sing, Educated, Gone Girl, Normal People). Lists are US/UK-heavy, popularity-heavy, checked on one date.
4. Model-chosen comps count as full evidence. `anchorsWithData` counts demographics rows with no check on source (`you` or `added`). The `standIn` input in `packages/engine/src/confidence.ts` is never passed by any caller, so spec §5.1 "stand-ins are lower" is not implemented. A one-line brief can read "high: 4 anchors with data".
5. The audience is not worked out first. The analyst can infer ages but the comps do not depend on it.
6. Model-proposed comps are not stored between runs, so the same brief can produce different anchors, and so different findings, on a different model or version. The reader uses temperature 0.

## Other hardcoded data that shapes output

Group 1, comps: the three `FALLBACK_COMPS` lists above.

Group 2, taste stand-ins that run even with a model key:

- `SCREEN_CANDIDATES` (books/catalog.ts, used by books/planner.ts:95). Series and films scored for the adaptation bridge, picked by regex on genre. Examples: Bridgerton, The Witcher, Big Little Lies. The model can add titles; these are the defaults. A book with no story (memoir, self help) gets an empty list.
- `BASELINE_BRANDS`, `BASELINE_PODCASTS`, `BASELINE_BOOKS` (packages/packs/src/launch.ts:87-89). Coca-Cola, Nike, McDonald's, Joe Rogan, Crime Junkie, Where the Crawdads Sing, Atomic Habits. Used only by the partner brief (`launch/follow-ups.ts:524`) to score a partner's lift. US mass-market names for every market. Replacing them changes what "fit" means, so it needs a live Qloo check (hard rule 3). Treated as a separate change.
- `GENRE_PHRASES` (books, podcasts) and `PODCAST_GENRES` (launch.ts): regex to tag phrase. A genre not listed gets no tag.

Group 3, market and geography assumptions:

- `typical` in each category config. A bare brief is planned as: Film = Nollywood drama in Nigeria, Music = afrobeats in Nigeria, Live shows = comedy in Nigeria, Books = literary fiction, Podcasts = interview, Games = action.
- `MUSIC_SCENES` (8 countries), `DIASPORA` (6), `COUNTRY_CHANNELS` (Nigeria only), `REGION_CITIES`, `KIND_PROFILES.defaultCities`. Unlisted countries get no music scene (artist query skipped), no diaspora hubs.
- Film and Music planner prompts use Lagos-flavoured examples ("MTN", "Bolt").
- "For example" hints in the `minimum` blocks lean Nigerian.

Group 4, conventions that are labelled and acceptable: budget bands, calendar beats, pace curves, tier slots, channel order, brand categories, partner kinds in `packages/packs/src/rules/`. No taste claim, versioned, sourced.

## Decided direction

Make the description the primary input; comps become one output of it.

1. Reader stays quote-checked. It extracts only what the person wrote (title, genre, cities, named comps). It stops proposing comps.
2. Analyst gains two outputs, both from the person's description:
   - The readers: who they likely are, age bands, life stage, what they already consume, one-line reason.
   - Proposed comps: 3 to 5 titles for those readers, each with a reason. Replaces `suggestedComps`. Also proposes screen titles for books.
3. Code checks the proposals: exact-name resolve in Qloo, not the title itself, right entity type, count capped. Named comps still lead.
4. No model key, or nothing resolves: use the existing Qloo genre-tag lookup (`findGenreComps`). If that is empty too, ask. Delete all `FALLBACK_COMPS` and `SCREEN_CANDIDATES`.
5. Bare brief: if the person's words give no description, genre, comps, place or country, ask once for what it is and where they are or want to launch. Nothing is assumed. Delete `typical` and the Nigeria default. Check uses the person's words only, not model proposals (with a key the model would always propose something, which is why the current check rarely fires).
6. Provenance: comps the model chose are labelled in the plan body with the reason each was picked. Confidence on lines built on them is capped at medium; at lower for the genre-lookup comps. Wire the unused `standIn` input, or pass the comp source into confidence.
7. Determinism: store the readers and chosen comps with the project; reruns and what-ifs reuse them.

Not in this change: baselines (Group 2) and the Nigeria-flavoured examples (a quick tidy that can be folded in).

## What it touches

Behaviour:

- A bare brief now gets a question instead of a plan. Tests that assert "plans as a typical launch" need rewriting: film/pipeline.spec.ts:115, books/pipeline.spec.ts:262, games/pipeline.spec.ts:287, podcasts/pipeline.spec.ts:249.
- Tests for `fallbackComps`, `FALLBACK_COMPS`, `screenCandidates` go: books, games, podcasts `modules.test.ts`; books/planner.spec.ts:78 expects Bridgerton by default.
- Reader prompts that say "even for a one-line brief" propose comps: books/read.ts:229, games/read.ts:197, podcasts/read.ts:229; film, music, shows read.ts have the same clause.
- Pipeline: remove the `bare` block, `assumedLabel` and its intro text (pipeline.ts:721-745, 918); add the ask. Order matters: Film, Music and Live shows already ask for one city (`minimum.missing`), so the bare check must come first and fold both into one card.
- `launch/review.ts:78` mentions "a typical launch".

Schema:

- The analysis output and the stored plan inputs gain a readers-and-comps field.

Docs to change with the code (hard rule 8): `docs/product/spec.md` §3.2, §4.3 to §4.5, §5.1; `docs/categories/{books,games,podcasts,film,music}.md` (thin input, fallback comps, "Which books stand in", "Which series and films the bridge scores by default"); `docs/backend/launch-runtime.md`.

Web:

- The plan body needs a short note showing the chosen comps and why. Cannot be checked against the prototype from here.

## Decisions still open

1. Where comps come from: extend the analyst (recommended, no extra call) or add a separate third model call.
2. What counts as bare: no description, genre, comps, place or country. Under that rule "my film in Lagos" proceeds, then stops with the existing "tell me what it's about" message rather than the card. Alternative: ask whenever the description is missing.
3. Confidence caps: medium for model-chosen comps, lower for genre-lookup comps. Confirm.
4. Baselines: separate change, agreed?

## Test inputs for when this is built

Run the same launch at each rung and check confidence drops as input thins, the plan says what it rests on, and the audience verdict changes only when the comps do:

1. One sentence, no comps, no place.
2. Genre and one city, no comps.
3. One comp.
4. Aspirational comps (Gone Girl, Black Panther).
5. Vibe comps ("X meets Y", "sounds like Burna Boy").
6. Wrong-type comps (a film as the comp for a book).
7. A pasted deck or plan.

Also run the "how to be a man" brief with a model key and with no key.
