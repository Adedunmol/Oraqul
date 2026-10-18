# How Film planning works

A technical overview, from the first message to a saved plan and its follow ups. Product rules are in the [spec](../product/spec.md): §4.1 the query catalog, §5 the numbers, §6.1 the launch plan, §6.2 the line check. This page is the map.

## The one idea

The film being launched is usually not in Qloo yet. So the agent describes it by its **comps** (comparable titles the audience already watches) and asks Qloo what their audience likes. On its own a comp signal drifts toward what is popular overall. With context (a music scene, a release country, a city, an age band, a year) it gets sharp. So every reply has two stages:

1. **Findings (code).** The model reads the brief and shapes the queries. Code runs them and turns each result into a finding: a sentence built from one call, streamed into the chat as it lands.
2. **The reply (model).** The model writes the plan, or an answer, from the findings and its launch knowledge. Code checks every line: a grounded line must cite findings and match their names and numbers; a playbook line is launch practice and may not claim what an audience likes.

The team's decisions (cities, age band, window) are constraints. The plan is for them; it tests them and reports what it finds, and alternatives go under Worth a look.

## The path of a first message

```
Web composer ──POST /teams/:id/projects──▶ RunService.createProject
                                              │ saves project (status intake) + first chat
                                              │ saves the first message + file text as projects.inputs
                                              ▼
                                         Router (agent/router)        model or scripted
                                              │ reads title, category, mode; asks a card if unsure
                                              ▼
                                         Handoff  ──▶  FilmAgent.run (agent/film/agent.ts)
                                                          │ no plan in this chat yet
                                                          ▼
                                                   runFilmBuild (agent/film/pipeline.ts)
                                                          │ read → comps → pick → ground → write → check
                                                          ▼
                                         RunService saves receipts + output (OutputStore)
                                                          │ emits output.created
                                                          ▼
Web chat (SSE /threads/:id/events) shows the trace with its findings, the message, the output line
Output page reads GET /outputs/:id and opens on the Plan tab
```

The request returns at once; the run goes on in the background and streams events. One run at a time per chat (409 otherwise).

## The pieces

| Piece | File | Job |
|---|---|---|
| Run service | `apps/api/src/agent/run.service.ts` | Starts runs, picks router, gate or agent, resumes a run waiting on a card, saves, streams events |
| Router | `agent/router/` | First message only: title, category, mode. Quote checked |
| Gate | `agent/gate/` | Every later message: on topic, off topic (fixed refusal) or unclear (a card) |
| Handoff | `agent/category-agents.ts` | What the agent gets: title, category, mode, `inputs`, `message`, `recent` (last 8 chat lines), `planId` |
| Film agent | `agent/film/agent.ts` | Build if the chat has no plan; otherwise refuse, or read the follow up and pick its job |
| Brief reader | `agent/film/read.ts` | Model (or scripted) turns the brief into every field it gives, each with the words it came from |
| Researcher | `agent/film/research.ts` | Web search for release timing and the market, facts tied to source pages |
| Query planner | `agent/film/planner.ts` | Model (or the pack's defaults) shapes the catalog queries; code keeps only what the rules allow |
| Findings | `agent/film/findings.ts` | Runs the queries, builds the brief's verdicts, turns each result into a finding and streams it |
| Writer | `agent/film/writer.ts` | Model (or templates) writes the sections, or an answer, from the findings |
| Line check | `agent/film/check.ts` | Every written line against spec §6.2; failures dropped and logged |
| Build pipeline | `agent/film/pipeline.ts` | The steps of a plan, comp settling, "To sharpen" and Budget split, the one question it may ask |
| Brief builder | `agent/film/brief.ts` | Audience segments, the team's cities in order, verdicts on the team's assumptions, one receipt per line |
| Follow-up reader | `agent/film/follow-up.ts` | Reads a later message; code picks the job |
| Follow ups | `agent/film/follow-ups.ts` | Answer (findings, writer, check), rival date check, partner brief |
| Baseline | `agent/film/baseline.ts` | Mass-market names a named partner is scored against, as a confidence aid |
| Engine | `packages/engine` | Qloo client, tools (`findTaste`, `resolveTags`, `themeTags`, `rankPlaces`, …), confidence, verdicts |
| Pack | `packages/packs/src/film` | Prompt, query catalog and defaults (`catalog.ts`), module rules, budget convention, taste words (`modules.ts`) |
| Saving | `agent/output-store.ts` | Receipts and the output (brief, plan, inputs) in one transaction |
| Presenting | `apps/api/src/outputs/present.ts` | Stored output → the `Output` the screens render (tabs, findings in Evidence, changes) |
| Exports | `apps/api/src/outputs/export.ts` | Markdown and Word from the stored plan |

## The build pipeline, step by step

Code sets the steps and their order. Each step is a `trace.step` in the chat.

1. **Using.** Emits `memory.used` (your brief, files read).
2. **Read** (model, quotes checked). The reader returns format, genre, logline, country of origin, language, comps, cities, window, age bands, gender, cast, director, soundtrack, route, budget (the number is read by code from the quote), signed partners, the scope (full or narrow) and the module a narrow ask names. `checkReading` keeps a value only if its quote is in your words; "launch plan", "go-to-market" and the like always make a full plan. If you named fewer than 3 comps, the model proposes more, kept apart.
3. **The one question.** Only when there is no description or genre, or no city at all: one text card. After it, the run plans with what it has.
4. **Find the comps** (`resolveBundle`). Your comps lead; proposals fill to 4 (5 at most). A comp counts on an exact name match. Same-name matches are settled by code: the one from the brief's country, then the best known. The plan states the choice. Not found: listed in Gaps.
5. **Choose what to ask** (`pickModules`, then the query planner). The modules come from the scope and the brief (spec §6.1); the queries from the modules (spec §4.1). The model may change the music scene, brand categories, genres, place kinds and which of your cities each query uses; code keeps only your cities, table cities for Worth a look, and short phrases.
6. **Ask Qloo** (`ground`). The audience and the cities run first, in parallel (one heatmap call over your cities and up to 4 nearby ones, with leave one out). Then every phrase is resolved to a tag in one `resolveTags` run, and the other queries run. Each result becomes a finding, streamed as a `finding` event. A query that fails or returns nothing becomes a Gap; a spent budget stops the rest.
7. **Look up the market** (only when the writer's provider has search). `research.ts` asks the provider's web search about release timing, rivals, distributors and exhibitors, and market numbers for the genre, country and cities, never the title or story, then extracts facts each tied to a source page. A failure writes the plan without it.
8. **Write** (model, or templates with no key). The writer gets the brief, the comps and the findings, and writes every section but "To sharpen" and Budget split, which code writes. `decisions.ts` then makes sure every city and every comp the team named is answered.
9. **Check** (`checkSections`). Every line against spec §6.2. A core section left empty is filled from the templates and checked again.
10. **Save.** The output holds the brief (Audience and Assumptions tabs), the plan, and `inputs` (the reading and the resolved comps, so a what-if can rerun it). Each finding has a receipt with `lineId` = the finding's id, so it opens to its call.

## What decides what

| Decision | Who | Where | How |
|---|---|---|---|
| Category, mode, title | Model, checked | router | Quote must be in your words; else a card |
| Every field of the brief | Model, checked | `film/read.ts` | Quote must be in your words |
| Full plan or narrow ask, and which module | Model, then code | `film/read.ts` | Plan words always mean full |
| Comps to add | Model | `film/read.ts` | Only below 3 of yours; checked in Qloo; kept apart |
| Which same-name title a comp is | Code | `pipeline.ts` `settle` | Country, then popularity |
| Which modules | Code | pack `pickModules` | Spec §6.1 |
| Which queries, and their context | Code, shaped by the model | `planner.ts` | Catalog, team cities, resolved tags |
| Every number, verdict, confidence | Code | `packages/engine`, `film/brief.ts`, `film/findings.ts` | Spec §5 |
| Each finding's sentence | Code | `film/findings.ts` | Templates over what Qloo returned |
| The plan's wording | Model (templates with no key) | `film/writer.ts` | Checked line by line |
| To sharpen, Budget split | Code | `pipeline.ts` | Convention table in the pack |
| Every team city and comp answered, home-market premiere | Code | `film/decisions.ts` | Backstop for what the writer missed |
| Follow-up job | Code, from the model's reading | `film/follow-up.ts` | Rivals with dates → date; "partner" → brief; a change → what-if; else answer |
| Refusals | Code | `REFUSALS` in `packages/packs` | Regex, fixed words, before any call |

## Where the model comes in (and where it never does)

The model is `LLM_MODEL`, role `agent` for Film. It reads the brief, shapes the queries, writes the plan, reads a follow up and writes answers and partner pitches. Every model call has a fallback (scripted reader, the pack's default queries, the template writer), used with no key or when the call fails. A plan records which wrote it (`writer`).

The model **never**: sets a number, verdict or confidence; names an entity that is in neither a finding it cites nor the brief; puts a city or age band the team did not choose in the bottom line; cites a call that does not exist; sees raw Qloo data beyond the findings.

## The numbers (all code, all in spec §5)

| Number | Formula | Bands | File |
|---|---|---|---|
| Place lift | city mean cell affinity ÷ mean of all ranked cities, same call | holds ≥1.2, weak 1.0–1.2, breaks <1.0 | `tools/rank-places.ts`, `verdicts.ts` |
| Audience index | `50 + 50 × affinity`, 0–100, 50 neutral | — | `verdicts.ts` |
| Age verdict | your band vs the top band | holds within 0.05 of top, weak >0, breaks ≤0 | `verdicts.ts` |
| Gender verdict | that gender's affinity | holds >0.05, weak ±0.05, breaks <−0.05 | `verdicts.ts` |
| Comps verdict | city order with each comp left out | holds if unchanged, weak if it rests on one | `verdicts.ts` |
| Lift (partner brief only) | candidate affinity ÷ baseline mean affinity, same call | ≥1.5 strong, 1.2–1.5 usable | `engine/scoring.ts` |
| Rival overlap | rival affinity × 100 | >60 risky, 35–60 moderate, <35 low | `scoring.ts` |
| Budget split | the pack's convention shares, times the budget when one is given | — | `pipeline.ts`, pack `BUDGET_CONVENTION` |

**Confidence** (spec §5.1) is set per call and carried by each finding. A plan's confidence is the lowest of the findings behind its bottom line.

## Follow ups (after the chat has a plan)

`FilmAgent` loads the plan, emits a "Using" line (the plan, your brief, the chat), refuses forecasts, pricing or sending with fixed words, then reads the message and lets code pick the job:

| Job | Trigger | What runs | Saves |
|---|---|---|---|
| Answer | default | The plan's findings, the writer in answer mode, the same line check. If the answer would change a decision it offers a what-if. Plans saved before findings use the older tool loop | Message only |
| What-if | any change to places, comps, ages or gender | The build from the plan's `inputs` with the change; every query reruns | `scenario` output; "What changed" compares plan lines by id; becomes the chat's plan |
| Rival date check | rival titles with YYYY-MM-DD dates | `compareAudiences`: rivals scored against the comps | `date` output |
| Partner brief | "partner" + a name, or the first brand the plan names | An artist the plan's music findings ranked is backed by that finding; a brand or podcast is scored with `lift` against the baseline. The model drafts the pitch from findings, checked; the template is the fallback | `partner` output |

## Data and events

- **Tables** (spec §6): `outputs.plan` holds the launch plan, `outputs.brief` the audience and verdicts, `outputs.inputs` what to rerun from. `receipts` has one row per call or per line, with `lineId` set to a brief line's id or a finding's id.
- **Events** (`threadEventSchema`): `memory.used`, `trace.step`, `finding`, `question`, `receipt`, `message`, `output.created`, `project.updated`, `run.stopped`, `error`. A `finding` is stored as a trace row and folds into the trace item.

## The web side

- The chat (`_workspace/chat/live-chat.tsx`) shows each finding under the running trace, the latest three while it runs and all of them in the folded trace.
- The output page opens on the first tab the API lists: Plan for a launch plan (`tabs-plan.tsx`). What a line rests on is a quiet number that opens the finding; call ids show only in the receipt drawer opened from Evidence.
- The chat shows the whole plan as a document (`plan-document.tsx`), and so does the plan page. Export menu: Download PDF, Download Word and Copy as Markdown, all built by the API (`GET /outputs/:id/export/:format`, `outputs/export.ts`).

## Limits and config

| Setting | Default | Meaning |
|---|---|---|
| `QLOO_MODE` | `demo` | `live` for real Qloo. Demo data is made up and every receipt says so |
| `QLOO_CALL_BUDGET` | 60 | Qloo calls per run. The live Third Bridge plan uses about 35 to 60 |
| `AGENT_MAX_STEPS` | 12 | Tool loop steps for an answer on an older plan |
| `LLM_API_KEY`, `LLM_MODEL` | empty | No key → scripted reader, default queries and the template writer |
| Qloo client | 2 in flight, 1 retry, 2 on a 429 | `packages/engine/src/qloo/client.ts` |

## Where to change things

| To change | Edit |
|---|---|
| A threshold or formula | spec §5 first, then `engine/scoring.ts`, `verdicts.ts` or `confidence.ts` |
| What the reader pulls from a brief | `FILM_READ_SYSTEM` and `filmReadingSchema` in `film/read.ts` |
| Which queries exist, and their defaults | spec §4.1, then `packages/packs/src/film/catalog.ts` and `findings.ts` |
| How the model shapes queries | `QUERY_PLAN_SYSTEM` and `checkPlan` in `film/planner.ts` |
| Which modules a plan gets | spec §6.1, then `pickModules` in `packages/packs/src/film/modules.ts` |
| A finding's sentence | `film/findings.ts` |
| What the writer is told | `PLAN_WRITER_SYSTEM`, `ANSWER_WRITER_SYSTEM` in `film/writer.ts` |
| The template wording | `templateSection` in `film/writer.ts` |
| A check rule | spec §6.2, then `film/check.ts` |
| Words a playbook line may not use | `TASTE_CLAIM` in the Film pack |
| Cities that can be ranked, their regions and countries | `engine/src/places.ts` |
| Follow-up job rules | `decideFollowUp` in `film/follow-up.ts` |
| Tabs and Evidence rows | `apps/api/src/outputs/present.ts` |
| Expected results of the golden runs | `packages/eval/golden/film/*.json` (`UPDATE_GOLDEN=1`; `RECORD_LIVE=1` for the live one) |

## Not built yet

Share links (button hidden on real outputs), saved project and team memory, rerunning only the queries a what-if changed, new queries inside an answer, the writer for the rival date check (its advice is still a code template), cast as an anchor (a person is not a usable signal), community audiences as a signal (verified in Qloo but outside hard rule 7's list), and the audit and rescue modes.
