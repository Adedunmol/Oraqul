import { A, AS, assumption, CN, F, fitArr, RK } from '../brief';
import { placesFor } from '../places';
import type { DBrief, DemoPack } from '../types';

export const games: DemoPack = {
  id: 'games',
  name: 'Games',
  short: 'Games',
  blurb: 'Fan bases, regions and collabs, planned before launch.',
  noun: 'game',
  fallback: 'the studio and comp games',
  tools: ['Fan base bridge', 'Region ranker', 'Collab brief'],
  cov: {
    tests: [
      'Player audience by age, platform habit and region',
      'Fan base bridge to anime, music and film audiences',
      'Region ranking, as lift over a neutral audience',
    ],
    thin: [
      'Small indie titles. With few anchors the read rests on the studio and comp games',
      'Niche genres with few comparable games',
    ],
    none: ['Wishlists, sales, player counts and retention. You supply them for a fix'],
  },
  fields: [
    ['Format', 'kind'],
    ['Genre', 'genre'],
    ['Studio', 'lead'],
    ['Comp games', 'comps'],
    ['Regions', 'places'],
    ['Launch', 'window'],
  ],
  kinds: ['Co op survival game', 'Story game', 'Mobile game', 'Live service'],
  placeLabel: 'regions',
  placeOpts: ['US', 'Germany', 'Japan', 'Brazil'],
  files: { plan: 'launch-plan.pdf', res: 'wishlists-by-region.csv' },
  descHint:
    'Describe the game: genre, studio, comp games, regions, launch window. Paste or attach anything you already have, such as a launch plan or wishlist numbers.',
  matchOpts: (n) => [
    { v: `${n} (game)`, l: `${n} (game)`, d: 'Co op survival · early access' },
    { v: `${n} (franchise)`, l: `${n} (franchise)`, d: 'Adventure · low confidence' },
  ],
  q2: {
    prompt: 'What is the business model?',
    opts: ['Premium, one price', 'Free to play', 'Subscription'],
    label: 'Business model',
  },
  sec: [
    { k: 's1', t: 'Collab partners', one: 'Collab partner' },
    { k: 's2', t: 'Creators and streamers', one: 'Creator or streamer' },
    { k: 's3', t: 'Cross promotion titles', one: 'Cross promotion title' },
    { k: 's4', t: 'Events and showcases', one: 'Event or showcase' },
  ],
  sigTabs: [
    ['fanbase', 'Fan base bridge'],
    ['regions', 'Regions'],
  ],
  planNote: 'Ranked by fit, 0 to 100. 75 and above is recommended.',
  dateLabel: 'Rival launch check',
  dateTitle: 'Rival launch check',
  partnerLabel: 'Collab brief',
  partnerWord: 'collab',
  rivalWord: 'rival game',
  quick: ['Check rival launches', 'Add wishlist numbers', 'Draft a collab brief'],
  noFc: {
    re: /wishlists?|sales|copies|players will|forecast|predict|revenue|how many players/,
    msg: "I can't forecast wishlists, sales or player counts. Qloo has no store or player data. I can test which regions, collabs and fan bases fit the game. If you share your wishlist numbers, I can use them as inputs.",
  },
  noFcWhat: 'wishlist or sales numbers',
  mv: [
    ['s1', 'Approach {n} for a collab (fit {f}).'],
    ['s2', 'Seed {n} for creator coverage (fit {f}).'],
    ['s3', 'Cross promote with {n} (fit {f}).'],
  ],
  lead: (b) => {
    const top = b.places.slice().sort((x, y) => y.lift - x.lift)[0];
    return `Lead with ${b.audience[0]?.name ?? 'the core players'}${top ? ` and open in ${top.name}` : ''}.`;
  },
  trace: {
    build: [
      'Resolving the game to Qloo entities. Not found, falling back to the studio and comp games',
      'Building the player audience by age and region',
      'Bridging to anime, music and film fan bases',
      'Listing the assumptions, stated and unstated',
      'Testing each assumption: holds, weak, breaks, cannot test',
      'Ranking regions by lift over a neutral audience',
      'Red teaming the winner from the opposite seed',
      'Packaging the brief with a receipt on every line',
    ],
    audit: [
      'Reading the launch plan',
      'Extracting the assumptions, stated and unstated',
      'Resolving collabs, creators and titles to Qloo entities',
      'Testing each assumption: holds, weak, breaks, cannot test',
      'Searching for better options for the ones that break',
      'Red teaming the fixes from the opposite seed',
      'Packaging the audit with a receipt on every line',
    ],
    date: [
      'Reading the rival launch dates',
      'Measuring shared players with each rival game',
      'Ranking the weeks by overlap',
      'Packaging the check with a receipt per rival',
    ],
    partner: [
      'Finding collab partners that fit the target players',
      'Checking affinity for each candidate',
      'Drafting the brief with the evidence attached',
    ],
    fix: [
      'Reading the wishlist and player numbers by region and platform',
      'Comparing who wishlisted with who the plan assumed',
      'Finding which assumption broke',
      'Searching for regions, collabs and creators that fit the real players',
      'Red teaming the new plan from the opposite seed',
      'Writing the course correction for launch month',
    ],
  },
  res: {
    dateLabel: 'Wishlist report date',
    aTitle: 'Wishlists by region',
    aNoun: 'region',
    aLabels: (r) => r.places.slice(),
    planned: (r) => fitArr([40, 20, 20, 20], r.places.length),
    demoA: (r) => fitArr([26, 18, 16, 40], r.places.length),
    tTitle: 'Wishlists by platform',
    tLabels: () => ['PC', 'Console', 'Mobile'],
    demoT: () => [58, 34, 8],
    holdLabel: 'Players still playing after day 7 (percent)',
    holdShort: 'Day 7',
    holdSub: 'of players still playing',
    holdDefault: 31,
    confirmRows: [
      ['Report date', 'Oct 2'],
      ['Source', 'Store dashboard export'],
    ],
    chartA: 'Planned against actual wishlists by region',
    chartSub: 'Percent of wishlists by region.',
    chartT: 'Wishlists by platform',
    head: (_b, g) =>
      `Where players wishlisted was not where the plan put them. ${g.W} delivered ${g.wa} percent against ${g.wp} planned, and ${g.B} delivered ${g.ba} percent.`,
    stats: (_b, g) => [
      { l: `${g.W}, planned`, v: `${g.wp}%` },
      { l: 'Actual', v: `${g.wa}%` },
      { l: `${g.B}, actual`, v: `${g.ba}%` },
    ],
  },
  base(r) {
    const c = r.comps.length ? r.comps : ['Tidal Hollow', 'Cairn Keepers'];
    const B: DBrief = {
      aLabels: r.places.slice(),
      planned: fitArr([40, 20, 20, 20], r.places.length),
      audience: [
        A('au1', 'Co op players 18 to 24', 82, 'Highest affinity for the comps and the studio'),
        A(
          'au2',
          'Survival crafting fans 25 to 34',
          79,
          'Second strongest, plays on PC and console',
        ),
        A('au3', 'Streamers and watchers 18 to 24', 64, 'Strong with the genre, plays less'),
        A('au4', 'Console players 25 to 34', 58, 'Follows the studio more than the genre'),
        A('au5', 'Story game fans 25 to 34', 47, 'Low overlap with the comps'),
        A('au6', 'Casual mobile players 35 and over', 26, 'Lowest overlap with the comps'),
      ],
      assumptions: [
        AS(
          'as1',
          'Co op survival fans are the core audience',
          'holds',
          'Affinity 82, a 3 point lead over survival crafting fans.',
          '',
          'demo',
          'co op players 18 to 24 = 82, survival crafting fans = 79',
        ),
        AS(
          'as2',
          'The United States is the lead region',
          'weak',
          'Lift in the US is 1.3. Brazil is 1.7.',
          'Test Brazil as a lead region before you commit store page and creator spend.',
          'geo',
          'lift(US) = 1.3, lift(Brazil) = 1.7',
        ),
        AS(
          'as3',
          'A collab with Hoshi Studio reaches new players',
          'holds',
          'Fan overlap with Hoshi Studio is 82.',
          '',
          'cmp',
          `overlap(Hoshi Studio fans, ${r.name} players) = 82`,
        ),
        AS(
          'as4',
          'Streamer promotion reaches the core audience',
          'holds',
          'Audience overlap with the creators is 80.',
          '',
          'pod',
          'overlap(creators, core players) = 80',
        ),
        AS(
          'as5',
          'Japan can reuse the US plan',
          'breaks',
          'The best matching group in Japan is console players 25 to 34. Co op players 18 to 24 rank third.',
          'Build a separate Japan plan with its own store page and creators.',
          'geo',
          'top segment, Japan = console players 25 to 34',
          true,
        ),
        AS(
          'as6',
          'Wishlists will convert to purchases at the planned rate',
          'cant',
          'Taste data cannot say how many wishlists convert.',
          '',
          'none',
          'no Qloo data covers wishlists or sales',
        ),
        AS(
          'as7',
          'The Arcade Cinema Club tie in is worth the spend',
          'weak',
          'Fan overlap is 44. Two other tie ins score above 75.',
          'Skip it, or run it as a small cross promotion.',
          'cmp',
          'overlap(Arcade Cinema Club fans, players) = 44',
          true,
        ),
      ],
      s1: [
        F('s1a', 'Hoshi Studio (anime)', 82, 'Fan overlap 82', 'cmp'),
        F('s1b', 'Pale Static (music)', 57, 'Fan overlap 57', 'cmp'),
        F('s1c', 'Arcade Cinema Club (film)', 44, 'Fan overlap 44', 'cmp'),
      ],
      s2: [
        F('s2a', 'Wren Plays (creator)', 86, 'Audience overlap 86', 'pod'),
        F('s2b', 'Basecamp Co op (creator)', 80, 'Audience overlap 80', 'pod'),
        F('s2c', 'Late Night Loot (creator)', 64, 'Audience overlap 64', 'pod'),
      ],
      s3: [
        F('s3a', c[0] ?? 'Tidal Hollow', 84, 'Player overlap 84', 'cmp'),
        F('s3b', c[1] ?? 'Cairn Keepers', 76, 'Player overlap 76', 'cmp'),
        F('s3c', 'Brightfield Farm', 41, 'Player overlap 41. Not recommended.', 'cmp'),
      ],
      s4: [
        F('s4a', 'Summer Co op Showcase', 81, 'Audience overlap 81', 'geo'),
        F('s4b', 'Gamescom floor', 69, 'Audience overlap 69', 'geo'),
        F('s4c', 'Tokyo Indie Day', 64, 'Audience overlap 64. Lower confidence.', 'geo'),
      ],
      places: placesFor(r),
      fan: [
        {
          id: 'fn1',
          name: 'Anime fans',
          before: 38,
          after: 38,
          ev: 'Fan overlap 38 with the core audience',
        },
        {
          id: 'fn2',
          name: 'Music fans',
          before: 61,
          after: 61,
          ev: 'Fan overlap 61 with the core audience',
        },
        {
          id: 'fn3',
          name: 'Film fans',
          before: 44,
          after: 44,
          ev: 'Fan overlap 44 with the core audience',
        },
      ],
      weeks: ['Nov 21', 'Nov 28', 'Dec 5', 'Dec 12'],
      dates: [
        {
          id: 'da1',
          date: 'Nov 28',
          wk: 1,
          rival: 'Cairn Keepers 2',
          overlap: 89,
          rec: 'High overlap, risky',
        },
        { id: 'da2', date: 'Dec 5', wk: 2, rival: 'Winter Forge', overlap: 34, rec: 'Low overlap' },
        {
          id: 'da3',
          date: 'Dec 12',
          wk: 3,
          rival: 'Hollow Sky, beta',
          overlap: 71,
          rec: 'Moderate',
        },
      ],
      chosenDate: 'Dec 5',
      partners: [
        {
          id: 'pb1',
          name: 'Hoshi Studio (anime)',
          type: 'Collab',
          fits: 'Co op players 18 to 24',
          ev: 'Fan overlap 82, shared interest in co op worlds',
          k: 'cmp',
          draft: `Subject: A crossover for ${r.name}\n\nHi Hoshi team,\n\nYour fans and our players overlap strongly (82). We would like to talk about an in game crossover for launch month. Evidence is attached.\n\nBest,\nThe Quayside team\n\n(Draft only. Oraqul does not send it.)`,
        },
        {
          id: 'pb2',
          name: 'Wren Plays (creator)',
          type: 'Creator',
          fits: 'Co op players 18 to 24',
          ev: 'Audience overlap 86',
          k: 'pod',
          draft: `Subject: Early access to ${r.name}\n\nHi Wren,\n\nYour audience overlaps strongly with who we think ${r.name} is for (86). We would like to offer early access and a co op session with the team.\n\nBest,\nThe Quayside team\n\n(Draft only. Oraqul does not send it.)`,
        },
      ],
      risks: [
        RK(
          'rk1',
          'The US is not the lead region',
          'Wishlists from Brazil pass US wishlists in the first week',
          'Run the Brazil lead scenario',
        ),
        RK(
          'rk2',
          'A rival co op game launches the same week',
          'Cairn Keepers 2 holds its Nov 28 date',
          'Hold the launch to Dec 5',
        ),
        RK(
          'rk3',
          'The film tie in is weaker than planned',
          'The Arcade Cinema Club audience reacts flat',
          'Skip it',
        ),
      ],
      cannot: [
        CN(
          'cn1',
          'Wishlists and sales',
          'Qloo has no store or sales data. You supply these numbers.',
        ),
        CN(
          'cn2',
          'Player counts and retention',
          'Qloo has no player behaviour data. You supply these numbers.',
        ),
        CN(
          'cn3',
          'Anchors for Japan and Brazil',
          `${r.name} is not in Qloo yet, so these regions are read from the studio and comps. If few of them are known there, the line is a draft.`,
        ),
      ],
      course: null,
      results: null,
    };
    if (!r.places.includes('Japan')) B.assumptions = B.assumptions.filter((x) => x.id !== 'as5');
    if (!r.places.includes('Japan') && !r.places.includes('Brazil')) {
      B.cannot = B.cannot.filter((x) => x.id !== 'cn3');
    }
    return B;
  },
  scen: [
    {
      id: 'anime',
      label: 'An anime collaboration is added',
      re: /anime|collab/,
      apply(b) {
        for (const g of b.fan ?? []) {
          if (g.id === 'fn1') {
            g.after = 82;
            g.note = 'Rises with the collab';
          }
          if (g.id === 'fn2') g.after = 57;
          if (g.id === 'fn3') g.after = 68;
        }
        const a = assumption(b, 'as1');
        if (a) {
          a.why =
            'With the anime collab, anime fans join the core audience. Affinity for the core stays 82, and the audience grows.';
        }
        b.assumptions.push(
          AS(
            'as8',
            'Anime fans become a second audience',
            'holds',
            'Fan overlap rises from 38 to 82 once the collab is live.',
            '',
            'cmp',
            'overlap(anime fans, players) = 38 before, 82 after',
          ),
        );
        const first = b.s1[0];
        if (first) first.note = 'Chosen for the collab';
        b.risks.push(
          RK(
            'rk4',
            'The collab slips past launch',
            'Hoshi Studio has not signed by Nov 10',
            'Launch without it and add the collab as a post launch update',
          ),
        );
      },
    },
    {
      id: 'brazil',
      label: 'Brazil becomes the lead region',
      re: /brazil|lead|region/,
      apply(b) {
        const a = assumption(b, 'as2');
        if (a) {
          a.verdict = 'holds';
          a.text = 'Brazil is the lead region';
          a.why = 'Lift in Brazil is 1.7, the strongest of the four regions.';
          a.fix = '';
        }
        const p = b.places.find((x) => x.name === 'Brazil');
        if (p) {
          p.note = 'Chosen as the lead region';
          p.conf = 'medium';
        }
        b.s2.push(F('s2d', 'Rota Co op (creator)', 78, 'Audience overlap 78 in Brazil', 'pod'));
        b.risks.push(
          RK(
            'rk4',
            'Brazil store page is not localised',
            'The page is English only at launch',
            'Localise the store page before launch',
          ),
        );
      },
    },
    {
      id: 'streamer',
      label: 'Streamer promotion is dropped',
      re: /streamer|creator|promo/,
      apply(b) {
        const a = assumption(b, 'as4');
        if (a) {
          a.verdict = 'weak';
          a.why =
            'Without creators, the streamers and watchers group (64) loses its route to the game.';
          a.fix = 'Keep one creator and add an in game share feature.';
        }
        for (const s of b.s2) s.note = 'Dropped from the plan';
      },
    },
  ],
  fix(b, g) {
    const a2 = assumption(b, 'as2');
    if (a2) {
      a2.verdict = 'breaks';
      a2.why = `${g.W} delivered ${g.wa} percent of wishlists against ${g.wp} planned. ${g.B} delivered ${g.ba} percent.`;
      a2.fix = `Make ${g.B} the lead region for launch month.`;
    }
    b.assumptions.push(
      AS(
        'as8',
        `${g.B} is a second core region`,
        'holds',
        `${g.B} delivered ${g.ba} percent against ${g.bp} planned. Lift there is 1.7.`,
        '',
        'geo',
        `actual share(${g.B}) = ${g.ba}`,
      ),
    );
    const worst = b.places.find((p) => p.name === g.W);
    const best = b.places.find((p) => p.name === g.B);
    if (worst) worst.note = 'Underdelivered against the plan.';
    if (best) {
      best.lift = 1.9;
      best.note = 'Overdelivered. Make it the lead region.';
    }
    b.s2.push(F('s2d', 'Rota Co op (creator)', 82, `Audience overlap 82 in ${g.B}`, 'pod'));
    b.s4.push(F('s4d', 'Brazil Games Week', 79, 'Audience overlap 79', 'geo'));
    b.course = {
      summary: `The plan assumed ${g.W} would lead with ${g.wp} percent of wishlists. It delivered ${g.wa} percent, and ${g.B} delivered ${g.ba}. Players like the game, so the miss is about where they are.`,
      actions: [
        `Make ${g.B} the lead region for launch month.`,
        `Localise the store page for ${g.B} first.`,
        'Add Rota Co op as the lead creator.',
        `Move part of the ${g.W} creator spend to ${g.B}.`,
      ],
      territories: ['Japan: hold spend until the first week of wishlists shows the split.'],
      stop: [`Stop the ${g.W} only store promotion.`, 'Stop the Arcade Cinema Club tie in.'],
    };
  },
  auditFix(b) {
    const a = assumption(b, 'as7');
    if (a) {
      a.verdict = 'breaks';
      a.why =
        'Fan overlap is 44, and the plan puts the largest cross promotion budget here. Two other tie ins score above 75.';
    }
    return {
      as1: 'Plan, p. 1',
      as2: 'Plan, p. 2',
      as3: 'Plan, p. 3',
      as4: 'Plan, p. 3',
      as5: 'Not written in the plan',
      as6: 'Plan, p. 4',
      as7: 'Plan, p. 5',
    };
  },
};
