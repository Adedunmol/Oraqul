import { A, AS, assumption, CN, F, fitArr, fitIn, RK, topFit } from '../brief';
import { placesFor } from '../places';
import type { DBrief, DemoPack } from '../types';

export const podcasts: DemoPack = {
  id: 'podcasts',
  name: 'Podcasts',
  short: 'Podcasts',
  blurb: 'Shows, guests and sponsors, planned around the listener.',
  noun: 'show',
  fallback: 'hosts and comp shows',
  tools: ['Topic map', 'Guest ranker', 'Sponsor brief'],
  cov: {
    tests: [
      'Listener audience by age and place',
      'Topic map, as tags rival shows do not own',
      'Guests and sponsors ranked by listener overlap',
    ],
    thin: [
      'New shows, planned from the hosts and comp shows',
      'Niche topics, planned from the closest comparable shows',
    ],
    none: ['Downloads, retention and ad revenue. You supply them for a fix'],
  },
  fields: [
    ['Format', 'kind'],
    ['Topic', 'genre'],
    ['Hosts', 'lead'],
    ['Comp shows', 'comps'],
    ['Markets', 'places'],
    ['Window', 'window'],
  ],
  kinds: ['New show', 'Season launch', 'Season two', 'Relaunch'],
  placeLabel: 'markets',
  placeOpts: ['UK', 'US', 'Canada', 'Mexico'],
  files: { plan: 'growth-plan.pdf', res: 'dashboard-export.csv' },
  descHint:
    'Describe the show: topic, hosts, comp shows, markets, launch window. Paste or attach anything you already have, such as a growth plan or a dashboard export.',
  matchOpts: (n) => [
    { v: `${n} (podcast)`, l: `${n} (podcast)`, d: 'Food and culture · 12k listeners in Qloo' },
    { v: `${n} (radio)`, l: `${n} (radio)`, d: 'Talk radio · low confidence' },
  ],
  q2: {
    prompt: 'How are you planning to grow?',
    opts: ['Paid ads', 'Cross promotion with other shows', 'Press and guests'],
    label: 'Growth plan',
  },
  sec: [
    { k: 's1', t: 'Guests', one: 'Guest' },
    { k: 's2', t: 'Sponsors', one: 'Sponsor' },
    { k: 's3', t: 'Cross promotion shows', one: 'Cross promotion show' },
    { k: 's4', t: 'Newsletters and press', one: 'Newsletter or press' },
  ],
  sigTabs: [['topics', 'Topic map']],
  planNote: 'Ranked by fit, 0 to 100. 75 and above is recommended.',
  dateLabel: 'Rival show check',
  dateTitle: 'Rival show check',
  partnerLabel: 'Sponsor brief',
  partnerWord: 'sponsor',
  rivalWord: 'rival show',
  quick: ['Check rival shows', 'Add downloads', 'Draft a sponsor brief'],
  noFc: {
    re: /downloads?\b|listeners will|forecast|predict|how many listeners|revenue/,
    msg: "I can't forecast downloads or ad revenue. Qloo has no download data. I can test who the show reaches and which guests and sponsors fit. If you share your dashboard export, I can use it as input.",
  },
  noFcWhat: 'download numbers',
  mv: [
    ['s1', 'Book {n} first (fit {f}).'],
    ['s2', 'Sponsor with {n} (fit {f}).'],
    ['s3', 'Swap episodes with {n} (fit {f}).'],
  ],
  lead: (b) =>
    `Lead with ${b.audience[0]?.name ?? 'the core listeners'} and book ${topFit(b.s1)?.name ?? 'the top guest'} first.`,
  trace: {
    build: [
      'Resolving the show to Qloo entities. Not found, falling back to hosts and comp shows',
      'Building the listener audience by age and place',
      'Mapping topics against rival shows',
      'Listing the assumptions, stated and unstated',
      'Testing each assumption: holds, weak, breaks, cannot test',
      'Ranking guests, sponsors and cross promotion shows',
      'Red teaming the winner from the opposite seed',
      'Packaging the brief with a receipt on every line',
    ],
    audit: [
      'Reading the growth plan',
      'Extracting the assumptions, stated and unstated',
      'Resolving shows, guests and sponsors to Qloo entities',
      'Testing each assumption: holds, weak, breaks, cannot test',
      'Searching for better options for the ones that break',
      'Red teaming the fixes from the opposite seed',
      'Packaging the audit with a receipt on every line',
    ],
    date: [
      'Reading the rival show launches',
      'Measuring shared listeners with each rival show',
      'Ranking the weeks by overlap',
      'Packaging the check with a receipt per rival',
    ],
    partner: [
      'Finding sponsors that fit the target listeners',
      'Checking affinity for each candidate',
      'Drafting the brief with the evidence attached',
    ],
    fix: [
      'Reading the dashboard export: age, region, retention',
      'Comparing who listens with who the plan assumed',
      'Finding which assumption broke',
      'Mapping topics, guests and sponsors that fit the real audience',
      'Red teaming the relaunch from the opposite seed',
      'Writing the relaunch plan for the next episodes',
    ],
  },
  res: {
    dateLabel: 'Season start',
    aTitle: 'Listeners by age',
    aNoun: 'age group',
    aLabels: () => ['18 to 24', '25 to 34', '35 to 44', '45 and over'],
    planned: () => [20, 45, 20, 15],
    demoA: () => [12, 24, 38, 26],
    tTitle: 'Listeners by market',
    tLabels: (r) => [...r.places, 'Other'],
    demoT: (r) => fitArr([22, 41, 9, 28], r.places.length + 1),
    holdLabel: 'Episode 3 listeners as a percent of episode 1',
    holdShort: 'Episode 3',
    holdSub: 'of episode 1 listeners kept',
    holdDefault: 52,
    confirmRows: [
      ['Season start', 'Sep 4'],
      ['Source', 'Dashboard export'],
    ],
    chartA: 'Planned against actual listeners by age',
    chartSub: 'Percent of listeners in the first month by age group.',
    chartT: 'Listeners by market',
    head: (_b, g) =>
      `Who listens was not who the plan assumed. Aged ${g.W} was ${g.wa} percent against ${g.wp} planned, and aged ${g.B} was ${g.ba} percent.`,
    stats: (_b, g) => [
      { l: `Aged ${g.W}, planned`, v: `${g.wp}%` },
      { l: 'Actual', v: `${g.wa}%` },
      { l: `Aged ${g.B}, actual`, v: `${g.ba}%` },
    ],
  },
  base(r) {
    const c = r.comps.length ? r.comps : ['Kitchen Tongues', 'Taste of Home Radio'];
    const c0 = c[0] ?? 'Kitchen Tongues';
    const B: DBrief = {
      aLabels: ['18 to 24', '25 to 34', '35 to 44', '45 and over'],
      planned: [20, 45, 20, 15],
      audience: [
        A('au1', 'Home cooks 25 to 34', 83, 'Highest affinity for the comps and hosts'),
        A('au2', 'Travel listeners 25 to 44', 79, 'Strong with travel stories'),
        A('au3', 'Food culture fans 35 to 54', 71, 'Follows the hosts more than the topic'),
        A('au4', 'News podcast listeners 25 to 44', 52, 'Moderate overlap with the topic'),
        A('au5', 'Students 18 to 24', 44, 'Low overlap with the comps'),
        A('au6', 'Listeners 55 and over', 30, 'Lowest overlap with the comps'),
      ],
      assumptions: [
        AS(
          'as1',
          'Core listeners are home cooks aged 25 to 34',
          'holds',
          'Affinity 83, a 4 point lead over travel listeners.',
          '',
          'demo',
          'home cooks 25 to 34 = 83, travel listeners = 79',
        ),
        AS(
          'as2',
          'The UK is the lead market',
          'weak',
          'UK lift is 1.3 and US lift is 1.5.',
          'Plan a US push as large as the UK one and test it in the first month.',
          'geo',
          'lift(UK) = 1.3, lift(US) = 1.5',
        ),
        AS(
          'as3',
          'Guest Mara Quist brings listeners',
          'holds',
          'Listener overlap is 82.',
          '',
          'pod',
          'guest overlap(Mara Quist) = 82',
        ),
        AS(
          'as4',
          'Nimbus Meal Kits is a good sponsor',
          'weak',
          'Affinity with core listeners is 47. Two sponsors score above 75.',
          'Switch to Hearth Pantry (79) or keep Nimbus for a single episode.',
          'brand',
          'brand affinity(Nimbus Meal Kits, core listeners) = 47',
        ),
        AS(
          'as5',
          'The Mexico audience matches the UK audience',
          'breaks',
          'The best matching group in Mexico City is listeners 25 to 34 who follow food news. Home cooks rank third.',
          'Plan Mexico separately, with its own topics and guests.',
          'geo',
          'top segment, Mexico City = 25 to 34, food news',
          true,
        ),
        AS(
          'as6',
          'Episode three retention will hold',
          'cant',
          'Taste data cannot say whether listeners come back.',
          '',
          'none',
          'no Qloo data covers retention',
        ),
        AS(
          'as7',
          `${c0} shares few listeners with the show`,
          'weak',
          `Overlap with ${c0} is 66. Rival listeners may sample both and keep one.`,
          'Open with the topics that are only yours.',
          'cmp',
          `overlap(${c0}, ${r.name}) = 66`,
          true,
        ),
      ],
      s1: [
        F('s1a', 'Mara Quist (chef)', 82, 'Listener overlap 82', 'pod'),
        F('s1b', 'Dario Fenn (writer)', 74, 'Listener overlap 74', 'pod'),
        F('s1c', 'Ines Carvalho (photographer)', 63, 'Listener overlap 63', 'pod'),
      ],
      s2: [
        F('s2a', 'Hearth Pantry', 79, 'Affinity 79 with home cooks', 'brand'),
        F('s2b', 'Wayfarer Fares', 68, 'Affinity 68 with travel listeners', 'brand'),
        F('s2c', 'Nimbus Meal Kits', 47, 'Affinity 47 with core listeners', 'brand'),
      ],
      s3: [
        F('s3a', c[1] ?? 'Taste of Home Radio', 76, 'Listener overlap 76', 'pod'),
        F('s3b', 'Long Way Home (podcast)', 71, 'Listener overlap 71', 'pod'),
        F('s3c', c0, 66, 'Listener overlap 66. A direct rival.', 'pod'),
      ],
      s4: [
        F('s4a', 'The Pantry Letter (newsletter)', 78, 'Reader overlap 78', 'pod'),
        F('s4b', 'Migration Weekly (newsletter)', 72, 'Reader overlap 72', 'pod'),
        F('s4c', 'The Table Review (press)', 64, 'Reader overlap 64', 'pod'),
      ],
      places: placesFor(r),
      topics: [
        {
          id: 'tp1',
          name: 'travel stories',
          kind: 'distinct',
          w: 3,
          ev: "A tag with 3 times more weight in the show's audience than in rival audiences",
        },
        {
          id: 'tp2',
          name: 'home cooking',
          kind: 'distinct',
          w: 2,
          ev: 'Tag weight 2 times higher than rivals',
        },
        {
          id: 'tp3',
          name: 'family history',
          kind: 'distinct',
          w: 1,
          ev: 'Tag weight 1.4 times higher than rivals',
        },
        {
          id: 'tp4',
          name: 'restaurant culture',
          kind: 'shared',
          w: 2,
          ev: 'Equal weight in the show and its rivals',
        },
        {
          id: 'tp5',
          name: 'food news',
          kind: 'shared',
          w: 2,
          ev: 'Equal weight in the show and its rivals',
        },
        { id: 'tp6', name: 'chef interviews', kind: 'shared', w: 1, ev: 'Rivals own this tag' },
      ],
      weeks: ['Sep 4', 'Sep 11', 'Sep 18', 'Sep 25'],
      dates: [
        {
          id: 'da1',
          date: 'Sep 4',
          wk: 0,
          rival: 'Kitchen Tongues, new season',
          overlap: 86,
          rec: 'High overlap, risky',
        },
        {
          id: 'da2',
          date: 'Sep 11',
          wk: 1,
          rival: 'Dinner Hour, relaunch',
          overlap: 29,
          rec: 'Low overlap',
        },
        {
          id: 'da3',
          date: 'Sep 18',
          wk: 2,
          rival: 'Taste of Home Radio, special',
          overlap: 73,
          rec: 'Moderate',
        },
      ],
      chosenDate: 'Sep 4',
      partners: [
        {
          id: 'pb1',
          name: 'Hearth Pantry',
          type: 'Sponsor',
          fits: 'Home cooks 25 to 34',
          ev: 'Brand affinity 79, shared interest in home cooking',
          k: 'brand',
          draft: `Subject: Sponsoring ${r.name}\n\nHi Hearth Pantry team,\n\nYour customers look very close to our listeners: brand affinity of 79 among home cooks aged 25 to 34.\n\nWe would like to talk about a season sponsorship. Evidence is attached.\n\nBest,\nThe ${r.name} team\n\n(Draft only. Oraqul does not send it.)`,
        },
        {
          id: 'pb2',
          name: 'Mara Quist (guest)',
          type: 'Guest',
          fits: 'Home cooks and travel listeners',
          ev: 'Listener overlap 82',
          k: 'pod',
          draft: `Subject: A seat at ${r.name}\n\nHi Mara,\n\nYour audience overlaps strongly with our listeners (82). We would like to invite you to record an episode on food and family history.\n\nBest,\nThe ${r.name} team\n\n(Draft only. Oraqul does not send it.)`,
        },
      ],
      risks: [
        RK(
          'rk1',
          'Core listeners are older than planned',
          'The dashboard shows listeners 35 and over above 40 percent',
          'Run the older listeners scenario',
        ),
        RK(
          'rk2',
          'A rival food show launches the same month',
          'Kitchen Tongues holds its Sep 4 date',
          'Move to Sep 11',
        ),
        RK(
          'rk3',
          'The sponsor fit is weaker than planned',
          'Nimbus Meal Kits reports low code use',
          'Swap to Hearth Pantry',
        ),
      ],
      cannot: [
        CN(
          'cn1',
          'Downloads and listeners per episode',
          'Qloo has no download data. You supply these numbers.',
        ),
        CN(
          'cn2',
          'Retention and episode drop off',
          'Qloo has no listening behaviour data. You supply these numbers.',
        ),
        CN('cn3', 'Ad revenue', 'Qloo has no revenue data.'),
      ],
      course: null,
      results: null,
    };
    if (!r.places.includes('Mexico')) B.assumptions = B.assumptions.filter((x) => x.id !== 'as5');
    return B;
  },
  scen: [
    {
      id: 'older',
      label: 'Core listeners are older than planned',
      re: /older|age/,
      apply(b) {
        const a = assumption(b, 'as1');
        if (a) {
          a.verdict = 'weak';
          a.why =
            'If 35 to 44 leads, home cooks 25 to 34 keep a lead of only 3 points (83 vs 80). The core is no longer clear.';
          a.fix = 'Plan a second segment for 35 to 44 and test it before the next season.';
        }
        const s = fitIn(b.s1, 's1c');
        if (s) s.fit = 52;
        b.s1.push(
          F('s1d', 'Tunde Okafor (broadcaster)', 81, 'Listener overlap 81, older skew', 'pod'),
        );
        b.s4.push(
          F('s4d', 'The Late Table (newsletter)', 80, 'Reader overlap 80, older skew', 'pod'),
        );
        b.risks.push(
          RK(
            'rk4',
            'Older listeners need different guests',
            'Listeners 35 to 44 pass 35 percent',
            'Book Tunde Okafor and shift one slot',
          ),
        );
      },
    },
    {
      id: 'rival',
      label: 'A rival food show launches the same month',
      re: /rival|launch|month|clash/,
      apply(b) {
        b.chosenDate = 'Sep 11';
        const s = fitIn(b.s3, 's3c');
        if (s) s.note = 'Do not cross promote with a direct rival in the launch month';
        b.risks.push(
          RK(
            'rk4',
            'A rival launch splits the first week',
            'Kitchen Tongues keeps Sep 4',
            'Hold the launch to Sep 11',
          ),
        );
        const x = assumption(b, 'as7');
        if (x) {
          x.verdict = 'breaks';
          x.why =
            'With both launching in the same month, overlap of 66 means shared listeners will choose one.';
          x.fix = 'Move the launch a week and open on the topics that are only yours.';
        }
      },
    },
    {
      id: 'guest',
      label: 'The top guest cancels',
      re: /guest|cancel/,
      apply(b) {
        const a = assumption(b, 'as3');
        if (a) {
          a.verdict = 'breaks';
          a.why =
            'Without Mara Quist, the next best guest has overlap 74. The launch episode loses its lead.';
          a.fix = 'Open with Dario Fenn, and keep Mara for episode three.';
        }
        b.s1 = b.s1.filter((x) => x.id !== 's1a');
      },
    },
  ],
  fix(b, g) {
    const a1 = assumption(b, 'as1');
    if (a1) {
      a1.verdict = 'breaks';
      a1.why = `Listeners aged ${g.W} were ${g.wa} percent against ${g.wp} planned. Aged ${g.B} was ${g.ba} percent.`;
      a1.fix = 'Reposition around the older listeners and the topics only you own.';
    }
    b.assumptions.push(
      AS(
        'as8',
        `Listeners aged ${g.B} are the real core`,
        'holds',
        `They made up ${g.ba} percent. Taste overlap with travel story listeners is 81.`,
        '',
        'demo',
        `overlap(listeners ${g.B}, travel story listeners) = 81`,
      ),
    );
    const a2 = assumption(b, 'as2');
    if (a2) {
      a2.verdict = 'breaks';
      a2.why = 'The plan led with the UK. US listeners were the largest market in the dashboard.';
      a2.fix = 'Lead the relaunch in the US, then the UK.';
    }
    b.s1.push(
      F(
        's1d',
        'Tunde Okafor (broadcaster)',
        84,
        `Listener overlap 84 with listeners ${g.B}`,
        'pod',
      ),
    );
    b.s2.push(F('s2d', 'Bayline Home Insurance', 74, `Affinity 74 with listeners ${g.B}`, 'brand'));
    b.s3.push(F('s3d', 'Long Table Late (podcast)', 80, 'Listener overlap 80', 'pod'));
    b.s4.push(F('s4d', 'The Late Table (newsletter)', 81, 'Reader overlap 81', 'pod'));
    for (const t of b.topics ?? []) if (t.id === 'tp1') t.w = 4;
    b.topics?.push({
      id: 'tp7',
      name: 'later life cooking',
      kind: 'distinct',
      w: 2,
      ev: 'A new tag that fits the real audience',
    });
    b.course = {
      summary: `The plan assumed home cooks aged 25 to 34 would lead. Listeners aged ${g.W} were ${g.wa} percent, and aged ${g.B} was ${g.ba}. The show is liked, so the miss is about who listens, not about quality.`,
      actions: [
        'Reposition around travel stories and home cooking, the topics only you own.',
        'Lead the relaunch in the US, then the UK.',
        'Swap the guest list for guests with older, US skewed audiences.',
        'Move one sponsor slot from Nimbus Meal Kits to Hearth Pantry.',
      ],
      territories: [
        'United States: lead the relaunch.',
        'Mexico: hold spend until the first episode shows the split.',
      ],
      stop: ['Stop the student outreach.', 'Stop the Nimbus Meal Kits tie in.'],
    };
  },
  auditFix(b) {
    const a = assumption(b, 'as4');
    if (a) {
      a.verdict = 'breaks';
      a.why =
        'Affinity with core listeners is 47. The plan puts most of its sponsor weight here, and two sponsors score above 75.';
    }
    return {
      as1: 'Plan, p. 1',
      as2: 'Plan, p. 2',
      as3: 'Plan, p. 3',
      as4: 'Plan, p. 4',
      as5: 'Not written in the plan',
      as6: 'Plan, p. 5',
      as7: 'Not written in the plan',
    };
  },
};
