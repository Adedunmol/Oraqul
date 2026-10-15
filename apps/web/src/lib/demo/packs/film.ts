import { A, AS, assumption, CN, defSplit, F, fitIn, lowestPlanLines, RK, topFit } from '../brief';
import { placesFor } from '../places';
import type { DBrief, DemoPack } from '../types';

const AUDIENCE_PLAN = [34, 31, 22, 13];

export const film: DemoPack = {
  id: 'film',
  name: 'Film and series',
  short: 'Film',
  blurb: 'Release plans for films and series, by territory and opening date.',
  noun: 'title',
  fallback: 'comps and cast',
  tools: ['Territory ladder', 'Rival date check', 'Partner brief'],
  cov: {
    tests: [
      'Audience fit by age, gender and place',
      'Territory ladder, as lift over a neutral audience',
      'Rival opening dates, measured as shared audience',
    ],
    thin: [
      'Original ideas with no close comps. The read rests on cast and themes',
      'Titles from outside the US and UK. Only Nigerian titles have been checked: present in Qloo, some with low popularity',
    ],
    none: ['Box office, viewing numbers and reviews. You supply them for a rescue'],
  },
  fields: [
    ['Format', 'kind'],
    ['Genre', 'genre'],
    ['Cast', 'lead'],
    ['Comps', 'comps'],
    ['Territories', 'places'],
    ['Window', 'window'],
  ],
  kinds: ['Film', 'Series'],
  placeLabel: 'territories',
  placeOpts: ['UK', 'Canada', 'US', 'Mexico', 'Germany', 'Brazil'],
  files: { plan: 'marketing-plan-v3.pdf', res: 'opening-results.csv' },
  descHint:
    'Describe the film or series: logline, cast, comps, window. Paste or attach anything you already have, such as a plan or opening numbers. Type below or use the attach buttons.',
  matchOpts: (n) => [
    { v: `${n} (2019)`, l: `${n} (2019)`, d: 'Short film · thriller · low confidence' },
    { v: `${n} Road (2014)`, l: `${n} Road (2014)`, d: 'Feature · drama' },
  ],
  q2: {
    prompt: 'What is the marketing budget band?',
    opts: ['Under $2M', '$2M to $10M', 'Over $10M'],
    label: 'Budget band',
  },
  sec: [
    { k: 's1', t: 'Trailer pairings', one: 'Trailer pairing' },
    { k: 's2', t: 'Partner brands', one: 'Partner brand' },
    { k: 's3', t: 'Press and podcasts', one: 'Press or podcast' },
    { k: 's4', t: 'Cities', one: 'City' },
  ],
  sigTabs: [['territories', 'Territories']],
  planNote: 'Ranked by fit, 0 to 100. 75 and above is recommended.',
  dateLabel: 'Rival date check',
  dateTitle: 'Rival date check',
  partnerLabel: 'Partner brief',
  partnerWord: 'partner',
  rivalWord: 'rival film',
  quick: ['Check a rival date', 'Add opening results', 'Draft a partner brief'],
  noFc: {
    re: /box office|forecast|predict|how much will|gross/,
    msg: "I can't forecast box office. Qloo has no box office data and I can't backtest. I can test who the plan reaches. If you give me your own tracking numbers, I can use them as inputs.",
  },
  noFcWhat: 'box office or viewing numbers',
  mv: [
    ['s1', 'Attach the trailer to {n} (fit {f}).'],
    ['s2', 'Partner with {n} (fit {f}).'],
    ['s3', 'Place press with {n} (fit {f}).'],
  ],
  lead: (b) =>
    `Lead with ${b.audience[0]?.name ?? 'the core audience'} and attach to ${topFit(b.s1)?.name ?? 'the top pairing'}.`,
  trace: {
    build: [
      'Resolving the title to Qloo entities. Not found, falling back to comps and cast at lower confidence',
      'Building the audience by age, gender and place',
      'Listing the assumptions, stated and unstated',
      'Testing each assumption: holds, weak, breaks, cannot test',
      'Searching for better trailer pairings, brands and cities',
      'Red teaming the winner from the opposite seed',
      'Stop: nothing beats the current plan',
      'Packaging the brief with a receipt on every line',
    ],
    audit: [
      'Reading the pasted plan',
      'Extracting the assumptions, stated and unstated',
      'Resolving titles, brands and podcasts to Qloo entities',
      'Testing each assumption: holds, weak, breaks, cannot test',
      'Searching for better options for the ones that break',
      'Red teaming the fixes from the opposite seed',
      'Packaging the audit with a receipt on every line',
    ],
    date: [
      'Reading the rival dates',
      'Measuring shared audience with each rival film',
      'Ranking the dates by overlap',
      'Packaging the date check with a receipt per rival',
    ],
    partner: [
      'Finding partners that fit the target segments',
      'Checking affinity for each candidate',
      'Drafting the brief with the evidence attached',
    ],
    rescue: [
      'Reading the results: split, scores, territories',
      'Comparing who showed up with who the plan assumed',
      'Finding which assumption broke',
      'Searching for pairings, brands and cities that fit the real audience',
      'Red teaming the new plan from the opposite seed',
      'Writing the course correction for next weekend and the territories still to open',
    ],
  },
  res: {
    dateLabel: 'Opening date',
    aTitle: 'Audience by age',
    aNoun: 'age group',
    aLabels: () => ['18 to 24', '25 to 34', '35 to 54', '55 and over'],
    planned: () => AUDIENCE_PLAN.slice(),
    demoA: () => [14, 23, 41, 22],
    tTitle: 'Audience by territory',
    tLabels: (r) => (r.places.length >= 2 ? r.places.slice() : null),
    demoT: (r) => defSplit(r.places.length),
    holdLabel: 'Weekend two held at (percent of weekend one)',
    holdShort: 'Weekend two',
    holdSub: 'of weekend one held',
    holdDefault: 58,
    confirmRows: [
      ['Opening date', 'Oct 2'],
      ['Scores', 'Review 82, audience 91'],
    ],
    chartA: 'Planned against actual audience',
    chartSub: 'Percent of the opening audience by age group.',
    chartT: 'Opening audience by territory',
    head: (_b, g) =>
      `Who showed up was not who the plan assumed. Aged ${g.W} was ${g.wa} percent against ${g.wp} planned, and aged ${g.B} was ${g.ba} percent.`,
    stats: (_b, g) => [
      { l: `Aged ${g.W}, planned`, v: `${g.wp}%` },
      { l: 'Actual', v: `${g.wa}%` },
      { l: `Aged ${g.B}, actual`, v: `${g.ba}%` },
    ],
  },
  base(r) {
    const series = r.kind === 'Series';
    const c = r.comps.length ? r.comps : ['Low Tide Letters', 'Paper Harbour'];
    const c0 = c[0] ?? 'Low Tide Letters';
    const lead = r.lead.split(',')[0]?.trim() || 'Nia Calloway';
    const B: DBrief = {
      aLabels: ['18 to 24', '25 to 34', '35 to 54', '55 and over'],
      planned: AUDIENCE_PLAN.slice(),
      audience: [
        A('au1', 'Women 18 to 24', 84, 'Highest affinity for the comps and cast'),
        A('au2', 'Women 25 to 34', 67, 'Second strongest, heavy podcast listening'),
        A('au3', 'Men 18 to 24', 61, 'Strong with the genre, weaker with the cast'),
        A('au4', 'Men 25 to 34', 49, 'Follows the lead actor more than the genre'),
        A('au5', 'Women 35 and over', 34, 'Low overlap with the comps'),
        A('au6', 'Men 35 and over', 27, 'Lowest overlap with the comps'),
      ],
      assumptions: [
        AS(
          'as1',
          'Women 18 to 24 are the core audience',
          'holds',
          'Affinity 84, a 17 point lead over the next group.',
          '',
          'demo',
          'women 18 to 24 = 84, women 25 to 34 = 67',
        ),
        AS(
          'as2',
          `Attaching the trailer to ${c0} reaches the core audience`,
          'holds',
          `Audience overlap with ${c0} is 91.`,
          '',
          'cmp',
          `overlap(${c0}, ${r.name}) = 91`,
        ),
        AS(
          'as3',
          'Hollow Coffee Co is a good partner brand',
          'weak',
          'Brand affinity with the core group is 52. Three brands score above 75.',
          'Switch to Tidewater Drinks (88) or keep Hollow Coffee Co as a smaller local tie in.',
          'brand',
          'brand affinity(Hollow Coffee Co, women 18 to 24) = 52',
        ),
        AS(
          'as4',
          'The podcast The Slow Reel reaches the target audience',
          'holds',
          'Listener overlap is 90.',
          '',
          'pod',
          'podcast overlap(The Slow Reel) = 90',
        ),
        AS(
          'as5',
          'The Mexico plan can reuse the UK audience',
          'breaks',
          'The best matching group in Mexico City and Guadalajara is men and women 25 to 34. Women 18 to 24 rank third.',
          'Build a separate Mexico plan with its own audience, cities and date.',
          'geo',
          'top segment, Mexico City and Guadalajara = 25 to 34',
          true,
        ),
        AS(
          'as6',
          series
            ? 'Reviews will be strong and drive viewing'
            : 'Reviews will be strong and drive the opening',
          'cant',
          'Taste data cannot say whether reviews will be good.',
          '',
          'none',
          'no Qloo data covers critic reception',
        ),
        AS(
          'as7',
          `${lead}'s fans will follow her to this ${series ? 'series' : 'film'}`,
          'weak',
          'Overlap between her fans and the genre audience is only 28.',
          'Lead with the genre in marketing, use her as a supporting hook.',
          'cmp',
          `overlap(${lead} fans, genre audience) = 28`,
          true,
        ),
      ],
      s1: [
        F('s1a', c0, 91, 'Audience overlap 91 with the core group', 'cmp'),
        F('s1b', c[1] ?? 'Paper Harbour', 86, 'Audience overlap 86', 'cmp'),
        F('s1c', 'Lantern Hour', 74, 'Audience overlap 74, older skew', 'cmp'),
        F('s1d', 'Brightside (family comedy)', 38, 'Audience overlap 38. Not recommended.', 'cmp'),
      ],
      s2: [
        F('s2a', 'Tidewater Drinks', 88, 'Affinity 88 with women 18 to 34', 'brand'),
        F('s2b', 'Paperback Co.', 81, 'Affinity 81, strong with readers of the genre', 'brand'),
        F('s2c', 'Northline Sneakers', 76, 'Affinity 76 with men 18 to 24', 'brand'),
        F('s2d', 'Hollow Coffee Co', 52, 'Affinity 52 with the core group', 'brand'),
      ],
      s3: [
        F('s3a', 'The Slow Reel (podcast)', 90, 'Listener overlap 90', 'pod'),
        F('s3b', 'Late Night Credits (podcast)', 83, 'Listener overlap 83', 'pod'),
        F('s3c', 'Crime Letters (newsletter)', 79, 'Reader overlap 79', 'pod'),
        F('s3d', 'The Dockside Review (online press)', 72, 'Reader overlap 72', 'pod'),
      ],
      s4: [
        F('s4a', 'Austin, US', 89, 'Concentration of the core group, index 89', 'geo'),
        F('s4b', 'London, UK', 87, 'Index 87', 'geo'),
        F('s4c', 'Toronto, Canada', 84, 'Index 84', 'geo'),
        F('s4d', 'Manchester, UK', 70, 'Index 70', 'geo'),
        F(
          's4e',
          'Mexico City, Mexico',
          78,
          'Index 78 for 25 to 34. Lower confidence, thin data.',
          'geo',
        ),
        F('s4f', 'Guadalajara, Mexico', 66, 'Index 66. Lower confidence.', 'geo'),
      ],
      places: placesFor(r),
      weeks: ['Nov 6', 'Nov 13', 'Nov 20', 'Nov 27'],
      dates: [
        {
          id: 'da1',
          date: 'Nov 6',
          wk: 0,
          rival: 'Winter Harvest (family drama)',
          overlap: 22,
          rec: 'Lowest overlap',
        },
        {
          id: 'da2',
          date: 'Nov 13',
          wk: 1,
          rival: 'Night Ferry (crime)',
          overlap: 71,
          rec: 'High overlap, risky',
        },
        {
          id: 'da3',
          date: 'Nov 20',
          wk: 2,
          rival: 'Cold Season (thriller)',
          overlap: 44,
          rec: 'Moderate',
        },
      ],
      chosenDate: 'Nov 13',
      partners: [
        {
          id: 'pb1',
          name: 'Tidewater Drinks',
          type: 'Brand',
          fits: 'Women 18 to 34',
          ev: 'Brand affinity 88, shared interest in coastal and harbour imagery',
          k: 'brand',
          draft: `Subject: A limited bottle for ${r.name}\n\nHi Tidewater team,\n\nWe are releasing ${r.name} on Nov 13 and your audience looks very close to ours: shared taste across coastal lifestyle and the genre, with a brand affinity of 88 among women 18 to 34.\n\nWe would like to talk about a limited bottle tied to the film. Evidence is attached to this brief.\n\nBest,\nThe Northlight release team\n\n(Draft only. Oraqul does not send it.)`,
        },
        {
          id: 'pb2',
          name: 'Marisol Vega (creator)',
          type: 'Creator',
          fits: 'Women 18 to 34',
          ev: 'Audience overlap 85, reviews crime drama to a core group',
          k: 'pod',
          draft: `Subject: Early look at ${r.name}\n\nHi Marisol,\n\nYour audience overlaps strongly with who we think ${r.name} is for (overlap 85). We would like to offer you an early screening and an interview slot with the cast.\n\nBest,\nThe Northlight release team\n\n(Draft only. Oraqul does not send it.)`,
        },
      ],
      risks: [
        RK(
          'rk1',
          'Core audience is not women 18 to 24',
          'Pre sales or tracking shows 35 and over above 35 percent',
          'Run the older audience scenario',
        ),
        RK(
          'rk2',
          'A rival crime drama opens the same weekend',
          'Night Ferry holds its Nov 13 date',
          'Move to Nov 6 or lean on the Canada and UK dates',
        ),
        RK(
          'rk3',
          'Brand partner fit is weaker than planned',
          'Hollow Coffee Co declines or the audience reacts flat',
          'Swap to Tidewater Drinks',
        ),
      ],
      cannot: [
        CN('cn1', 'Review quality and critic score', 'No Qloo data covers critic reception.'),
        CN(
          'cn2',
          series ? 'Premiere week viewing' : 'Opening weekend box office',
          'Qloo has no viewing or box office data. You supply these numbers.',
        ),
        CN(
          'cn3',
          'Anchors for Mexico',
          `${r.name} is not in Qloo yet, so Mexico is read from its comps and cast. If few of them are known there, the line is a draft.`,
        ),
      ],
      course: null,
      results: null,
    };
    const cs = r.places;
    const ng = cs.includes('Mexico');
    if (!(ng && (cs.includes('US') || cs.includes('UK') || cs.includes('Canada')))) {
      B.assumptions = B.assumptions.filter((x) => x.id !== 'as5');
    }
    if (!ng) B.cannot = B.cannot.filter((x) => x.id !== 'cn3');
    if (cs.length) {
      const kept = B.s4.filter((x) => cs.some((p) => x.name.endsWith(`, ${p}`)));
      if (kept.length >= 2) B.s4 = kept;
    }
    return B;
  },
  scen: [
    {
      id: 'older',
      label: 'The opening audience is older than planned',
      re: /older|age/,
      apply(b) {
        const a = assumption(b, 'as1');
        if (a) {
          a.verdict = 'weak';
          a.why =
            'If 35 and over leads, women 18 to 24 keep a lead of only 6 points (84 vs 78). The core audience is no longer clear.';
          a.fix = 'Plan a second segment for 35 to 54 and test it before opening.';
        }
        const s = fitIn(b.s1, 's1c');
        if (s) s.fit = 58;
        b.s1.push(
          F(
            's1e',
            'The Long Garden',
            83,
            'Audience overlap 83 with 35 and over crime viewers',
            'cmp',
          ),
        );
        b.s3.push(F('s3e', 'Late Reel (podcast)', 81, 'Listener overlap 81, older skew', 'pod'));
        b.risks.push(
          RK(
            'rk4',
            'Older viewers need different press',
            'Pre sales skew 35 and over',
            'Book Late Reel and shift one trailer slot',
          ),
        );
      },
    },
    {
      id: 'rival',
      label: 'A rival crime drama opens the same weekend',
      re: /rival|date|week|clash/,
      apply(b) {
        b.chosenDate = 'Nov 6';
        const p = b.places.find((x) => x.date === 'Nov 13') ?? b.places[0];
        if (p) {
          p.date = 'Nov 6';
          p.note = 'Opening a week earlier avoids Night Ferry. Austin and Chicago first.';
        }
        b.risks.push(
          RK(
            'rk5',
            'Moving the date forces a shorter trailer run',
            'Attachments not confirmed by Oct 20',
            `Confirm the ${b.s1[0]?.name ?? 'top'} attachment first`,
          ),
        );
      },
    },
    {
      id: 'lead',
      label: 'The lead actress leaves the press tour',
      re: /lead|actress|actor|cast/,
      apply(b) {
        const a = assumption(b, 'as7');
        if (a) {
          a.verdict = 'breaks';
          a.why = 'Without her in press, her fans have no route to the film.';
          a.fix = 'Remove her from lead messaging and pick a genre led angle.';
        }
        const p = fitIn(b.s3, 's3a');
        if (p) {
          p.fit = 71;
          p.note = 'Fit dropped when the cast angle was removed';
        }
      },
    },
    {
      id: 'budget',
      label: 'The marketing budget is cut by 30 percent',
      re: /budget|cut|cost/,
      apply(b) {
        for (const line of lowestPlanLines(b)) line.note = 'Cut first: weakest evidence';
      },
    },
  ],
  rescue(b, g) {
    const a1 = assumption(b, 'as1');
    if (a1) {
      a1.verdict = 'breaks';
      a1.why = `Opening showed ${g.wa} percent aged ${g.W} against ${g.wp} planned. Aged ${g.B} was ${g.ba} percent.`;
      a1.fix = 'Re-aim week two at women 35 to 54.';
    }
    b.assumptions.push(
      AS(
        'as8',
        'Women 35 to 54 are a second core audience',
        'holds',
        `They made up ${g.ba} percent of the opening. Taste overlap with prestige thriller fans is 76.`,
        '',
        'demo',
        'overlap(35 to 54 women, prestige thriller fans) = 76',
      ),
    );
    b.s1.push(F('s1e', 'The Long Garden', 88, 'Overlap 88 with the 35 to 54 group', 'cmp'));
    const t1 = fitIn(b.s1, 's1a');
    if (t1) {
      t1.fit = 70;
      t1.note = 'Younger skew than the real audience';
    }
    b.s2.push(
      F('s2e', 'Paperback Co. book club tie in', 84, 'Affinity 84 with women 35 to 54', 'brand'),
    );
    b.s3.push(F('s3g', 'Late Reel (podcast)', 85, 'Listener overlap 85 with 35 to 54', 'pod'));
    b.s4.push(F('s4g', 'Edinburgh, UK', 82, 'Index 82 for 35 to 54', 'geo'));
    const territories: string[] = [];
    const uk = b.places.find((x) => x.name === 'UK');
    const ng = b.places.find((x) => x.name === 'Mexico');
    if (uk) {
      uk.aud = 'Women 35 to 54 first, then 18 to 34';
      uk.note = 'Rebuilt after the opening. Edinburgh added.';
      territories.push('United Kingdom: lead with women 35 to 54, add Edinburgh, keep London.');
    }
    if (ng) {
      ng.note =
        'Watch the Mexico City opening split before spending. The same pattern could appear.';
      territories.push('Mexico: hold spend until the first Mexico City weekend shows the split.');
    }
    if (!territories.length) {
      territories.push(
        'Only one territory is planned. Apply the changes to the remaining weeks there.',
      );
    }
    b.course = {
      summary: `The plan assumed women 18 to 24 would lead. They were ${g.wa} percent of the audience, and aged ${g.B} was ${g.ba} percent. The film was liked, so the miss is about who came, not about quality.`,
      actions: [
        `Swap the week two trailer attachment from ${b.s1[0]?.name ?? 'the first pairing'} to The Long Garden.`,
        'Book Late Reel and move one slot from The Slow Reel to Late Night Credits.',
        'Add the Paperback Co. book club tie in for weekend two.',
        'Shift 20 percent of remaining digital spend to women 35 to 54 in the top five cities.',
      ],
      territories,
      stop: ['Stop the 18 to 24 creator push in the UK.', 'Stop the Hollow Coffee Co tie in.'],
    };
  },
  auditFix(b) {
    const a = assumption(b, 'as3');
    if (a) {
      a.verdict = 'breaks';
      a.why =
        'Brand affinity with the core group is 52. Three brands score above 75, and the plan puts most of its partner budget here.';
    }
    b.risks.unshift(
      RK(
        'rk0',
        'Most of the partner budget sits on a weak brand fit',
        'Hollow Coffee Co shows low engagement in the first week of the campaign',
        'Move budget to Tidewater Drinks',
      ),
    );
    return {
      as1: 'Plan, p. 2',
      as2: 'Plan, p. 4',
      as3: 'Plan, p. 5',
      as4: 'Plan, p. 4',
      as5: 'Not written in the plan',
      as6: 'Plan, p. 1',
      as7: 'Not written in the plan',
    };
  },
};
