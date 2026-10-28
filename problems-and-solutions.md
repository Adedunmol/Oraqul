# Oraqul: problems and proposed solutions

Working note, not product docs. It combines `description-first-plan.md` (our review of comps and hardcoded data) and `qa-root-cause-report.md` (the root causes behind the teammate's QA results). Nothing here has been built or changed.

## How to read this

- **Confirmed**: I read the code and it does what the note says.
- **Likely**: the code allows it and the symptom fits, but I did not have the saved plan to prove it. The check to run is named.
- **Judgement**: my recommendation, not a fact.
- Sizes (small, medium, large) are my rough judgement, not estimates from a plan.

## The short version

The problems fall into five groups.

| Group | What is wrong | Why it matters |
|---|---|---|
| A. The claim check | Names and sentences are not really checked against the findings they cite | The product's main promise is that every claim is checked |
| B. Real-world facts | Brands, podcasts, series and events can be wrong, foreign or already over | A team could pitch a partner that does not exist in that city |
| C. Consistency | The same brief gives different numbers and findings | "Same brief, same findings" is a stated claim |
| D. Comps and description | Comps drive everything, the model's own comps are unlabelled and count as full evidence, and hardcoded lists stand in for understanding | Most real users do not give comps |
| E. Thin input | A bare brief becomes a Nigerian film; non-Nigerian and one-city briefs get less | The users we most expect are the ones served worst |
| G. Presentation | When something is not found or tested, the plan either changes course silently or the message states a bare failure | The agent looks limited, or hides that it used a substitute |

Two further smaller items: the export hides information the screen shows, and three docs disagree about comp reporting.

Recommended order: A first, then B, then C, D and E together as one change, then the small items. Reasons are at the end.

---

## A. The claim check

### A1. Names are only checked if the model declares them or a finding holds them

**What happened (QA case 2, also 1 and 3):** grounded lines carried names that were in none of the cited findings: Yaba and Ojo, Clark Atlanta University, Georgia State University, King's College London, "Books & Writers". Each sat next to a valid citation, so it read as measured.

**Why (confirmed):** `apps/api/src/agent/launch/check.ts:220-224` checks `line.names`, which the model writes itself, plus any name that already appears in a finding of the run. The code comment says other names are "launch knowledge". A university the model adds from memory is never tested. Playbook lines may name anything (check.ts:200-201).

**Proposed solution (judgement):**
- A grounded line may name only things found in the findings it cites, in the brief, or in a web page it cites. A place or organisation name that is not in any of these is not allowed in a grounded line.
- If the writer wants to mention such a name, it goes in a separate playbook line, which is labelled and cites nothing.
- Known distributors, regulators and the like (NFVCB, FilmOne) belong in playbook lines.

**Risk:** this will drop more lines. `docs/product/principles.md` already records that a strict check once made the model write filler. Tune it on the golden runs and re-read what it drops.
**Size:** medium.

### A2. Nothing checks that a sentence is supported by what it cites

**What happened (case 2):**
- "Buy crime and prestige-drama inventory" cites a finding that only ranks cities.
- "The story will leak fast" cites NFVCB and distributor findings.
- "Open Lagos first" cites a finding that ranks Atlanta first.
- The male 25 to 34 line cites findings about the whole audience.

**Why (confirmed):**
- A playbook line that carries a citation is automatically treated as grounded (check.ts:93-97).
- After that, the only tests are names, money figures, stray numbers and a percent sign (check.ts:226-258).
- Numbers are checked against every number in every finding of the run, not only the cited ones (check.ts:239-246).
- The red team compares the draft with the request, not the lines with their citations (spec §3.3).

**Proposed solution (judgement):**
- Add a support check on each grounded line: a model is shown the line and only the cited findings' text, and answers supported, partly or not. This is a verification. It does not set a number, so it fits hard rule 1. It can still be wrong, so unsupported lines should be sent back to the writer, not trusted blindly.
- Add a code check where code can do it: a line that states an order or direction for cities must match the territory calls code computed.
- Tighten the number rule to the cited findings, with the whole-run exception only for ages, as the comment intends.

**Size:** medium to large (a new model step, its cost per plan, and its tuning).

### A3. Taste claims in uncited lines are caught by a keyword list, and auto-citing needs an exact text match

**What happened (case 3, book plan):** "choose New York first… because the strongest market", "themes that will matter most to readers" and "hooks that keep groups talking" passed as playbook. Between The Covers, John Sandoe and Word On The Water appeared with no citation although a finding had returned them.

**Why:**
- Confirmed: a playbook line fails only if it matches `TASTE_CLAIM` (`packages/packs/src/launch.ts:57-58`): fans, loves, likes, prefers, resonates, affinity, skews, popular with, and a few more. The phrases above are not in it.
- Likely: names are auto-cited by a case-sensitive whole-name match (check.ts:164-166), so a different case or a bracket suffix on a Qloo name would miss. Check: compare the entity strings in the book-shop and podcast findings with the plan text.

**Proposed solution (judgement):**
- An uncited line may not rank, compare or characterise an audience or a market. Widen the pattern (strongest, weakest, best market, matter most, will respond) and use A2's support check as the backstop, since a keyword list is never complete.
- Make auto-citing case-insensitive and ignore a bracket suffix.

**Size:** small.

---

## B. Real-world facts

### B1. A brand's "market" is where Qloo ranked it, not where it operates

**What happened (case 1):** Aqua Hydrate labelled Nigeria (the match is a US brand), VOXI labelled United States (it is Vodafone UK's brand), Lonestarcell MTN and Cell C labelled Ghana (Liberian and South African operators), Flow and Digicel Jamaica pitched for Atlanta, Fayrouz and Dano Nigeria pitched in Accra.

**Why:**
- Confirmed: Qloo ranks brands by taste for a city. Its own doc says a brand found by category "says nothing about whether it operates in the market" (`docs/backend/qloo.md:216`).
- Confirmed: the partner's market is the ranked city's country, else the seed's market, else the home country (`apps/api/src/agent/launch/partners.ts:409`). `docs/product/partnerships.md` states this on purpose.
- Confirmed: the Wikidata check can remove a brand that no longer exists, or set the country Wikidata gives. It takes the first search hit that reads like a business and never tests that it is the same brand (`apps/api/src/verify/brand-check.ts`). A brand it cannot place stays with the ranked-city label (`pipeline.ts:1833-1838`).
- Confirmed: the pool has two sources. The model proposes brands "that operate in that city", which is never checked. Qloo also finds brands by category and city, and those can be global or foreign.
- Likely: VOXI's "United States" is a wrong Wikidata match. Check: `check.country` for VOXI in the stored plan.

**Proposed solution (judgement):**
- A brand that is not verified shows no market. It reads as "a taste fit in {city}, not checked for operating there".
- A brand found only by Qloo's category lookup is not presented as a local partner until it is verified in that country. Until then it sits in a "taste fit, unchecked" group.
- Match Wikidata by name, not by first business-like hit.
- The model's "operates there" claim needs a check or an "unchecked" label.

**Decision needed:** how to verify operation. I know of no verified source for this. Web search on each shortlisted brand and city is possible (cost, and it only runs when the provider supports it). Say plainly in the plan when a brand is unchecked.
**Size:** medium.

### B2. Nothing checks whether a named thing is still open, still airing or already over

**What happened (case 1 music):** Mogul (ended in 2021), For Life (ended), Davido & Friends Festival (already held), Golden Palace and Chic Restaurant (not found), Club Ellery's (reports conflict), Sugarpova (inactive). Curzon Mayfair's status is unconfirmed.

**Why (confirmed):** the only non-brand check is OpenStreetMap for cinemas (`apps/api/src/verify/venue-check.ts`), and it asks whether a place is a screen venue, not whether it is open. Podcasts, series, universities, clubs, festivals and events have no check. Qloo carries no operating status. Likely: a web-found event with a past date is not filtered. I found no such filter in `launch/research.ts`. Check: the web source for the festival line.

**Decided:** we have no reliable way to check whether a podcast, series, club or festival is still running, so the plan says so, in the register of section G: "Listed for this audience. Worth confirming it is still active before you pitch." No status check is built.

**Still to build:**
- Drop web-found events whose date is before the plan date. This is a small code change, and it needs no outside source.
- The wording of the label, and where it shows (plan body, Evidence tab, export).

**Size:** small.

---

## C. Consistency

### C1. The same brief changes upstream of Qloo, and lift depends on which cities are in the call

**What happened (case 4):** audience strength was 0.87, 0.82, 1.18 in runs 1 and 3 and 0.73, 0.69, 1.03 in run 2. Lagos and Atlanta areas, the brand rankings and the Atlanta brands differed. Run 2's Partners section contradicted itself.

**Why:**
- Confirmed: several model steps choose what Qloo is asked and none is pinned: the planner's `worthALook`, `brandCandidates` and `areas` (`apps/api/src/agent/film/planner.ts:153-155, 220-221`), the research check's extra queries (`launch/research-loop.ts`), and the reader's comp proposals.
- Confirmed: a city's lift is its mean affinity over the mean of every ranked city in the same call (`packages/engine/src/tools/rank-places.ts:162`, spec §5.2). That call includes the model's chosen Worth a look cities, so a different extra city changes the denominator and rescales every number.
- Likely: this explains run 2. Its numbers are run 1's times about 0.84, 0.84 and 0.87, close to a uniform rescale. Check: the markets call's city list on the Evidence tab for runs 1 and 2.
- Confirmed: Qloo calls are not cached across runs, only name lookups are (14 days). The writer runs at temperature 0.4 by design (`launch/writer.ts:21`).

**Proposed solution (judgement):**
- Store the planner's choices (extra cities, areas, brand pool, research picks) and the chosen comps with the project, and reuse them on a rerun and in a what-if. For a new project with the same brief text, reuse them too (keyed on normalised text, category and rule version), with an expiry.
- Compute place lift against a fixed reference set so a model-chosen extra city cannot rescale the team's numbers. One option is the team's own cities plus a fixed list.
- Change the claim to what is true. Qloo itself can change between calls and I cannot control that, so the promise is "same questions", not "same answers".

**Caveat:** the Sources list only shows cited findings, so a finding missing from it is not proof it was not run. Compare the Evidence tab.
**Size:** medium to large.

### C2. "Avoid" means below the average of the cities compared, and prose can contradict it

**What happened (cases 1 risks and 2):** Lagos "Avoid" while the brief and bottom line open Lagos first; London and Atlanta "Avoid" but still tour stops; "Lagos first" cites a finding that ranks Atlanta first.

**Why (confirmed):** "Avoid" is lift below 1.0 against the mean of the cities in the call (C1). A team's choice is kept as a constraint ("keep it, open it after Atlanta"). The writer follows the team's route in prose. No check reconciles the writer's order with the territory order code computed. `principles.md` already says a low reading is not a weak market.

**Proposed solution (judgement):**
- A code check that a line stating a city order must match the territory calls, or say it is the team's own choice.
- Reword the verdict for a team-chosen city: "comes second to Atlanta for this audience; keep it, open after Atlanta", not "Avoid".

**Size:** small to medium.

---

## D. Comps and the description

How the code works today: Oraqul describes a launch by anchors, which are comps looked up in Qloo. Audience, cities, partners, rival overlap and the confidence checks are all computed from them. If fewer than three comps are named, the model proposes more, up to four. If nothing resolves, a Qloo genre-tag lookup runs. If that fails, the run stops and asks.

Real users mostly describe the launch in their own words and give few or no comps (research, and our own reasoning, both point that way). The example we used was "I just wrote a book, 'how to be a man', about motivation… I don't know where to launch".

### D1. The description does not drive the comps

**Why (confirmed):**
- The reader proposes comps before the analyst runs (`launch/pipeline.ts:660-690`). The analyst's inferences (genre, country, ages) fill fields afterwards and never affect the comps.
- The comp request is one clause inside a long extraction prompt (for example `books/read.ts:229`). Nothing makes the model first work out who the readers are, and nothing checks the picks fit the subject.

### D2. Hardcoded lists stand in for understanding

**Why (confirmed):**
- Books, Games and Podcasts each have `FALLBACK_COMPS` (`packages/packs/src/{books,games,podcasts}/catalog.ts`). They fire only when the model proposes none, so mostly with no model key. For the "how to be a man" brief the books list falls through to a novels catch-all (Where the Crawdads Sing, Educated, Gone Girl, Normal People). Film, Music and Live shows have no such list, so the categories are inconsistent.
- `SCREEN_CANDIDATES` (books) are default screen titles for the adaptation bridge. The model can add titles; these are the defaults.
- `BASELINE_*` (`packages/packs/src/launch.ts:87-89`) are US mass-market names (Coca-Cola, Nike, McDonald's, Joe Rogan, Atomic Habits) that a partner's fit is scored against.
- `GENRE_PHRASES` and `PODCAST_GENRES` map keywords to a tag, and a genre not listed gets none.

### D3. The model's comps count as full evidence and are not labelled

**What happened (cases 5 and 6):** FILM-THIN shows three comps where the team named one, called "your comps". The debut book's findings say "your book's readers". Crescent City is in Positioning in one run and not the next.

**Why:**
- Confirmed: added comps have `source: 'added'`, but confidence counts anchors with data and never looks at the source (`packages/engine/src/confidence.ts`). The `standIn` input exists and no caller passes it, so spec §5.1's "stand-ins are lower" is not implemented. A one-line brief can read "high: 4 anchors with data".
- Confirmed: Film's findings say "your comps' audience" for every anchor (`film/findings.ts:50`). Books hardcodes "your book's readers" (`books/findings.ts:66`).
- Confirmed: the web plan does show which comps matched, the same-name choice sentence, not-found comps and "Planned against X, Y" (`apps/web/src/app/_workspace/output/plan-document.tsx:327-352`). The export has no reference to comps at all (`apps/api/src/outputs/export.ts`). The teammate tested the export.
- Likely: Elephant, Wonder Woman and Crescent City were model-added. Check: the comp list on the Evidence tab shows the source.

### Proposed solution for D (judgement)

Make the description the primary input; comps become one output of it.

1. **Reader** stays quote-checked and stops proposing comps.
2. **Analyst** gains two outputs from the description: who the readers likely are (age bands, life stage, what they already consume, one-line reason) and 3 to 5 proposed comps for them, each with a reason. It also proposes screen titles for books.
3. **Code** checks the proposals: exact-name resolve in Qloo, not the title itself, right entity type, count capped. Named comps still lead.
4. **No model, or nothing resolves:** use the existing Qloo genre-tag lookup, then ask. Delete all `FALLBACK_COMPS` and `SCREEN_CANDIDATES`.
5. **Provenance:** model-chosen comps are labelled in the plan body with the reason for each; findings say "the comps we chose" where they apply; confidence on lines built on them is capped at medium, and at lower for genre-lookup comps. Wire the unused `standIn` input.
6. **Pin:** store the readers and the chosen comps with the project (also C1).
7. **Baselines:** separate change, see below.

**Size:** large. This is the "one feature end to end" PR the repo asks for, and it needs a web change for the provenance note.

**Baselines (not in the change above):** the partner brief's fit ("likes X more than the biggest mass-market names", lift 1.2 is fit 50) rests on the baseline. Replacing it changes what the verdict means and needs a live Qloo check (hard rule 3). Recommended as its own change. One option is the brands in the plan's own ranked pool as the baseline.

---

## E. Thin and non-Nigeria input

### E1. A bare brief is planned as a typical Nigerian launch

**Why (confirmed):** `typical` in each category config. A brief with no description, comps or genre is planned as: Film, a Nollywood drama in Nigeria; Music, afrobeats in Nigeria; Live shows, comedy in Nigeria; Books, literary fiction; Podcasts, an interview show; Games, an action game. It is said in the plan, but it is a heavy default.

**Proposed solution (you decided this):** delete `typical`. If the person's words give no description, genre, comps, place or country, ask once for what it is and where they are or want to launch, and say the brief is too thin to plan from without guessing. The check uses the person's own words only, not the model's proposals. With a key the model proposes something for any brief, which is why today's check rarely fires.

**Touches:**
- Tests that assert "plans as a typical launch" must be rewritten (`film/pipeline.spec.ts:115`, `books/pipeline.spec.ts:262`, `games/pipeline.spec.ts:287`, `podcasts/pipeline.spec.ts:249`).
- Film, Music and Live shows already ask for one city, so the bare check goes first and one card asks for both.
- `launch/review.ts:78` mentions a typical launch.

**Size:** small to medium.

### E2. Non-table cities and one-city briefs get less

**What happened (case 5, Kerala):** no area result and no Worth a look for Kochi, "strongest among your cities" said of one city, and a 40 percent paid share with no budget.

**Why (confirmed):**
- Worth a look uses `citiesNear` (`packages/engine/src/places.ts:191-197`), which needs a table city with a region. A city outside the 32-city table has no neighbours.
- Neighbourhoods come only from the model, and the planner prompt's examples are Peckham, Croydon, Thamesmead, Sugar Land, Alief, Stonecrest and Lithonia (`film/planner.ts:153`), which suits the Nigerian diaspora and gives nothing for Kerala.
- No rule drops "strongest" for a single city.
- The budget split is a fixed convention written even with no budget.

**Proposed solution (judgement):**
- Find Worth a look candidates for non-table cities from Qloo places in the same country.
- With one city, state the reading without a comparison word.
- Use neutral examples in planner prompts and in the "For example" hints.
- Write the budget split only when there is a budget or a band.

**Size:** small to medium.

---

## F. Smaller items

- **Export gap:** put the comps block, same-name choices, not-found comps and the gaps list into the Markdown, Word and PDF exports. Small. Confidence in the export is a design decision, because the docs say the export leaves some parts out on purpose.
- **Docs disagree on comp reporting:** `docs/backend/launch-runtime.md:51` (state a match only on a substitution), `docs/product/principles.md:62` (say which same-name title was chosen) and the spec's `resolveBundle` row (say what happened to every named comp). Decide one behaviour and update the others when the code changes. Small.
- **Calendar and paid-ads notes:** every plan has the 80/20 paid ads note without a recorded source, and the calendar caveat omits the publisher that `launch-rules.md:32` requires. Small.

---

## G. How the agent presents what it could not find or test

### The principle (yours)

When Oraqul cannot find or test something, it should not read as limited or incapable. It should say what it did find, offer the closest suggestions, and ask for what would help it get closer. Example register: "We did not find the exact one, but these are close." Only a real block (a service down, a refused request) is stated as a block, and even then with what to do next.

### What the code does today (confirmed)

1. **The prompts contradict each other.**
   - The shared prompt says "If a tool could not test something, say so on that line" (`packages/packs/src/base-prompt.ts:9`).
   - The Film writer says "Never describe what could not be measured… Where the data says little about a city, plan it around community, partner and diaspora moves, without saying why" (`apps/api/src/agent/film/writer.ts:47`).
   - The red team is told "Do not ask the draft to describe what could not be measured" (`launch/review.ts:76`).
   - The line check drops any line with "could not be tested/ranked/measured", "not enough data", "limited data" or "low confidence" (`check.ts` JARGON), and spec §6.2 "Plain words" bans "talk of what could not be measured".
   - Result: the plan silently changes course. That is a different problem from sounding limited: the reader is never told that a substitute was used. It is also what the QA cases caught as silence (Kochi with no area result and no Worth a look; a debut never said to be planned from comps).
2. **Dead-end wording sits in the system messages.** Examples, each stating a failure with no next step:
   - "Qloo did not score any of the rivals, so no date could be checked." (`follow-ups.ts:382`)
   - "Too few baseline names were found in Qloo to score this partner against." (`follow-ups.ts:526`, internal wording)
   - "Qloo did not score X for this audience, so no fit could be measured." (`follow-ups.ts:540`)
   - "The Qloo allowance for now is used up, so I could not check what changed. Try again later." (`refresh.ts:155`)
   - The Gaps reasons ("Qloo did not score it for this audience") across the category findings files.
3. **The good pattern exists in four places, but not as a rule.**
   - A query that returns nothing is asked wider, and says so: "nothing came back as asked, so this asks…" (`launch/findings.ts:411`).
   - A comp with no exact match is replaced by the closest title, with a sentence saying so (`pipeline.ts:1481`).
   - Worth a look gives alternative cities.
   - An audit offers alternatives that rank above a weak partner.
   - `noCompsStop` ends on a next step ("Tell me what it is about and its genre").
4. **The spec already asks for this.** PRD E3: gaps are stated "with what the agent did next and what input would change the answer". The implementation drifted to silence in the plan and bare failure in the messages.

### The shape of every thin spot

Three parts, in this order:
1. **What we found or used**, labelled as close, not exact.
2. **What the plan does with it** (the move).
3. **What would sharpen it**, as a question or an offer, not an apology.

### Guardrails, so this is helpful and not bluff

1. A closest match is always labelled as close. Its numbers are never presented as the original's.
2. A verdict stays computed by code. A closest reading can never turn "could not test" into "holds" for the exact thing. The exact thing stays untested; the suggestion sits beside it.
3. A suggestion must come from a finding (cited) or be a labelled playbook line. The model does not invent "close alternatives". This is the same rule as A1.
4. The tone must not raise certainty. Confidence stays honest on the Evidence tab and in the assumptions. Friendly wording never changes a verdict or a confidence.
5. The detail remains available. The plan body is welcoming; Assumptions and Evidence still say exactly what was and was not tested.
6. A real block is said once, plainly, with a next step: what happened, what we kept, what the person can do. No jargon, no blame on a tool.

### Wording by situation

| Situation | Today | Proposed register |
|---|---|---|
| Comp not matched | "Not found in Qloo, so left out" | "We could not match 'X' exactly, so we used 'Y', the closest title we have. Tell us if you meant another." |
| Debut or unknown title | silence, or "your book's readers" | "Your book is new, so this is built from comps we chose: X, Y, Z. Name your own and we will swap them in." |
| City cannot be ranked | silent change of course | "We could not rank Kochi against other cities. The plan leans on community and partner moves there. If you tell us where your audience gathers, we can sharpen it." |
| Brand not ranked | "not ranked" | "'Verve' did not come up for this audience. The closest fits are A and B. Want us to check another brand?" |
| Name from Qloo, status unknown (B2, your decision) | no label | "Listed for this audience. Worth confirming it is still active before you pitch." |
| Brand not verified in a city (B1) | wrong country label | "A taste fit in {city}. Worth confirming it operates there before you pitch." |
| Rival not found | "so no date could be checked" | "We could not find a confirmed date for X. Send the date you have and we will check the overlap." |
| Qloo down or allowance used | "Try again later" | "The audience data is not answering right now. Your brief is saved. Try again in a few minutes, or I can write a playbook-only plan now, clearly marked as unmeasured." |
| Forecast asked | "I can't forecast…" | Lead with what we can do: "I can show who the plan reaches and where. A sales number needs your own tracking figures." |
| Bare brief (E1) | typical Nigerian launch | A welcoming question: what it is, and where you are or want to launch. |

### Where it would go

| Place | Change |
|---|---|
| Spec §6.2 "Plain words", PRD E1, U4 | Replace "no talk of what could not be measured" with: no "could not/no data/limited" wording; a closest suggestion with a next step is required. Update with the code (hard rule 8). |
| Gap schema | A gap carries `closest` (a finding id, optional) and `ask` (a question or an offer) beside `why`. Code builds "To sharpen this plan" from them. |
| Code-written lines | For substitutions code already knows (closest comp, nearby city, alternative brands), code writes the "closest" line, as it does for opportunities and Worth a look. No model wording, so it is checked and consistent. |
| Final writer prompts (per category) | Replace "without saying why" with the three-part shape, and the guardrails above. The line check's word list must allow the new phrasing. |
| Red team (`review.ts`) | A new issue kind, `dead-end`: a thin spot with no suggestion or question. A second, `overclaim`: a substitute presented as exact. The first is not blocking unless the person is left with nothing to do. The second is blocking. |
| System messages | One helper, `blocked(what, kept, next)`, used by every follow-up and stop message. |
| UI | "Could not test" stays the verdict word (PRD U4, hard rule 4), paired with a nudge ("Add X to test"). Renaming it is a decision below. |

### Risks

- A friendly register can read as more certain than the evidence. Guardrails 2 and 4 are there to prevent it. This needs a QA case that checks the verdict and confidence did not change.
- Code-written "closest" lines will repeat. Keep them short and group them.
- The writer may use the new freedom to pad. Keep the existing rules: each line one move, said once.
- The line check will need re-reading against real runs after the word list changes (`principles.md` lesson).

### Three different situations, kept apart

| Situation | Meaning | What the person sees |
|---|---|---|
| Qloo not answering | Timeout, error, or the call allowance used up | The run stops. One plain sentence, the brief is kept, try again shortly. No plan is written without Qloo. |
| Qloo answered with no match | A name it does not know, a city with too little data, a brand it did not rank | Not "down". The closest-suggestion register above. |
| Some calls fail during a run | The rest of the plan is built | The failed part is shown as retryable: "I could not fill this in this time. Run it again to add it." |

Qloo being down is not the same as Qloo not finding something, and the wording must never mix them up.

### Decisions for G (settled)

1. **Verdict wording: use both, by situation.** The stored verdict stays "could not test" (PRD U4, hard rule 4). The label the person sees depends on why:
   - Needed something the person has not given (a window, an age band): "Not tested yet. Add X to test."
   - Qloo answered with no signal for it: "No exact read. Closest: Y."
   - The call failed: "Could not check this time. Run again."
   This needs one new field beside the verdict that says which of the three it is. Today the reason is free text (`why`), so code cannot tell them apart.
2. **When Qloo is not answering, Oraqul does not produce a plan.** No playbook-only plan. It stops, keeps the brief, and says to try again shortly.
3. **Red team, `dead-end`: settled. A dead end never ships.** There is no place where "not found" can be the last word.
   - **Prevent at the source:** every gap carries a required `closest` or `ask` beside `why`, so code cannot create a gap with no way forward. The same holds for stop messages and verdict labels.
   - **Backstop in the red team:** `dead-end` always blocks, in every section, and sends the draft back to the writer.
   - **If the third draft still has one,** code attaches a generic "closest we have, plus a question" line. It never ships the dead end.
   - The `overclaim` issue (a substitute presented as exact) also always blocks.
   - The only exception is a real block (Qloo not answering), which stops the run with a next step.

**What the red team is.** After the writer drafts a plan, a separate model step, the red team, reads the draft against the request and lists issues. A blocking issue sends the draft back to the writer for a rewrite, up to three drafts. A `dead-end` is a draft that says something was not found and gives no suggestion and no question, for example "Kochi has no area read" with nothing after it.

**Cost:** some extra rewrites, each a model call, while the writer learns the new wording. Preventing dead ends in code first keeps this low.

---

## What this does not fix

- Qloo's own data. It has no operating status and no sales data, and its answers can vary between calls.
- Real-world facts the model gets wrong in playbook lines (for example EbonyLife Place London opening in October 2026, which the plan missed). A playbook line may name anything real, and nothing verifies it. A1 reduces this for grounded lines only.
- Whether the plan is better than a chatbot's. That is a human score on "true" and "knows the audience" (`docs/backend/launch-runtime.md`).

## Recommended order

| Step | Fixes | Why now |
|---|---|---|
| 1 | A1, A2, A3 | It undercuts the central claim. It is independent of everything else and does not change the schema. |
| 2 | B1, B2 | A wrong partner or a dead entity in a plan is the most visible failure to a user. Needs the verification-source decision first. |
| 3 | D, C1 and E together | One end-to-end change: understanding the description, provenance, pinning, bare-brief question, non-table cities. Includes the web note and doc updates. |
| 3b | G | The presentation rule shapes the wording of B1, B2, D and E1, so agree it before those are written. The spec and prompt changes are small; the gap schema and the code-written "closest" lines go with step 3. |
| 4 | C2, F | Small, can ride with step 1 or 3. |
| 5 | Baselines | Own change; needs a live Qloo check. |

## Decisions I need from you

1. **A2:** a model support check on each grounded line (cost per plan, can err), or code checks only?
2. **B1:** how to verify that a brand operates in a city. Web search per cited brand, or label it unchecked? (B2 is settled: say we do not know if it is still running.)
3. **D:** extend the existing analyst (my recommendation, no extra call), or add a separate model call for readers and comps?
4. **E1:** what counts as bare. Under "no description, genre, comps, place or country", "my film in Lagos" proceeds and stops later with the existing "tell me what it's about" message. Or ask whenever the description is missing?
5. **D3:** confirm medium as the cap for model-chosen comps and lower for genre-lookup comps.
6. **F:** should the export show confidence and gaps, or keep leaving them out?

## About the QA set itself

Some failures were test artifacts, not product defects, and the next pass should correct them first:
- **Case 5** assumed a one-comp plan, but the product fills to four. It also used a title ("sweet life") not confirmed absent from Qloo, and relied on confidence the export hides.
- **Cases 5 and 6** were read from the export. The screen shows what the tester reported missing.
- **Case 4** compared Sources, not the Evidence tab.
- **Cases 10 and 12** use structured input lines (`Who is launching:`, `Rivals: … on date`) that real users do not write. Case 12 also has no release date and needs a web-search provider.
- **Case 20** is a user study, not an output-quality case.
- **Cases 8, 16 and 18** bundle several experiments.
- **Missing:** nothing covers launch watch, actuals and pace, rescue, funding, the campaign checklist, mobile, or the no-model-key path. The reference briefs are all at the maximum input.

Cases 1 to 4 found real defects, all confirmed in code above.
