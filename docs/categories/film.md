# Film

What "good" means for a Film plan, and what is Film's own in code. Shared rules are in [principles.md](../product/principles.md); the runtime every category shares is in [launch-runtime.md](../backend/launch-runtime.md) (Film is the model it is written around). Behaviour and numbers are in the [spec](../product/spec.md): §4.1 the query catalog, §5.2 the tests, §6.1 the modules.

## What a launch plan has to settle

A plan is a set of decisions, not a document:

| Decision | What it covers |
|---|---|
| Where, in what order | Markets and sequence: premiere in the home market, others within days so piracy and spoilers do not get there first |
| When | Release route and window, against rival releases and seasonal peaks |
| Who | Core and secondary audience, what each likes, where it gathers |
| How to reach them | Positioning, trailer and ad placement, publicity and creators, community and grassroots, music, brand partners |
| Cost and measures | A budget split and the numbers to track |
| Risks | Piracy, a crowded window, a thin city, a comp that leans on one title |

## Requirements

1. **Plan for the team's decisions.** Their cities, age band, comps and window are constraints. Test them and say what Qloo found, never replace them. Every named city and comp gets an answer.
2. **Work with thin input.** Use everything given, ask for nothing beyond one city, and never ask for comps. A title and a city are planned as a typical Nollywood film, said in the plan, and the agent asks for the description, genre and audience afterwards to sharpen it. Comps are never required: with none named, they are found from the description or genre through Qloo.
3. **Be realistic about scale.** A small film gets in-kind support, not sponsorship cash. Brand fit (what the audience likes) and ability to partner (who will say yes) are different questions. Qloo answers only the first. Code answers the second from the budget and who is launching (a solo or small launch is not offered a national brand, and the brands Qloo finds for the audience are offered only when the launch can reach them), read from the brief and never guessed.
4. **Be date-aware.** Never advise around a release that has already opened.
5. **Be actionable.** Each line is the move, the reason and who does it. Readable in about five minutes, plain words, no data jargon.
6. **Never invent the film.** Its plot, characters, themes and tone come only from the brief. The audience's themes are what to speak to, never what the film contains.
7. **No forecasts.** No box office or sales predictions.
8. **Be exportable and revisable.** PDF, Word and Markdown; a what-if reruns the plan.

## What grounded means for Film

- **Examples.** A plain model gives Afrobeats, churches and student societies. A grounded plan names the actual artists, series, venues and churches this audience ranks highest in each city.
- **The team's assumptions are tested.** On the Third Bridge example the comps' audience skewed 35 to 54 against an 18 to 34 target. The plan said so and kept the target.
- **Where a chatbot can still beat us.** Some local knowledge (Peckham, Croydon, Sugar Land, Stonecrest, Morehouse) that Qloo's place lists do not give. Neighbourhood findings from the heatmap narrow this.

## How it works in code

The film being launched is usually not in Qloo yet, so it is described by its **comps** and Qloo is asked what their audience likes; the path is the one in [launch-runtime.md](../backend/launch-runtime.md). Film's own code is `apps/api/src/agent/film/`, wired in `config.ts` (`filmLaunch`), plus `packages/packs/src/film/` (prompt, query catalog and defaults in `catalog.ts`, module rules, budget convention and taste words in `modules.ts`).

| Piece | File |
|---|---|
| Brief reader (format, genre, logline, country, comps, cities, window, ages, cast, director, soundtrack, route, budget, signed partners) | `film/read.ts` |
| Query planner | `film/planner.ts` |
| Film's queries | `film/findings.ts` |
| Prompts and templates | `film/writer.ts` |
| Web research prompts: release timing and market, never the title or story | `film/research.ts` |
| Line-check words and decisions | `film/check.ts`, `film/decisions.ts` |
| Audit verdicts | `film/audit-verdicts.ts` |

Modules and queries: premiere route, cinemas and venues, music, brand partners, neighbourhoods and universities, chosen by `pickModules` (spec §6.1). Rival films with their opening days are scored against the comps in the build, and each date gets a call.

## Launch rules

Thresholds and bands are in [launch-rules.md](../product/launch-rules.md). For Film:

- **Calendar.** Months, worked back from the release date in code: key art and the sales page about 26 weeks out, the first trailer at 12, advance screenings from 10 to 6, presales at 8, the premiere at 1 and the second wave in the weeks after.
- **Signal.** Advance screenings and presales. Trailer views, followers and press mentions are secondary. There is no benchmark number: the target is the team's own.
- **Territories.** One plan per city, the home market first, then the diaspora cities (Lagos, London, Houston, Atlanta), with a call on each.
- **Channels.** YouTube leads, then Instagram and TikTok. Nigeria leads on Instagram and TikTok; WhatsApp is only a sharing layer.
- **Partners.** Found from what the comps' audience likes in each verified brand category and city, ranked as one pool with the model's names, and checked against the city's own taste. Tier A flagship brands (those Qloo ranks at or above the flagship popularity) only for a release with scale and a launcher who can reach one, tier B (banks and payment brands, food and drink, hospitality, telecom bundles), tier C local (cinemas, creators, diaspora businesses, community groups).

## Limits

- **Neighbourhood readings are a lead.** The model names the centre, code checks it against the city's box, and the cells are coarse (about 3 to 7 km). Confirm on the ground.
- **Web research can find nothing for a city**, especially US diaspora cinema, and what it finds can be stale. Check dates before acting on a rival or a window.
- **Qloo's place lists carry poor fits** (a theology school among universities). Partner brands are ranked from a pool we choose (the model's names and the brands Qloo finds by category and city); places are not.
- **Ambiguous names** are settled in code (country, then popularity) and the plan says which was chosen. A wrong match is possible.
- **Plans run long.** The writer aims for about 1,200 words.
- **Cultural sensitivity.** Real traditions, institutions and neighbourhoods need care in anything the plan puts on screen.
- **Live checks are partial.** The live smoke run and the probes in [qloo.md](../backend/qloo.md) have run on the development host only.
