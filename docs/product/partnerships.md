# Partnerships

Brand partnerships are part of every launch, in every category. They are not a category of their own. This page says how a plan finds partners, how it tiers and flags them, and what a partner pitch kit holds. The tiers and the seeds are in [launch rules](launch-rules.md#partner-tiers); the code is `apps/api/src/agent/launch/partners.ts` and `packages/packs/src/rules/partners.ts`.

## What the plan shows

`plan.partners` lists the partners a plan can approach. Each has a name, a tier, the market it belongs to, where it came from (`seed`, `qloo` or `team`), the place Qloo gave it among the brands ranked for this audience, whether the budget band can carry it, and an unknown price. A kind of partner with no name yet, such as "Bookshops", is a row too, marked as a kind.

- **Market.** A partner Qloo ranked in a city takes that city's country. A seed takes its own market. A partner the team named, or one Qloo placed in no city, takes the release country.
- **Markets reached.** Seeds are listed only for the markets of the plan's territories.
- **Tier.** Set by what Qloo says about the brand (see launch rules), not by default.
- **Slots.** 3 flagship, 7 category and 4 local, so ranked brands cannot push the local partners out. A partner the team named is never cut.
- **Notes.** `plan.partnerNotes` holds the lead time, band and barter notes (T1).

## Per category

Each category has its own brand categories, kinds of partner and ideas (`rules/partners.ts`). Qloo is asked only for brand categories a live probe showed give brands that operate in a city; the rest are kinds of partner with no Qloo call.

| Category | Qloo is asked | Kinds of partner |
|---|---|---|
| Film and series | telecom, beverage, food, beauty | food and drink, apparel, beauty, telecom bundles; cinemas, creators, community groups |
| Music | telecom, beverage, beauty | drinks brands, telecom bundles, apparel; venues, creators, community groups |
| Books | beverage, telecom, food | coffee and lifestyle brands, stationery; bookshops, reading communities, libraries |
| Podcasts | beverage, telecom, food | sponsor brands that fit the listener profile, telecom bundles; creators, networks |
| Games | beverage, telecom | hardware and peripherals, energy and snack brands, telecom bundles; streamers, creators |
| Live shows | beverage, telecom | title sponsor, drinks brand, ticketing and payments partner; venue, creators, community groups |

## The rules

- **T1, lead time.** Big brands plan annually, and specialists advise starting about 18 months before release. Big franchises attract the big brands. An independent release leads with tier B and tier C partners, and the plan says why. Barter and in-kind deals are common: never assume cash. The note says how many months away the release is.
- **T2, content fit.** Code flags a mismatch between the work and a partner from the content rating or tone the team gave (`Content rating or tone:` in the brief, or the rating Film reads). A family brand beside adult or violent content, a flagship beside adult content (fan backlash), and a drinks brand beside family content or an audience that includes people under 25 are flagged. A flag is direction only: the partner stays in the list with the reason beside it.
- **T3, the pitch kit.** A partner brief now holds a text-only kit: why the audience fits (the one grounded line, citing the finding), what the partner gets through its own channels (on pack, in store, digital, events), the ask, a proposed timeline from the release date, one or two ideas, and a short script. Every line is checked.
- **T4, room for the partner.** The ideas are starting points. The kit says to ask the partner what they would build.
- **Oraqul never sends anything.** The kit is a draft for the team.

## The team's own partners

The plan page lets an owner or an editor add and remove the partners the team already has or knows. `PUT /outputs/:outputId/partners { names }` replaces the team's list. Code places each name from the brands the plan already ranked, with no new Qloo call; a name Qloo did not rank shows as not ranked until a partner brief scores it. Partners Oraqul suggested are not changed. The Guide's `Partners already signed:` line is read as partners the team has, and `Brands to consider:` is asked of Qloo beside the model's own candidates and never signed.

## What is not verified

Qloo has no brand category for apparel, hardware, ticketing, payments or banks, and the coffee, energy drink and snack categories were thin. The per-brand results are in [qloo.md](../backend/qloo.md).
