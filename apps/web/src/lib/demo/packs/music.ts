import { A, AS, assumption, CN, F, fitArr, RK } from '../brief';
import { placeRow, placesFor } from '../places';
import type { DBrief, DemoPack } from '../types';

const SUPPORT = 'Nia Okoro';
const GRID: Record<string, [number, number, number]> = {
  London: [1.1, 1.6, 1.3],
  Toronto: [0.9, 1.5, 1.4],
  'Mexico City': [0.8, 1.3, 1.5],
  Austin: [0.9, 1.2, 1.2],
  Seoul: [0.8, 1.1, 1.3],
  Chicago: [1.0, 1.3, 1.2],
};
const gridVal = (city: string, i: 0 | 1 | 2): number => GRID[city]?.[i] ?? 1;

export const music: DemoPack = {
  id: 'music',
  name: 'Music',
  short: 'Music',
  blurb: 'Releases and tours, planned city by city.',
  noun: 'artist',
  fallback: 'similar artists',
  tools: ['Tour route', 'Support act matcher', 'Sponsor brief'],
  cov: {
    tests: [
      'Audience fit by listener type, age and city',
      'Tour route, as lift for each stop',
      'Support acts compared across the route cities',
    ],
    thin: [
      'Venues and promoters. Oraqul has no venue data',
      'New artists with a small catalogue. The read leans on sound alike artists and tags',
    ],
    none: ['Streams, ticket sales and pricing. You supply them for a fix.'],
  },
  fields: [
    ['Format', 'kind'],
    ['Genre', 'genre'],
    ['Headliner', 'lead'],
    ['Similar artists', 'comps'],
    ['Route cities', 'places'],
    ['Window', 'window'],
  ],
  kinds: ['Tour', 'Album', 'EP', 'Single'],
  placeLabel: 'route cities',
  placeOpts: ['London', 'Austin', 'Toronto', 'Mexico City', 'Chicago'],
  files: { plan: 'tour-plan.xlsx', res: 'streams-and-tickets.csv' },
  descHint:
    'Describe the release or tour: artist, genre, similar artists, cities, window. Paste or attach anything you already have, such as a tour plan or ticket numbers.',
  matchOpts: (n) => [
    { v: `${n} (artist)`, l: `${n} (artist)`, d: 'Indie pop · 41k listeners in Qloo' },
    { v: `${n} (band)`, l: `${n} (band)`, d: 'Indie rock · low confidence' },
  ],
  q2: {
    prompt: 'What venue size are you planning for?',
    opts: ['Clubs under 1,000', 'Theatres 1,000 to 3,000', 'Arenas over 3,000'],
    label: 'Venue size',
  },
  sec: [
    { k: 's1', t: 'Support acts', one: 'Support act' },
    { k: 's2', t: 'Sponsor brands', one: 'Sponsor brand' },
    { k: 's3', t: 'Playlists and radio', one: 'Playlist or station' },
    { k: 's4', t: 'Local press and creators', one: 'Local press or creator' },
  ],
  sigTabs: [
    ['route', 'Tour route'],
    ['supportacts', 'Support acts'],
  ],
  planNote: 'Ranked by fit, 0 to 100. 75 and above is recommended.',
  dateLabel: 'Rival release check',
  dateTitle: 'Rival release check',
  partnerLabel: 'Sponsor brief',
  partnerWord: 'sponsor',
  rivalWord: 'rival release',
  quick: ['Check rival releases', 'Add streams and tickets', 'Draft a sponsor brief'],
  noFc: {
    re: /streams?\b|ticket sales|sell out|sell through|forecast|predict|how many tickets/,
    msg: "I can't forecast streams or ticket sales. Qloo has no stream or ticket data. I can test which cities and support acts fit the audience. If you share your own numbers, I can use them as inputs.",
  },
  noFcWhat: 'stream or ticket numbers',
  mv: [
    ['s1', 'Book {n} as the support act (fit {f}).'],
    ['s2', 'Partner with {n} (fit {f}).'],
    ['s3', 'Pitch {n} (fit {f}).'],
  ],
  lead: (b) =>
    `Lead with ${b.audience[0]?.name ?? 'the core audience'} and open in ${b.places[0]?.name ?? 'your top city'}.`,
  trace: {
    build: [
      'Resolving the artist to Qloo entities',
      'Building the audience by listener type, age and city',
      'Listing the assumptions, stated and unstated',
      'Testing each assumption: holds, weak, breaks, cannot test',
      'Computing lift over a neutral audience for each route city',
      'Comparing support acts across the cities',
      'Red teaming the route from the opposite seed',
      'Packaging the brief with a receipt on every line',
    ],
    audit: [
      'Reading the tour plan',
      'Extracting the assumptions, stated and unstated',
      'Resolving the artist, support acts and brands to Qloo entities',
      'Computing lift for each city in one ranking call',
      'Searching for better support acts and cities for the ones that break',
      'Red teaming the fixes from the opposite seed',
      'Packaging the audit with a receipt on every line',
    ],
    date: [
      'Reading the rival release and tour dates',
      'Measuring shared audience with each rival artist',
      'Ranking the weeks by overlap',
      'Packaging the check with a receipt per rival',
    ],
    partner: [
      'Finding sponsors that fit the target listeners',
      'Checking affinity for each candidate',
      'Drafting the brief with the evidence attached',
    ],
    fix: [
      'Reading the ticket and stream numbers by city',
      'Comparing where the audience showed up with where the plan put them',
      'Finding which assumption broke',
      'Searching for cities, support acts and brands that fit the real audience',
      'Red teaming the new route from the opposite seed',
      'Writing the course correction for the remaining dates',
    ],
  },
  res: {
    dateLabel: 'First show date',
    aTitle: 'Audience by city',
    aNoun: 'city',
    aLabels: (r) => r.places.slice(),
    planned: (r) => fitArr([28, 24, 14, 26, 8], r.places.length),
    demoA: (r) => fitArr([34, 14, 22, 24, 6], r.places.length),
    tTitle: 'Audience by age',
    tLabels: () => ['Under 25', '25 to 34', '35 to 44', '45 and over'],
    demoT: () => [18, 41, 28, 13],
    holdLabel: 'Tickets sold as a percent of capacity',
    holdShort: 'Sell through',
    holdSub: 'of capacity sold',
    holdDefault: 71,
    confirmRows: [
      ['First show', 'Nov 14'],
      ['Source', 'Ticket and stream report'],
    ],
    chartA: 'Planned against actual audience by city',
    chartSub: 'Percent of ticket buyers by city.',
    chartT: 'Audience by age',
    head: (_b, g) =>
      `Where people showed up was not where the plan put them. ${g.W} delivered ${g.wa} percent against ${g.wp} planned, and ${g.B} delivered ${g.ba} percent.`,
    stats: (_b, g) => [
      { l: `${g.W}, planned`, v: `${g.wp}%` },
      { l: 'Actual', v: `${g.wa}%` },
      { l: `${g.B}, actual`, v: `${g.ba}%` },
    ],
  },
  base(r) {
    const who = r.lead || 'the headliner';
    const pl = placesFor(r);
    const hasAustin = pl.some((p) => p.name === 'Austin');
    const cols = pl.slice(0, 3).map((p) => p.name);
    const B: DBrief = {
      aLabels: r.places.slice(),
      planned: fitArr([28, 24, 14, 26, 8], r.places.length),
      audience: [
        A('au1', 'Superfans 25 to 34', 86, `Highest affinity for ${who} and similar artists`),
        A('au2', 'Genre fans 25 to 34', 78, 'Strong in London, Toronto and Chicago'),
        A('au3', 'Indie pop listeners 18 to 24', 72, 'Streams heavily, buys fewer tickets'),
        A('au4', 'Gig goers 25 to 44', 66, 'Overlaps with the support act audiences'),
        A('au5', 'Casual listeners 35 to 54', 41, 'Low overlap with similar artists'),
        A(
          'au6',
          'Playlist only listeners 18 to 24',
          38,
          'Does not follow the artist, only the playlists',
        ),
      ],
      assumptions: [
        AS(
          'as1',
          'Superfans 25 to 34 are the core audience',
          'holds',
          'Affinity 86, an 8 point lead over genre fans.',
          '',
          'demo',
          'superfans 25 to 34 = 86, genre fans = 78',
        ),
        AS(
          'as2',
          'Austin will be the biggest US city',
          'breaks',
          'Lift in Austin is 1.1. Toronto is 1.5 and Chicago is 1.5.',
          'Swap Austin for Chicago, or move Toronto earlier in the route.',
          'geo',
          'lift(Austin) = 1.1, lift(Toronto) = 1.5',
        ),
        AS(
          'as3',
          `${SUPPORT} is the right support act`,
          'weak',
          'Her lift is 1.1 in London and 0.9 in Toronto. Two other acts score above 1.3 in every city.',
          'Test Tomas Marlow or Sadie Kline as the support act.',
          'cmp',
          'lift(support acts) across London, Toronto, Mexico City',
        ),
        AS(
          'as4',
          'Pulse Energy is a good sponsor',
          'holds',
          'Brand affinity with superfans is 81.',
          '',
          'brand',
          'brand affinity(Pulse Energy, superfans) = 81',
        ),
        AS(
          'as5',
          'The Mexico City date can reuse the London plan',
          'weak',
          'Mexico City listeners lean 18 to 34 and Indie pop first. Few comparable artists were found for Mexico City.',
          'Build a Mexico City plan on its own and treat it as a draft.',
          'geo',
          'top segment, Mexico City = 18 to 34',
          true,
        ),
        AS(
          'as6',
          'Tickets will sell through at the planned venue size',
          'cant',
          'Taste data cannot say how many tickets will sell.',
          '',
          'none',
          'no Qloo data covers ticket sales',
        ),
        AS(
          'as7',
          'The Naija Heat playlist reaches the target listeners',
          'holds',
          'Listener overlap is 87.',
          '',
          'pod',
          'playlist overlap(Naija Heat) = 87',
        ),
      ],
      s1: [
        F(
          's1a',
          'Tomas Marlow',
          88,
          'Lift 1.6 in London, 1.5 in Toronto, 1.3 in Mexico City',
          'cmp',
        ),
        F(
          's1b',
          'Sadie Kline',
          85,
          'Lift 1.3 in London, 1.4 in Toronto, 1.5 in Mexico City',
          'cmp',
        ),
        F('s1c', SUPPORT, 58, 'Lift 1.1 in London, 0.9 in Toronto, 0.8 in Mexico City', 'cmp'),
      ],
      s2: [
        F('s2a', 'Pulse Energy', 81, 'Affinity 81 with superfans', 'brand'),
        F('s2b', 'Loom & Co', 73, 'Affinity 73 with genre fans', 'brand'),
        F('s2c', 'Sonar Headphones', 68, 'Affinity 68 with gig goers', 'brand'),
        F('s2d', 'Ledger Bank', 41, 'Affinity 41 with the core group', 'brand'),
      ],
      s3: [
        F('s3a', 'Naija Heat (playlist)', 87, 'Listener overlap 87', 'pod'),
        F('s3b', 'Mexico City to London (playlist)', 80, 'Listener overlap 80', 'pod'),
        F('s3c', 'Indie Pop Now (radio)', 74, 'Listener overlap 74', 'pod'),
        F('s3d', 'Late Night Rotation (radio)', 61, 'Listener overlap 61', 'pod'),
      ],
      s4: [
        F('s4a', 'The Groove Letter (newsletter)', 79, 'Reader overlap 79', 'pod'),
        F('s4b', 'Marisol Vega (creator)', 77, 'Audience overlap 77', 'pod'),
        F('s4c', 'City Notes London (online press)', 69, 'Reader overlap 69', 'pod'),
      ],
      places: pl,
      grid: {
        cols,
        rows: [
          { id: 'g1', name: SUPPORT, tag: 'Planned', vals: cols.map((n) => gridVal(n, 0)) },
          {
            id: 'g2',
            name: 'Tomas Marlow',
            tag: 'Suggested by Oraqul',
            vals: cols.map((n) => gridVal(n, 1)),
          },
          {
            id: 'g3',
            name: 'Sadie Kline',
            tag: 'Suggested by Oraqul',
            vals: cols.map((n) => gridVal(n, 2)),
          },
        ],
      },
      weeks: ['Oct 17', 'Oct 24', 'Oct 31', 'Nov 7'],
      dates: [
        {
          id: 'da1',
          date: 'Oct 17',
          wk: 0,
          rival: 'Kemi Adu, new album',
          overlap: 88,
          rec: 'High overlap, risky',
        },
        {
          id: 'da2',
          date: 'Oct 24',
          wk: 1,
          rival: 'Dele Banjo, single',
          overlap: 31,
          rec: 'Low overlap',
        },
        {
          id: 'da3',
          date: 'Oct 31',
          wk: 2,
          rival: 'Sadie Kline, tour announcement',
          overlap: 77,
          rec: 'Moderate',
        },
      ],
      chosenDate: 'Oct 17',
      partners: [
        {
          id: 'pb1',
          name: 'Pulse Energy',
          type: 'Sponsor brand',
          fits: 'Superfans 25 to 34',
          ev: 'Brand affinity 81, shared interest in nightlife and sport',
          k: 'brand',
          draft: `Subject: Sponsoring the ${r.name}\n\nHi Pulse Energy team,\n\nWe are touring ${r.name} across ${r.places.join(', ')} and your audience looks very close to ours: brand affinity of 81 among superfans aged 25 to 34.\n\nWe would like to talk about a title sponsorship for the London and Toronto dates. Evidence is attached.\n\nBest,\nThe Kora tour team\n\n(Draft only. Oraqul does not send it.)`,
        },
        {
          id: 'pb2',
          name: 'Tomas Marlow (support act)',
          type: 'Support act',
          fits: 'Superfans and genre fans',
          ev: 'Lift above 1.3 in every route city',
          k: 'cmp',
          draft: `Subject: Joining the ${r.name}\n\nHi Tomas,\n\nYour audience overlaps strongly with ours in every city on the route (lift above 1.3). We would like to invite you to support on the full run.\n\nBest,\nThe Kora tour team\n\n(Draft only. Oraqul does not send it.)`,
        },
      ],
      risks: [
        RK(
          'rk1',
          'Austin underdelivers',
          'Austin presales below 60 percent of capacity two weeks out',
          'Swap Austin for Chicago',
        ),
        RK(
          'rk2',
          'The support act adds no tickets',
          'Presales do not move after the support act is announced',
          'Announce Tomas Marlow or Sadie Kline',
        ),
        RK(
          'rk3',
          'The rival album takes the listening week',
          'Kemi Adu holds Oct 17',
          'Move the release to Oct 24',
        ),
      ],
      cannot: [
        CN(
          'cn1',
          'Ticket sales and sell through',
          'Qloo has no ticket data. You supply these numbers.',
        ),
        CN('cn2', 'Stream counts', 'Qloo has no stream data. You supply these numbers.'),
        CN(
          'cn3',
          'Venue availability and pricing',
          'Qloo has no venue or pricing data. Premium tolerance is shown as a taste proxy only.',
        ),
      ],
      course: null,
      results: null,
    };
    if (!hasAustin) B.assumptions = B.assumptions.filter((x) => x.id !== 'as2');
    if (!r.places.includes('Mexico City'))
      B.assumptions = B.assumptions.filter((x) => x.id !== 'as5');
    return B;
  },
  scen: [
    {
      id: 'swap',
      label: 'Austin is replaced by Chicago',
      re: /austin|chicago|swap|city/,
      apply(b) {
        const i = b.places.findIndex((p) => p.name === 'Austin');
        const houston = b.places[i];
        if (houston) {
          const atlanta = placeRow('music', 'Chicago', houston.id);
          if (atlanta) b.places[i] = atlanta;
        }
        const x = assumption(b, 'as2');
        if (x) {
          x.verdict = 'holds';
          x.why = 'With Chicago in the route, lift for the second US stop is 1.5.';
          x.fix = '';
          x.text = 'The second US city is Chicago';
        }
        b.risks.push(
          RK(
            'rk4',
            'Chicago dates are not yet held',
            'Venue holds are not confirmed by Oct 25',
            'Hold Chicago and Austin together until one clears',
          ),
        );
      },
    },
    {
      id: 'support',
      label: 'The support act is changed to Tomas Marlow',
      re: /support|opener|act/,
      apply(b) {
        const x = assumption(b, 'as3');
        if (x) {
          x.verdict = 'holds';
          x.text = 'Tomas Marlow is the right support act';
          x.why = 'Lift is 1.6 in London, 1.5 in Toronto and 1.3 in Mexico City.';
          x.fix = '';
        }
        for (const row of b.grid?.rows ?? []) {
          if (row.name === 'Tomas Marlow') row.tag = 'Chosen';
          else if (row.tag === 'Planned') row.tag = 'Dropped';
        }
        for (const s of b.s1) if (s.id === 's1a') s.note = 'Chosen';
      },
    },
    {
      id: 'price',
      label: 'Ticket prices rise by 20 percent',
      re: /price|premium|expensive|cost/,
      apply(b) {
        b.assumptions.push(
          AS(
            'as8',
            'The audience will pay 20 percent more',
            'weak',
            'Premium tolerance, as a taste proxy, is 1.2 for superfans and 0.9 for playlist only listeners. Qloo cannot say what people will pay.',
            'Test the price with a small presale before you commit.',
            'demo',
            'premium tolerance (taste proxy) = 1.2 superfans, 0.9 playlist only',
          ),
        );
        b.risks.push(
          RK(
            'rk4',
            'A price rise cools the younger crowd',
            'Presales from listeners under 25 fall in week one',
            'Hold a lower priced block for under 25s',
          ),
        );
      },
    },
  ],
  fix(b, g) {
    const a2 = assumption(b, 'as2') ?? assumption(b, 'as1');
    if (a2) {
      a2.verdict = 'breaks';
      a2.why = `${g.W} delivered ${g.wa} percent against ${g.wp} planned. ${g.B} delivered ${g.ba} percent.`;
      a2.fix = `Move the next date toward ${g.B}.`;
    }
    b.assumptions.push(
      AS(
        'as9',
        `${g.B} is a second anchor city`,
        'holds',
        `${g.B} delivered ${g.ba} percent against ${g.bp} planned. Lift for the audience there is 1.5.`,
        '',
        'geo',
        `actual share(${g.B}) = ${g.ba}`,
      ),
    );
    const worst = b.places.find((p) => p.name === g.W);
    const best = b.places.find((p) => p.name === g.B);
    if (worst) {
      worst.lift = 1.0;
      worst.note = 'Underdelivered against the plan.';
    }
    if (best) {
      best.lift = 1.6;
      best.note = 'Overdelivered. Add a second date.';
    }
    if (!b.places.some((p) => p.name === 'Chicago')) {
      const atlanta = placeRow('music', 'Chicago', 'pl9');
      if (atlanta) b.places.push(atlanta);
    }
    b.s2.push(
      F(
        's2e',
        `Loom & Co pop up in ${g.B}`,
        79,
        'Affinity 79 with the audience that showed up',
        'brand',
      ),
    );
    b.s4.push(F('s4d', `The ${g.B} Sessions (creator)`, 76, 'Audience overlap 76', 'pod'));
    b.course = {
      summary: `The plan assumed ${g.W} would deliver ${g.wp} percent of the audience. It delivered ${g.wa} percent, and ${g.B} delivered ${g.ba}. The show was liked, so the miss is about where the audience lives.`,
      actions: [
        `Swap the remaining ${g.W} date for Chicago.`,
        `Add a second ${g.B} date in the same week.`,
        'Announce Tomas Marlow as the support act for the remaining dates.',
        `Move the Pulse Energy activation to ${g.B}.`,
      ],
      territories: [
        `Chicago: hold a date for the week after ${g.B}.`,
        'Mexico City: hold spend until the first show shows the split.',
      ],
      stop: [`Stop paid social aimed at ${g.W}.`, 'Stop the Ledger Bank tie in.'],
    };
  },
  auditFix(b) {
    const a = assumption(b, 'as3');
    if (a) {
      a.verdict = 'breaks';
      a.why =
        'Her lift is below 1.1 in every route city, and the plan puts the whole support slot here.';
    }
    return {
      as1: 'Plan, tab 1',
      as2: 'Plan, tab 2',
      as3: 'Plan, tab 2',
      as4: 'Plan, tab 3',
      as5: 'Not written in the plan',
      as6: 'Plan, tab 1',
      as7: 'Plan, tab 4',
    };
  },
};
