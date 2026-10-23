# Principles for every category agent

Each category agent follows these; what "good" means for one category is in its own file, starting with [film-agent.md](film-agent.md). Behaviour and numbers live in [spec](spec.md) and [PRD](prd.md).

## The one idea

A plain chatbot can write a fluent launch plan from memory. Oraqul has to be **better where it counts**: the claims about who the audience is, what they like and where they gather are **measured, specific to each place, and checked**. The plan is the product. Evidence sits out of the way until someone wants it.

If our plan is not clearly better than a plain ChatGPT or Claude answer to the same brief, the Qloo layer is not earning its place, however well documented it is.

## What "culturally grounded" means

Claims about taste, audience and place come from measured data, not the model's memory. A plain model gives the stereotype. A grounded agent names the actual artists, series, venues and places this audience ranks highest **in each city**.

- **Context makes data sharp.** A comp signal alone drifts toward what is popular overall. A scene tag, release country, city, age band and year make it specific. This is why the model shapes the questions and code runs them.
- **It tests the team's assumptions** and keeps their decisions as constraints.
- **Curation.** Qloo lists carry junk (a hotel among cinemas, a theology school, an arena as a campus). Judgement about fit and scale sits on top of the data.
- **Three kinds of claim, each with its own evidence standard:**
  - **Taste and place:** measured in Qloo, cited to a finding.
  - **Time-sensitive facts** (rivals, windows, distributors, figures): from web search, cited to a page.
  - **Launch practice:** the model's craft, labelled and barred from claiming taste or stating figures with no source.
- **Every chosen place gets the same questions.** A place with fewer Qloo-backed lines is a flaw in our query plan, not in Qloo.

## Against a normal chatbot

| | Normal chatbot | Oraqul |
|---|---|---|
| Audience claims | From memory, unchecked | Measured per city, with named picks |
| The team's assumptions | Accepted | Tested and reported |
| Time-sensitive facts | Stale or invented | Searched, dated, linked |
| Consistency | Differs each run | Same brief, same questions, same findings |
| Invention | Can invent plot, venues, numbers | A check drops lines no source supports |
| Follow-ups | Starts again | Reruns the plan with the change |
| Output | A chat answer | A plan, as a document |

A chatbot is better at fluency, speed, breadth and some local knowledge. We win only on measured, checked specifics, and we must not lose on readability or usefulness to earn that.

## Which source does which job

| Source | Job | Never |
|---|---|---|
| Qloo, through code | Who the audience is, what they like, where they gather, ranked | Sets what the model may say about a number it did not return |
| Web search | Dated, sourced market facts | Supplies taste, or any fact without a page |
| The model | Reads the brief, shapes queries, writes the plan, launch craft | Sets a number, verdict or confidence; names a taste pick no finding returned |
| Code | Numbers, verdicts, checks, guarantees (every city and comp answered) | |

The model may curate (skip a poor fit) but must not re-rank Qloo's lists or promote a lower pick over a higher one. It is told so, and the rank-kept score measures it and is pinned in the golden runs. It is not a hard check, because dropping a good line over word order would cost more than it saves.

## Using Qloo the way it is meant to be used

1. **Qloo ranks, the model talks.** The model parses intent and explains. Qloo owns candidate generation and ordering. LLM recommenders suffer from position bias (they reward whatever is listed first) and lack co-consumption data, so the model must not re-rank a list Qloo ranked. It may skip a poor fit. We measure this (the *rank kept* score in [film-agent.md](film-agent.md#how-we-judge-a-plan)) and tell the writer to keep Qloo's order.
2. **Rank a candidate list instead of taking the open list.** Qloo can rank a list we supply (`filter.results.entities`). Open lists return the biggest names, which is how Coca-Cola and a luxury car brand became partner suggestions: Qloo says who the audience likes, not who will say yes. So for partner brands the model names brands that could realistically say yes in each city, code resolves them in Qloo, and Qloo ranks only those. Verified live: MTN Group and Bolt for Lagos, EE and Monzo for London, Lyft and Cash App for the US cities.
3. **Neighbourhoods come from the heatmap we already pull.** Qloo's location product is built for hyper-local targeting. The cells of the city heatmap give the audience's strength by neighbourhood with no extra call: the model names neighbourhoods and their centres, code reads the nearest cells and ranks them. Verified live on Third Bridge: Stonecrest and Lithonia first in Atlanta, Alief then Sugar Land in Houston, Thamesmead then Croydon in London, Surulere and Lekki in Lagos. These match what Claude named from memory, now measured and ranked. A few cells near each centre is a lead to confirm on the ground, never above medium confidence.
4. **Push logic into Qloo, not after it.** Constraints go in as filters (tags, exclusions, location, the candidate list), so Qloo ranks inside the constrained set, rather than us pruning afterwards.
5. **One call with all the seeds.** Combine the comps in a single call; averaging separate calls loses what the joint signal carries. Location is a signal (taste context) and a filter (hard geography) and they do different things.
6. **Qloo is stateless.** We keep the resolved ids and resend them every call.
7. **Reject any name Qloo did not return.** Our line check does this. Fixtures and demo data are labelled.
8. **Budget the quota.** A plan makes about 45 to 65 Qloo calls against a monthly allowance of about 10,000 on development keys, so name lookups (comps, partner brands) are kept across runs for 14 days.
9. **Resolve every name deterministically, and be careful with ambiguity.** Strong entries reject an ambiguous match or ask. We settle it in code (country, then popularity) and say which we chose, because we do not ask questions. A wrong match is a real risk (Qloo's series lists show Gangs of London beside Gangs of Lagos).
10. **What to claim.** "Qloo beats an LLM" is not a measured result. The defensible claim is that an LLM lacks co-consumption and location-level taste data and is unreliable at ranking, so Qloo supplies the data and the order and the model supplies language. LLMs invent places far more than films (a single-author preprint, so use with care): named venues, churches and neighbourhoods are where we beat a chatbot most.

## Lessons to keep

- **Proof is not the product.** A plan built around receipts alone reads no better than a chat answer.
- **A strict check can destroy quality.** Forbidding the model all launch knowledge made it write filler. Only taste claims need Qloo; practice is the model's job, labelled.
- **Plain words.** No lift, index, affinity, cells or "could not test" in a plan. Turn a data limit into an action.
- **A low reading is not a weak market.** London scored low for the film comps but second only to Lagos for Afrobeats. Use more than one signal per city, and say what to lead with, not that a city is poor.
- **Checkers need real runs.** Several rules dropped good lines on real output ("endpoint" in "the campaign's endpoint", a venue copied with its address). Re-read what each check drops after every model change.
- **Prompts for search matter as much as the model.** Naming the industry ("Nollywood") and one search per question and city turned thin results into dated rivals and distributors.
- **Cost is per plan, not per call.** A plan uses 25K to 150K tokens, from about $0.04 to over $2 depending on the writer.

## A new category

Copy the shape of [film-agent.md](film-agent.md): the decisions its plan settles, requirements, what grounded means there, the scoring rubric, and known gaps. Write it when the category is built, not before.
