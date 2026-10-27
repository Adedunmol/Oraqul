# Launch rules

The craft around the Qloo data, written down. Each category plans by a **versioned rule library** in `packages/packs/src/rules/`. A rule carries its source and the date it was set, and every plan records the version it used (`plan.rules`). The rules are served read only at `GET /rules` and shown on the Guide.

A rule is launch practice, so a line that states one is a **playbook** line (spec §6.2). Nothing here is measured in Qloo, and none of it is a forecast.

## Rule library

| Part | What it holds | Where |
|---|---|---|
| Timeline | How the calendar is worked back from the release date, and for Film and Music the beats themselves | `rules/<category>.ts` |
| Signal | The one primary signal, what sits beside it, when it is read, and a benchmark of Oraqul's own where there is one (Games only today, a team rule, not a sourced figure) | `rules/<category>.ts` |
| Channels | The channels that lead for the category | `rules/<category>.ts` |
| Budget bands | Micro, independent, mid-size and major, with the thresholds per currency | `rules/shared.ts` (`shared@<date>.<n>`) |
| Diaspora hubs | The cities a rollout reaches after the home market, by country of origin | `rules/shared.ts` |
| Country channels | Channels that lead in a market whatever the category | `rules/shared.ts` |
| Platform extras | The platforms a category or a market adds to the suggestions | `rules/platforms.ts` |
| Partners | Tiers, seeded names per market, brand categories and kinds of partner per category, lead time, content fit, the pitch kit | `rules/partners.ts` (`partners@<date>.<n>`), see [partnerships](partnerships.md) |
| Content calendar | The rows a calendar is built from, and the paid ads note | `rules/calendar.ts` (`calendar@<date>.<n>`), see [content calendar](content-calendar.md) |
| Pace | How the team's own figures are read against the plan's signal: the default curve for each category and the thresholds for ahead, on pace and behind | `rules/pace.ts` (`pace@<date>.<n>`), see [pace](#pace-and-watch) |
| Watch | What a launch watch looks for, in days: when a plan is old, how near a rival is, when a late action is urgent | `rules/watch.ts` (`watch@<date>.<n>`) |
| Live shows | E1 to E8 for a single show or a short run | `rules/shows.ts` (`shows@<date>.<n>`), see [shows agent](../categories/shows.md) |
| Creative | What a creative kit is built from, per category | `rules/creative.ts` |

`GET /rules` serves all of it. A plan records the category's version in `plan.rules` and the shared libraries it also used in `plan.rules.parts`. The platform suggestion mechanics (`CATALOGUE`, the number suggested, which markets get WhatsApp) stay in code: they are interface, not launch craft.

Every rule is `{ id, value, source }`, with `source = { kind: 'team' | 'url', label, url?, date, grade, caveat? }`. A team rule is Oraqul's own launch craft, dated when it was set. A rule with a page behind it keeps its link, such as the TickPick page behind the live show pacing figure. The grade says how far to lean on it:

| Grade | Means |
|---|---|
| `team` | Oraqul's own craft |
| `directional` | One blog-level or vendor source for one point. Treat it as direction, not a measured result. The caveat says who published it |
| `not-researched` | Nobody researched it, so the rule holds no number |

The version is `<name>@<date>.<n>`; change a rule, change the version. The Games Steamworks rules (`PLATFORM_RULES` in `games/modules.ts`) carry their own links and are not in the library.

The Games, Books and Podcasts calendars still live in their `KIND_PROFILES` (beats by launch kind), and the Live shows calendar is built in code from the show type and on-sale window. The library records the rules those calendars rest on, and Film and Music take their beats from it.

## The ten rules

| | Rule | Where it is enforced |
|---|---|---|
| D1 | Work backwards from a date. Film plans run months. Music rollouts run 6 to 8 weeks. Books send advance copies 2 to 3 months out. Podcasts treat days 1 to 60 as the campaign. Games collect about 85 percent of wishlists at least four months before release. | Code writes the Timeline from the release date and today (`datedBeats`), so no beat already over is advised |
| D2 | One primary signal per plan, with a target. Film: advance screenings and presales. Music: save rate and stream completion. Books: advance copy conversion and early reviews. Podcasts: downloads per episode at day 30 and day 60. Games: wishlists, 7,000 target and 5,000 floor. Followers and views are secondary. | Code writes What to measure from the signal rule (`signalOf`, `measureSection`) |
| D3 | Clash checks use real rival dates. The user supplies them. | `Rivals: Title on YYYY-MM-DD` in the brief is scored against the comps in one call during the build (`clash.ts`), and a fix keeps them. An audit does not run the clash. For a live show a rival is also called by how near its date is to the show's (E6) |
| D4 | One plan per territory, home first, then diaspora cities. | `plan.territories`, in code (`territories.ts`) |
| D5 | Direction, never forecasts. Okay, risky or avoid, with confidence set by code. | `plan.calls` (`direction.ts`) |
| D6 | Ask for a budget band first. Propose only what it can carry. | One card in a full build, and the line check (`band.ts`, `check.ts`) |
| D7 | Channels by audience. Music and books lead on TikTok, Reels and Shorts. Film and podcasts lead on YouTube. Games lead on YouTube, TikTok and Discord. Live shows lead on Instagram, TikTok and X. Nigeria leads on Instagram and TikTok. WhatsApp is never a lead channel, whatever the team picks: it passes a launch between people who know each other, so it is offered last, as a sharing layer. The team picks the platforms (D10), either on the card, in a `Platforms:` line, or in the Guide's `Channels we already use:` line. | Code writes Channels per territory (`channelsSection`) |
| D8 | Guides and scripts only. Oraqul does not generate ads, trailers, images or video. | The asset refusal, the line check, Creative briefs in every full plan, and the creative kit job |
| D9 | Partners come in tiers, each with Qloo fit and budget fit, and price unknown. | `plan.partners` (`partners.ts`) |
| D10 | Ask which platforms to plan on. Suggest them for the market, let the team pick several, and plan only those. | One multi-select card in a full build (`platforms.ts`), then `territoriesOf` |

## Targets are not forecasts

The target for the primary signal is the team's own number when the brief gives one (`target 10,000 wishlists`), else the library's benchmark where it has one (Games only today). It is labelled "a target, not a forecast". The refusal of forecasts, in `base-prompt.ts`, still holds: Oraqul never predicts what will happen.

## Pace and watch

Once a launch has figures, D2's signal is read against them. This is direction, never a forecast (D5): Oraqul says where the figures stand against a convention now and never says where they will end up.

| Signal kind | Categories | Default | Read |
|---|---|---|---|
| Cumulative, back loaded | Film (screenings and presales), Live shows (sell-through) | A curve of the share of the target expected by each day from release: Film 10 percent at 8 weeks out, 30 at 4, 65 at 1, 100 on release; shows from the 57 percent last week figure ([live shows E2](../categories/shows.md)) | The target times the curve's share today, against what the figures add up to |
| Cumulative, front loaded | Games (wishlists) | 85 percent of the target by four months out (D1), a straight line from a year out, 100 on release | The same |
| Level | Music (save rate and completion), Podcasts (downloads per episode), Books (advance copy conversion) | None: no sourced curve exists | The latest reading against the target, from the signal's first checkpoint on |

*Ahead* is at least 110 percent of the expected figure, *behind* is under 90 percent, and fewer than three dated entries, no target, no release date, an expected share under 10 percent or a level signal before its first checkpoint is *too early to tell*. The curves and thresholds are chosen conventions, not facts: the team can change a plan's target and curve, and the page says when it has. A convention with no source says so beside the verdict.

A launch watch (`rules/watch.ts`) raises a rival release within 7 days of the release date as *watch* and within 2 days as *act*, a campaign action undone 3 days past its date as *act*, and a plan 14 days old with no newer check of what has changed as *act*. The dates for rivals come from the web, each with its page and the day it was read, never from Qloo ([spec §5.17](spec.md)).

## Budget band

Asked once, as a single card with a Skip option, in a full build with no budget or band in the brief, before any Qloo call. Skipping assumes **independent**, and the plan says so under its bottom line. A budget in the brief (`budget $40k`) or a band in words (`a mid-size budget`) is never asked. A what-if keeps the band.

| Band | Up to (USD) | Up to (GBP) | Up to (EUR) | Up to (NGN) |
|---|---|---|---|---|
| Micro | 10,000 | 8,000 | 9,000 | 15,000,000 |
| Independent | 100,000 | 80,000 | 90,000 | 150,000,000 |
| Mid-size | 1,000,000 | 800,000 | 900,000 | 1,500,000,000 |
| Major | above | above | above | above |

These thresholds are chosen conventions, not measured. Change them in `rules/shared.ts` and here.

A band that cannot carry a flagship drops any line that proposes one, unless the team named the partner. Who is launching (a `Who is launching:` line or plain words in the brief: solo, small team, established company or major) narrows it further. The lower of the two wins (`partnerReach` in `rules/shared.ts`):

| Launcher | Tier A | Tier B |
|---|---|---|
| Not said | Band decides: out on micro and independent, fits on mid-size and major | Band decides |
| Solo | Out at any band | A stretch |
| Small team | Out on independent, a stretch on mid-size and major | Fits (a stretch on micro) |
| Established or major | A stretch on independent, fits on mid-size and major | Fits (a stretch on micro) |

Tier A is out on a micro budget for everyone. A flagship that is out or a stretch is listed apart as "Later, as the launch grows", with no Qloo call and no territory, and is never written into the plan's lines; only one that fits may be. A flagship the team named is kept in the main list. A symbol in a written budget stands for its main currency (`$` for USD).

## Partner tiers

| Tier | What | Budget fit |
|---|---|---|
| A, flagship | Guinness, MTN, Indomie in Nigeria, and any ranked brand at or above the flagship popularity (0.85). Only for releases with scale | Fits a mid-size or major band, out for micro and independent, and out for a solo launcher at any band. Who is launching can lift independent to a stretch, below |
| B, category and integration | Brands that fit the category: banks and payment brands, food and drink, hospitality, telecom bundles. EE and Monzo in London, Lyft and Cash App in the US, Bolt in Lagos | Fits, a stretch for micro or a solo launcher |
| C, local | Cinemas, creators, venues, diaspora businesses, community groups. Most realistic for a solo or independent release | Fits every band and every launcher |

A tier is set by what Qloo says about a brand, not by default: a flagship seed, or a ranked brand at or above the flagship popularity, is tier A; any other ranked brand is tier B; kinds of local partner are tier C. A plan keeps reserved slots per tier (3 flagship, 7 category, 4 local) so many ranked brands cannot push the local ones out.

Seeded names are asked of Qloo only for the markets of the plan's territories, joined to the brands Qloo is asked to rank for those cities, so a seed gets a measured fit. A flagship seed is left out of the pool when the launch cannot reach one. Qloo also finds brands for the comps' audience by category and city, and a ranked brand's place for the city and age band alone is checked ([partnerships](partnerships.md#how-a-plan-finds-partners)). A seed Qloo does not rank shows as not ranked and gets no call, never a weak one. Each option carries its own market.

**Verification.** Checked on the development host ([qloo.md](../backend/qloo.md#what-is-verified)): Guinness, Indomie, EE, Monzo, Lyft, Cash App and Bolt match by exact name, and MTN matches as "MTN Group". "Verve" and "QuickTeller" did not resolve to the Nigerian payment brands, so they are not seeds; banks and payment brands are a kind of partner. Brand categories that give brands that operate in a city: beverage, telecom, food and beauty. Coffee, energy drink and snack were thin and are not asked; Qloo has no brand category for apparel, hardware, ticketing or payments.

Price is always **unknown**. Oraqul gives no pricing advice. Details, the lead time rule (T1), content fit (T2), the pitch kit (T3, T4) and the team's own partners are in [partnerships](partnerships.md).

## Direction calls

Set by code from a value Qloo returned, with the confidence of the finding behind them. They sit beside the assumption verdicts (holds, weak, breaks, could not test); they do not replace them.

| Subject | Okay | Risky | Avoid | No call |
|---|---|---|---|---|
| An opening day against the rivals the team named | Overlap below 70 | 70 to 85 | Above 85 (high overlap) | No rival scored |
| A rival show date against a live show's date (E6) | More than a week from the show, or little shared audience | The same night with little shared audience, or a rival Qloo could not score on the same night or in the same week | High overlap in the same night or week | No show date |
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
