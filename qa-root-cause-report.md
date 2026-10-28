# QA root-cause report

Working note, not product docs. Nothing in it has been fixed.

Source: the teammate's results for QA cases 1 to 6 (film FILM-NG, music MUSIC-AFRO, book BOOK-ROMANTASY, film FILM-THIN).

How to read this:
- **Confirmed** means I read the code and it does what the line says.
- **Likely** means the code allows it and the symptom fits, but I did not have the saved plan to prove it. The "How to confirm" line says what to open.
- I did not re-check the teammate's real-world facts (a brand's country, a closure). I take them as reported.

## Result by case

| Case | Verdict | Root causes |
|---|---|---|
| 1 Beats a chatbot (film, music) | FAIL S1 | RC4, RC5 |
| 2 Citations match the claim | FAIL S1 | RC1, RC2 |
| 3 Playbook lines stay playbook | FAIL (film, book) | RC3, RC1 |
| 4 Same brief, same findings | FAIL S1 | RC6 |
| 5 Unknown title / thin data admitted | FAIL S1 | RC7, RC8 |
| 6 Wrong entity match | FAIL on pass condition | RC7, RC9 (docs) |
| Risks listed under case 1 | S2 | RC10 |

---

## RC1. The line check only verifies names the model declares or that a finding already holds

**Cases:** 2 (Yaba, Ojo, Clark Atlanta University, Georgia State University, King's College London), 1 (Clark Atlanta), 3 ("Books & Writers").

**What the code does** (`apps/api/src/agent/launch/check.ts`):
- For a grounded line, the names checked are `line.names` (the list the model itself writes) plus any name that appears in this run's findings dictionary (check.ts:222-224).
- The code comment says it on purpose: "Other names in the text (a distributor, a regulator) are launch knowledge" (check.ts:220-221).
- So a university or neighbourhood the model adds from its own memory is never checked, as long as it is not in any finding and the model did not list it in `names`. The line still carries a valid citation beside it, so it reads as measured.
- Playbook lines may name "anything the model knows" (check.ts:200-201). "Books & Writers" is allowed by design.
- Numbers are checked against every number in every finding of the run, not only the cited ones (check.ts:239-246).

**Why it fails the case:** the product claim is "every name a line cites is in a finding it cites" (PRD E2, spec §6.2). The code enforces that only for names the model volunteers or Qloo returned.

**Status:** confirmed.

---

## RC2. No check that a sentence is supported by the finding it cites

**Cases:** 2 ("buy crime and prestige-drama inventory" cites a ranking of cities; "the story will leak fast" cites NFVCB and distributor findings; "Lagos first" cites a finding that ranks Atlanta first; the male 25 to 34 line cites whole-audience findings).

**What the code does:**
- `citeWhatIsNamed` turns any playbook line that has a citation into a grounded line: "A line that cites findings rests on them, whatever kind the writer gave it" (check.ts:93-97).
- After that the only tests are names, money figures, stray numbers and a percent sign (check.ts:226-258). Nothing compares what the sentence asserts with what the finding says: no direction, no scope (age or sex segment, city), no topic.
- The red team (`launch/review.ts`) compares the draft with the request. It does not compare lines with their citations (spec §3.3).

**Why it fails the case:** a claim only needs a citation and no unknown name to survive.

**Status:** confirmed.

---

## RC3. Taste detection in playbook lines is a keyword list; auto-citing is an exact-text match

**Cases:** 3 (book: "choose New York first… because the strongest market", "themes… that will matter most", "hooks that can keep groups talking"; uncited Between The Covers, John Sandoe, Word On The Water).

**What the code does:**
- A playbook line fails only if it matches `TASTE_CLAIM`: fans, loves, likes, prefers, resonates, affinity, skews, popular with, tastes, enjoys, devoted, and a few more (`packages/packs/src/launch.ts:57-58`). "Strongest market", "matter most" and "keep groups talking" are not in it, so they pass as playbook.
- Names Qloo returned are meant to be auto-cited (`citeWhatIsNamed`, check.ts:99-125). It matches with a case-sensitive, whole-name test (`names`, check.ts:164-166), against the exact string in the finding. A name written in a different case ("Between The Covers" against "Between the Covers"), or a Qloo name with a bracket suffix, will not match, and the line stays uncited.

**Status:** the keyword list is confirmed. The auto-cite mismatch is **likely**.
**How to confirm:** open the finding for the book-shop and podcast queries on the Evidence tab and compare the entity strings with the plan's text.

---

## RC4. Brand "market" is a label from where Qloo ranked it, not where it operates

**Cases:** 1 film (Aqua Hydrate "Nigeria", VOXI "United States"), 1 music (Lonestarcell MTN and Cell C "Ghana", Flow Jamaica "United States", Digicel Jamaica, Fayrouz, Dano Nigeria and Peak Milk pitched in Accra).

**What the code does:**
- Qloo ranks brands by taste for a city. Its own doc says a brand found by category "is a taste fit: it can be global… and says nothing about whether it operates in the market" (`docs/backend/qloo.md:216`).
- The partner's market is the ranked city's country, else the seed's market, else the home country (`apps/api/src/agent/launch/partners.ts:409`). `docs/product/partnerships.md` documents this: "Each option carries the market of the city it was ranked in."
- The Wikidata check (`apps/api/src/verify/brand-check.ts`) can do two things: remove a brand that no longer exists, and replace the market with the country Wikidata gives. It takes the first search hit whose description reads like a business (brand-check.ts BUSINESS and `lookup`) with no test that it is the same brand Qloo meant. A brand it cannot place stays as `unverified` with the ranked-city label (`pipeline.ts:1833-1838`).
- The brand pool comes from two places: brands the model proposes "that operate in that city" (a model claim, never checked), and brands Qloo finds for the audience by category and city (`spec §4.1 brands`). The second is where global and foreign brands such as Cell C and Digicel enter.

**Why it fails the case:** the plan presents "brand X, country Y, Tier B partner for city Z" as a usable lead. Nothing in the code establishes that X operates in Z.

**Status:** confirmed for the label rule and for the missing operating check.
**Likely:** VOXI "United States" is a wrong Wikidata match (the teammate saw London ranking and a US label). **How to confirm:** read `partner.check.country` for VOXI in the stored plan.

---

## RC5. No check that a named thing is still open, still airing, or not already over

**Cases:** 1 music (Mogul, Golden Palace, Chic Restaurant, Club Ellery's, Davido & Friends Festival already held, For Life ended, Sugarpova inactive), 1 film (Curzon Mayfair status).

**What the code does:**
- The only non-brand checks are `venue-check.ts` (OpenStreetMap: is it a screen venue) for cinemas, and the Wikidata brand check. There is no check for podcasts, TV series, universities, clubs, concert halls, festivals or events.
- Qloo lists carry no operating status, so ended shows and closed places come back as normal results.
- I found no filter in `launch/research.ts` that drops a web-found event whose date is before today.

**Status:** confirmed that no such checks exist. The festival date handling is **likely**: **how to confirm:** open the web source for the festival line and see whether it carries a date earlier than the plan date.

---

## RC6. The same brief changes upstream of Qloo, so findings change

**Cases:** 4 (audience strength 0.87/0.82/1.18 in runs 1 and 3, 0.73/0.69/1.03 in run 2; different Lagos and Atlanta areas; different brand rankings; Atlanta brands present in run 2 only; run 2's Partners section contradicts itself).

**What the code does:**
1. Several model steps pick what Qloo is asked, and none is pinned across runs:
   - `worthALook`, `brandCandidates` and `areas` in the query planner (`film/planner.ts:153-155, 220-221`).
   - The research check adds up to three extra queries (`launch/research-loop.ts`).
   - The reader proposes comps when fewer than three are named.
   Temperature is 0 for these, which reduces but does not remove variation between calls.
2. A city's lift is its mean affinity over the mean of every ranked city in the same call (`packages/engine/src/tools/rank-places.ts:162`, spec §5.2). The call includes the model's chosen Worth a look cities. A different extra city changes the denominator and so rescales every city's number.
3. Evidence for 2: run 2's numbers are the run 1 numbers times 0.84, 0.84 and 0.87, close to a uniform rescale. That is what a changed denominator looks like.
4. Qloo calls themselves are not cached across runs. Only name lookups are (`packages/engine/src/qloo/client.ts`, 14 days).
5. The writer runs at temperature 0.4 (`launch/writer.ts:21`), so prose varies by design. That explains the Partners contradiction in run 2 only in part: the section is built from a brand pool that differs per run (item 1).

**Why it fails the case:** the product says "same brief, same questions, same findings" (`docs/product/principles.md`). The plan's own structure makes that false for areas, brands, extra cities and extra research queries.

**Status:** items 1, 2, 4, 5 confirmed. That the rescale in run 2 came from a different extra-city set is **likely**. **How to confirm:** compare the markets call's city list in the Evidence tab of run 1 and run 2.

**Note on Sources:** the teammate's list of findings "present in some runs and not others" is taken from Sources, which shows only cited findings. Compare the Evidence tab before logging those as differences.

---

## RC7. Comps the model added are presented as the team's, and the export hides the labels

**Cases:** 5 (BOOK-ROMANTASY: no line says the debut is planned from comps, wording "your book's readers"; FILM-THIN: three comps shown where the team named one, called "your comps"), 6 (Crescent City in one run and not the other; Lionheart's choice "not stated").

**What the code does:**
1. When fewer than three comps are named, the model's proposals fill to four (`launch/pipeline.ts:1390-1424`, MIN_COMPS 3, FILL_TO 4). They get `source: 'added'`.
2. Findings speak of all anchors as "your comps' audience" (Film, `film/findings.ts:50`). Books hardcodes "your book's readers" even when the anchors are comps (`books/findings.ts:66`), which reads as if Qloo knew the book.
3. Confidence counts anchors with data and ignores `source` (`packages/engine/src/confidence.ts`, `standIn` is never passed by any caller). An added comp counts the same as a named one.
4. The web plan does say it: `plan-document.tsx:327-352` shows "Matched in Qloo: …", the same-name choice sentence ("I used the … one"), "Not found… left out", and "Planned against X, Y. Name your own comparable titles…". The **export does not**: `apps/api/src/outputs/export.ts` has no reference to comps, `choice` or `added`.
5. The teammate checked the export ("I could not check from the export"). So several "never says" findings are true of the export and probably not of the screen.
6. The comps the model proposes can differ between runs (RC6), which fits Crescent City appearing in one run and not another.

**Status:** items 1 to 6 confirmed from code. That Elephant, Wonder Woman and Crescent City were model-added is **likely**. **How to confirm:** the Evidence tab comp list shows `source` per comp.

---

## RC8. Thin and non-Nigeria briefs get less, and what they get is shaped by Nigeria-flavoured defaults

**Cases:** 5 (FILM-THIN: no area result, no Worth a look for Kochi; "strongest" said of the only city; 40 percent paid share with no budget).

**What the code does:**
- Worth a look needs a table city with a region: `citiesNear` (`packages/engine/src/places.ts:191-197`) returns cities in the same region as the team's, from the 32-city table. A city outside the table, such as Kochi, has no region, so there is nothing to show.
- Neighbourhoods come only from the model. The prompt's examples are Peckham, Croydon, Thamesmead, Sugar Land, Alief, Stonecrest, Lithonia (`film/planner.ts:153`). That fits the Nigerian diaspora and gives the model nothing to copy for Kerala.
- With one city, "strongest among your cities" is a sentence with no comparison behind it. No rule says to drop it.
- The Budget split is a fixed convention (`BUDGET_CONVENTION`) and is written even when no budget is given.

**Status:** confirmed.

---

## RC9. Documentation disagrees, so case 6's pass condition can not be met as built

- `docs/backend/launch-runtime.md:51`: the plan states a match only on a substitution, and a not-found comp goes to Gaps (which the export leaves out).
- `docs/product/principles.md:62`: same-name ambiguity is settled in code and "we say which we chose".
- The QA case asks for a status on every comp.
- In code: `choice` is set only for an ambiguous or closest-title match (`pipeline.ts:1469, 1481`). A comp with exactly one exact match gets "Matched in Qloo" in the UI and nothing in the export.

**Status:** confirmed. Decide the target behaviour first, then rewrite the case or the code.

---

## RC10. A territory verdict is relative to a set of cities, and the prose follows the team's plan

**Cases:** 1 risks (Lagos "Avoid" yet the brief opens Lagos first; London and Atlanta "Avoid" yet tour stops), 2 (direction mismatch, "Lagos first" cited to a finding that ranks Atlanta first).

**What the code does:**
- "Avoid" is lift below 1.0, meaning below the mean of the cities in that call (see RC6, item 2), including the model's extra cities. It does not mean the market is bad.
- A team's city is kept as a constraint with a fix ("keep it, open it after Atlanta") (`launch-rules.md` "Direction calls"). The writer follows the team's route in the bottom line.
- No check reconciles the writer's prose with the code-computed territory order.
- `docs/product/principles.md` already warns: "A low reading is not a weak market."

**Status:** confirmed.

---

## Corrections to the teammate's reading

1. **Case 5 and 6 "silence" findings:** the web plan does show comp matching, same-name choices, not-found comps and "planned against" (RC7, item 4). The export does not. Re-test on screen before logging these as plan-body failures, and treat the export gap as its own bug.
2. **Case 6, Lionheart:** a single exact match shows "Matched in Qloo" and no choice text. The choice sentence appears only when Qloo returns more than one exact name (`resolve-bundle.ts:169`). The teammate's assumption that several works share the name should be checked on the Evidence tab.
3. **Case 4:** do not count findings absent from Sources as missing (RC6 note).
4. **Case 3 correction about `decisions.ts:21`:** agree with the teammate. The template line fires only when the writer skips a named comp.

---

## Where the fixes would go (not started)

| Fix | Resolves |
|---|---|
| Check every proper noun in a grounded line against the cited findings, not only declared names; stop auto-promoting cited playbook lines | RC1, RC2 |
| Replace the taste keyword list with a stricter rule: an uncited line may not rank, compare or characterise audiences or markets | RC3 |
| Make the auto-cite name match case- and bracket-insensitive | RC3 |
| Drop the "market = ranked city" label for unverified brands; show them as unverified with no market; require the model's operating claim to be checked or shown as unchecked | RC4 |
| Liveness checks for podcasts, series, events and venues from a source with a status, and drop past-dated events | RC5 |
| Pin planner choices (extra cities, areas, brand pool) per brief and store them; compute lift against a fixed city set | RC6, RC10 |
| Carry comp `source` into confidence and wording; fix the books voice; put the comps block in the export | RC7 |
| Handle cities outside the table and one-city briefs; neutral examples in planner prompts | RC8 |
| Settle the doc conflict on comp-match reporting | RC9 |
