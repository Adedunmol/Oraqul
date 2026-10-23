# Launch rules

The craft around the Qloo data, written down. Each category plans by a **versioned rule library** in `packages/packs/src/rules/`. A rule carries its source and the date it was set, and every plan records the version it used (`plan.rules`). The rules are served read only at `GET /rules` and shown on the Guide.

A rule is launch practice, so a line that states one is a **playbook** line (spec §6.2). Nothing here is measured in Qloo, and none of it is a forecast.

## Rule library

| Part | What it holds | Where |
|---|---|---|
| Timeline | How the calendar is worked back from the release date, and for Film and Music the beats themselves | `rules/<category>.ts` |
| Signal | The one primary signal, what sits beside it, when it is read, and a benchmark where there is a sourced one | `rules/<category>.ts` |
| Channels | The channels that lead for the category | `rules/<category>.ts` |
| Budget bands | Micro, independent, mid-size and major, with the thresholds per currency | `rules/shared.ts` |
| Partner tiers | A flagship, B category and integration, C local, with seeded names per market | `rules/shared.ts` |
| Diaspora hubs | The cities a rollout reaches after the home market, by country of origin | `rules/shared.ts` |
| Country channels | Channels that lead in a market whatever the category | `rules/shared.ts` |
| Creative | What a creative kit is built from, per category | `rules/creative.ts` |

Every rule is `{ id, value, source }`, with `source = { kind: 'team' | 'url', label, url?, date }`. A team rule is Oraqul's own launch craft, dated when it was set. A rule with a page behind it, such as the Steamworks rules in `games/modules.ts`, keeps its link. The version is `<category>@<date>.<n>`; change a rule, change the version.

The Games, Books and Podcasts calendars still live in their `KIND_PROFILES` (beats by launch kind). The library records the rules those calendars rest on, and Film and Music take their beats from it.

## The nine rules

| | Rule | Where it is enforced |
|---|---|---|
| D1 | Work backwards from a date. Film plans run months. Music rollouts run 6 to 8 weeks. Books send advance copies 2 to 3 months out. Podcasts treat days 1 to 60 as the campaign. Games collect about 85 percent of wishlists at least four months before release. | Code writes the Timeline from the release date and today (`datedBeats`), so no beat already over is advised |
| D2 | One primary signal per plan, with a target. Film: advance screenings and presales. Music: save rate and stream completion. Books: advance copy conversion and early reviews. Podcasts: downloads per episode at day 30 and day 60. Games: wishlists, 7,000 target and 5,000 floor. Followers and views are secondary. | Code writes What to measure from the signal rule (`signalOf`, `measureSection`) |
| D3 | Clash checks use real rival dates. The user supplies them. | `Rivals: Title on YYYY-MM-DD` in the brief is scored against the comps in one call during the build (`clash.ts`) |
| D4 | One plan per territory, home first, then diaspora cities. | `plan.territories`, in code (`territories.ts`) |
| D5 | Direction, never forecasts. Okay, risky or avoid, with confidence set by code. | `plan.calls` (`direction.ts`) |
| D6 | Ask for a budget band first. Propose only what it can carry. | One card in a full build, and the line check (`band.ts`, `check.ts`) |
| D7 | Channels by audience. Music and books lead on TikTok, Reels and Shorts. Film and podcasts lead on YouTube. Nigeria leads on Instagram and TikTok. WhatsApp is never a lead channel: it passes a launch between people who know each other, so it is offered last, as a sharing layer. The team picks the platforms (D10). | Code writes Channels per territory (`channelsSection`) |
| D8 | Guides and scripts only. Oraqul does not generate ads, trailers, images or video. | The asset refusal, the line check, Creative briefs in every full plan, and the creative kit job |
| D9 | Partners come in tiers, each with Qloo fit and budget fit, and price unknown. | `plan.partners` (`partners.ts`) |
| D10 | Ask which platforms to plan on. Suggest them for the market, let the team pick several, and plan only those. | One multi-select card in a full build (`platforms.ts`), then `territoriesOf` |

## Targets are not forecasts

The target for the primary signal is the team's own number when the brief gives one (`target 10,000 wishlists`), else the library's benchmark where it has one (Games only today). It is labelled "a target, not a forecast". The refusal of forecasts, in `base-prompt.ts`, still holds: Oraqul never predicts what will happen.

## Budget band

Asked once, as a single card with a Skip option, in a full build with no budget or band in the brief, before any Qloo call. Skipping assumes **independent**, and the plan says so under its bottom line. A budget in the brief (`budget $40k`) or a band in words (`a mid-size budget`) is never asked. A what-if keeps the band.

| Band | Up to (USD) | Up to (GBP) | Up to (EUR) | Up to (NGN) |
|---|---|---|---|---|
| Micro | 10,000 | 8,000 | 9,000 | 15,000,000 |
| Independent | 100,000 | 80,000 | 90,000 | 150,000,000 |
| Mid-size | 1,000,000 | 800,000 | 900,000 | 1,500,000,000 |
| Major | above | above | above | above |

These thresholds are chosen conventions, not measured. Change them in `rules/shared.ts` and here.

A band that cannot carry a flagship drops any line that proposes one, unless the team named the partner. A symbol in a written budget stands for its main currency (`$` for USD).

## Partner tiers

| Tier | What | Budget fit |
|---|---|---|
| A, flagship | Guinness, MTN, Indomie in Nigeria. Only for releases with scale | Fits a mid-size or major band, a stretch for independent, out for micro |
| B, category and integration | Banks and payment brands (Verve, QuickTeller), food and drink, hospitality, telecom bundles. EE and Monzo in London, Lyft and Cash App in the US | Fits, a stretch for micro |
| C, local | Cinemas, creators, diaspora businesses, community groups | Fits every band. Most realistic for an independent release |

Seeded names join the brands Qloo is asked to rank for that market's cities, so a seed gets a measured fit. A seed Qloo does not rank shows as not ranked and gets no call, never a weak one. Guinness, Indomie, Verve and QuickTeller are not yet verified in Qloo (`TODO(verify)` in `rules/shared.ts`); only MTN and Bolt for Lagos, EE and Monzo for London, and Lyft and Cash App for the US are recorded as verified in [qloo.md](../backend/qloo.md).

Price is always **unknown**. Oraqul gives no pricing advice.

## Direction calls

Set by code from a value Qloo returned, with the confidence of the finding behind them. They sit beside the assumption verdicts (holds, weak, breaks, could not test); they do not replace them.

| Subject | Okay | Risky | Avoid | No call |
|---|---|---|---|---|
| An opening day against the rivals the team named | Overlap below 70 | 70 to 85 | Above 85 | No rival scored |
| A territory as a place to open | Lift 1.2 or above | 1.0 to 1.2 | Below 1.0 | The place could not be ranked |
| A partner among the brands Qloo ranked | Top third | Middle third | Bottom third | Fewer than 3 ranked, or not ranked |

A day is as risky as its riskiest rival. **A team choice is a constraint** (spec §5.2): a call on a city, a date or a partner the team chose keeps it and says how to handle it ("Keep it, and open it after Lagos"). It never says to drop it.

## Creative

Oraqul writes guides, never the asset.

- **Refusal.** A request to generate, make, design or produce an ad, trailer, image, video or key art is refused in fixed words, with the way to ask for the guide. "Write a trailer script" and "a trailer shot list" are guides and are not refused.
- **Line check.** A line that offers to make the asset is dropped.
- **Creative briefs.** Every full plan has a short section: hook options and a key art brief.
- **Creative kit.** A follow-up job, "make the creative kit for Lagos on Instagram", saves an output with, for one territory and channel: hook options, a script outline, a shot list, a key art brief and a caption pack. Built by code from the plan's findings and the rule library, with every line checked. Only the tone and the places named come from Qloo and cite a finding.

## Changing a rule

Change the rule and its version in `packages/packs/src/rules/`, say why in the commit, and update this file. Goldens that count code-written lines (`timeline`, `measure`, `channels`, `creative`) will change; read the diff before re-recording.
