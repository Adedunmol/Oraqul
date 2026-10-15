import { A, AS, assumption, CN, F, fitArr, fitIn, RK, topFit } from '../brief';
import { placesFor } from '../places';
import type { DBrief, DemoPack } from '../types';

export const books: DemoPack = {
  id: 'books',
  name: 'Books',
  short: 'Books',
  blurb: 'Launch plans for titles and imprints, by market.',
  noun: 'book',
  fallback: 'author and comps',
  tools: ['Comp shelf', 'Adaptation bridge', 'Outreach brief'],
  cov: {
    tests: [
      'Reader audience by age, genre and place',
      'Comp shelf, as reader overlap with comparable titles',
      'Adaptation bridge to series, film and podcasts',
    ],
    thin: [
      'Reader age and gender for one title. About half of the books checked had no profile in Qloo, so the read can rest on the genre',
      'Debut authors and small press titles. With few anchors the read rests on comps and themes',
      'A book with no close comps. Cross-domain taste is read instead, and less certain',
    ],
    none: ['Sales, pre orders, bestseller lists and review quality. You supply them for a rescue'],
  },
  fields: [
    ['Format', 'kind'],
    ['Genre', 'genre'],
    ['Author', 'lead'],
    ['Comp titles', 'comps'],
    ['Markets', 'places'],
    ['Publication', 'window'],
  ],
  kinds: ['Novel', 'Non fiction', 'Series book', 'Debut'],
  placeLabel: 'markets',
  placeOpts: ['UK', 'US', 'Canada', 'Mexico'],
  files: { plan: 'launch-plan.docx', res: 'preorders-by-market.csv' },
  descHint:
    'Describe the book: pitch, author, comp titles, markets, publication date. Paste or attach anything you already have, such as a launch plan or pre order numbers.',
  matchOpts: (n) => [
    { v: `${n} (2021)`, l: `${n} (2021)`, d: 'Novel · literary fiction' },
    { v: `${n} (2016)`, l: `${n} (2016)`, d: 'Non fiction · low confidence' },
  ],
  q2: {
    prompt: 'Which format leads the launch?',
    opts: ['Hardback first', 'Paperback original', 'Ebook and audio first'],
    label: 'Lead format',
  },
  sec: [
    { k: 's1', t: 'Comp titles for the pitch', one: 'Pitch comp' },
    { k: 's2', t: 'Retailers and clubs', one: 'Retailer or club' },
    { k: 's3', t: 'Reviewers, podcasts and creators', one: 'Reviewer or creator' },
    { k: 's4', t: 'Festivals and events', one: 'Festival or event' },
  ],
  sigTabs: [
    ['shelf', 'Comp shelf'],
    ['bridge', 'Adaptation bridge'],
  ],
  planNote: 'Ranked by fit, 0 to 100. 75 and above is recommended.',
  dateLabel: 'Rival launch check',
  dateTitle: 'Rival launch check',
  partnerLabel: 'Outreach brief',
  partnerWord: 'outreach',
  rivalWord: 'rival title',
  quick: ['Check rival launches', 'Add pre order numbers', 'Draft an outreach brief'],
  noFc: {
    re: /sales|copies|bestseller|forecast|predict|how many books/,
    msg: "I can't forecast sales or bestseller placement. Qloo has no sales data. I can test which readers, comps and markets fit the book. If you share your pre order numbers, I can use them as inputs.",
  },
  noFcWhat: 'sales numbers',
  mv: [
    ['s1', 'Pitch against {n} (fit {f}).'],
    ['s2', 'Stock through {n} (fit {f}).'],
    ['s3', 'Send early copies to {n} (fit {f}).'],
  ],
  lead: (b) =>
    `Lead with ${b.audience[0]?.name ?? 'the core readers'} and pitch against ${topFit(b.s1)?.name ?? 'the closest comp'}.`,
  trace: {
    plan: [
      'Resolving the title to Qloo entities. Not found, falling back to author and comps',
      'Building the reader audience by age, genre and place',
      'Finding comp titles by reader overlap',
      'Listing the assumptions, stated and unstated',
      'Testing each assumption: holds, weak, breaks, cannot test',
      'Crossing to series, film and podcasts for the adaptation bridge',
      'Red teaming the winner from the opposite seed',
      'Packaging the brief with a receipt on every line',
    ],
    audit: [
      'Reading the launch plan',
      'Extracting the assumptions, stated and unstated',
      'Resolving comps, retailers and festivals to Qloo entities',
      'Testing each assumption: holds, weak, breaks, cannot test',
      'Searching for better options for the ones that break',
      'Red teaming the fixes from the opposite seed',
      'Packaging the audit with a receipt on every line',
    ],
    date: [
      'Reading the rival launch dates',
      'Measuring shared readers with each rival title',
      'Ranking the weeks by overlap',
      'Packaging the check with a receipt per rival',
    ],
    partner: [
      'Finding retailers, reviewers and clubs that fit the target readers',
      'Checking affinity for each candidate',
      'Drafting the brief with the evidence attached',
    ],
    rescue: [
      'Reading the pre order and sales numbers by market and format',
      'Comparing who bought with who the plan assumed',
      'Finding which assumption broke',
      'Searching for comps, retailers and events that fit the real readers',
      'Red teaming the new plan from the opposite seed',
      'Writing the course correction for the weeks ahead',
    ],
  },
  res: {
    dateLabel: 'Publication date',
    aTitle: 'Sales by market',
    aNoun: 'market',
    aLabels: (r) => [...r.places, 'Other'],
    planned: (r) => fitArr([40, 20, 15, 25], r.places.length + 1),
    demoA: (r) => fitArr([25, 38, 12, 25], r.places.length + 1),
    tTitle: 'Sales by format',
    tLabels: () => ['Hardback', 'Ebook', 'Audiobook'],
    demoT: () => [38, 21, 41],
    holdLabel: 'Week two sales as a percent of week one',
    holdShort: 'Week two',
    holdSub: 'of week one held',
    holdDefault: 64,
    confirmRows: [
      ['Publication date', 'Mar 4'],
      ['Source', 'Pre order and sales report'],
    ],
    chartA: 'Planned against actual sales by market',
    chartSub: 'Percent of pre orders and early sales by market.',
    chartT: 'Sales by format',
    head: (_b, g) =>
      `Where readers bought was not where the plan put them. ${g.W} delivered ${g.wa} percent against ${g.wp} planned, and ${g.B} delivered ${g.ba} percent.`,
    stats: (_b, g) => [
      { l: `${g.W}, planned`, v: `${g.wp}%` },
      { l: 'Actual', v: `${g.wa}%` },
      { l: `${g.B}, actual`, v: `${g.ba}%` },
    ],
  },
  base(r) {
    const c = r.comps.length ? r.comps : ['The Quiet Tide', 'Ash and Orchard'];
    const c0 = c[0] ?? 'The Quiet Tide';
    const c1 = c[1] ?? 'Ash and Orchard';
    const B: DBrief = {
      aLabels: [...r.places, 'Other'],
      planned: fitArr([40, 20, 15, 25], r.places.length + 1),
      audience: [
        A('au1', 'Book club readers 35 to 54', 84, 'Highest affinity for the comps and the author'),
        A(
          'au2',
          'Crime and thriller readers 25 to 44',
          77,
          'Second strongest, reads in print and audio',
        ),
        A('au3', 'Literary fiction readers 25 to 34', 69, 'Follows the author more than the genre'),
        A('au4', 'Audiobook listeners 25 to 44', 61, 'Strong overlap with podcast listeners'),
        A('au5', 'Readers 55 and over', 52, 'Moderate overlap with the comps'),
        A('au6', 'Young adult crossover 18 to 24', 36, 'Low overlap with the comps'),
      ],
      assumptions: [
        AS(
          'as1',
          'Book club readers 35 to 54 are the core readership',
          'holds',
          'Affinity 84, a 7 point lead over thriller readers.',
          '',
          'demo',
          'book club readers 35 to 54 = 84, thriller readers = 77',
        ),
        AS(
          'as2',
          'UK readers will lead sales',
          'weak',
          'UK lift is 1.5 and US lift is 1.6. The plan puts 40 percent of its weight on the UK.',
          'Plan a US push of equal size and test it in the first month.',
          'geo',
          'lift(UK) = 1.5, lift(US) = 1.6',
        ),
        AS(
          'as3',
          'Coastal Words Festival is the right launch event',
          'holds',
          'Reader overlap with festival audiences is 77.',
          '',
          'pod',
          'overlap(Coastal Words Festival, book club readers) = 77',
        ),
        AS(
          'as4',
          'Dockside Books stocks the target readers',
          'weak',
          'Overlap is 64. Two clubs and one chain score above 75.',
          'Add the Harbour Reading Club Network or keep Dockside as a local tie in.',
          'brand',
          'overlap(Dockside Books, core readers) = 64',
        ),
        AS(
          'as5',
          'A screen adaptation story will help the pitch',
          'holds',
          'Readers overlap 74 with the series The Lighthouse Files.',
          '',
          'cmp',
          'overlap(readers, The Lighthouse Files) = 74',
          true,
        ),
        AS(
          'as6',
          'Major newspaper reviews will drive pre orders',
          'cant',
          'Taste data cannot say whether reviews will be good or move sales.',
          '',
          'none',
          'no Qloo data covers review impact',
        ),
        AS(
          'as7',
          'A same day audiobook reaches new readers',
          'weak',
          'Audiobook listeners overlap only 61 with the print readers. Most overlap is with readers who would buy print anyway.',
          'Stagger the audio release by two weeks and aim it at podcast listeners.',
          'demo',
          'overlap(audiobook listeners, print readers) = 61',
          true,
        ),
      ],
      s1: [
        F('s1a', c0, 84, 'Reader overlap 84', 'cmp'),
        F('s1b', c1, 71, 'Reader overlap 71', 'cmp'),
        F('s1c', 'Nine Lanterns', 58, 'Reader overlap 58', 'cmp'),
        F('s1d', 'Salt Meridian', 49, 'Reader overlap 49. Not recommended.', 'cmp'),
      ],
      s2: [
        F('s2a', 'Harbour Reading Club Network', 83, 'Overlap 83 with book club readers', 'brand'),
        F('s2b', 'Coastal Bookshop Collective', 78, 'Overlap 78', 'brand'),
        F('s2c', 'Dockside Books', 64, 'Overlap 64', 'brand'),
        F('s2d', 'Skyline Airport Shops', 39, 'Overlap 39. Not recommended.', 'brand'),
      ],
      s3: [
        F('s3a', 'The Reading Room (podcast)', 88, 'Listener overlap 88', 'pod'),
        F('s3b', 'Marisol Vega (creator)', 80, 'Audience overlap 80', 'pod'),
        F('s3c', 'Crime Shelf Weekly (newsletter)', 76, 'Reader overlap 76', 'pod'),
        F('s3d', 'The Tidewater Review (press)', 70, 'Reader overlap 70', 'pod'),
      ],
      s4: [
        F('s4a', 'Coastal Words Festival, UK', 77, 'Reader overlap 77', 'geo'),
        F('s4b', 'Harbour Book Fair, US', 74, 'Reader overlap 74', 'geo'),
        F(
          's4c',
          'Guadalajara Book Fair, Mexico',
          59,
          'Reader overlap 59. Lower confidence.',
          'geo',
        ),
      ],
      places: placesFor(r),
      shelf: [
        { id: 'sh1', name: c0, ov: 84, ev: 'Reader overlap 84' },
        { id: 'sh2', name: c1, ov: 71, ev: 'Reader overlap 71' },
        { id: 'sh3', name: 'Nine Lanterns', ov: 58, ev: 'Reader overlap 58' },
        { id: 'sh4', name: 'Salt Meridian', ov: 49, ev: 'Reader overlap 49' },
        { id: 'sh5', name: 'The Long Dock', ov: 41, ev: 'Reader overlap 41' },
      ],
      bridge: [
        { ...F('br1', 'The Lighthouse Files', 74, 'Reader overlap 74', 'cmp'), medium: 'Series' },
        { ...F('br2', 'Cold Shore', 66, 'Reader overlap 66', 'cmp'), medium: 'Film' },
        { ...F('br3', 'The Harbour Hour', 61, 'Listener overlap 61', 'pod'), medium: 'Podcast' },
        { ...F('br4', 'Tides, the documentary', 52, 'Viewer overlap 52', 'cmp'), medium: 'Film' },
      ],
      weeks: ['Feb 25', 'Mar 4', 'Mar 11', 'Mar 18'],
      dates: [
        {
          id: 'da1',
          date: 'Feb 25',
          wk: 0,
          rival: 'The Salt Line (thriller)',
          overlap: 28,
          rec: 'Low overlap',
        },
        {
          id: 'da2',
          date: 'Mar 4',
          wk: 1,
          rival: 'A Cold Harbour (literary)',
          overlap: 71,
          rec: 'High overlap, risky',
        },
        {
          id: 'da3',
          date: 'Mar 11',
          wk: 2,
          rival: 'The Last Orchard (novel)',
          overlap: 46,
          rec: 'Moderate',
        },
      ],
      chosenDate: 'Mar 4',
      partners: [
        {
          id: 'pb1',
          name: 'Harbour Reading Club Network',
          type: 'Book club network',
          fits: 'Book club readers 35 to 54',
          ev: 'Overlap 83 with the core readers',
          k: 'brand',
          draft: `Subject: An early read of ${r.name}\n\nHi Harbour team,\n\nYour members look very close to the readers of ${r.name}: overlap of 83 with book club readers aged 35 to 54.\n\nWe would like to offer early copies and a short author conversation for your spring list. Evidence is attached.\n\nBest,\nThe Northlight Books team\n\n(Draft only. Oraqul does not send it.)`,
        },
        {
          id: 'pb2',
          name: 'The Reading Room (podcast)',
          type: 'Reviewer',
          fits: 'Crime and thriller readers',
          ev: 'Listener overlap 88',
          k: 'pod',
          draft: `Subject: ${r.name} for The Reading Room\n\nHi team,\n\nYour listeners overlap strongly with our readers (88). We would like to send an early copy and offer the author for an episode in the launch month.\n\nBest,\nThe Northlight Books team\n\n(Draft only. Oraqul does not send it.)`,
        },
      ],
      risks: [
        RK(
          'rk1',
          'The core readership is not book clubs',
          'Pre orders from clubs below 30 percent of the first week',
          'Run the thriller readers scenario',
        ),
        RK(
          'rk2',
          'US readers outpace the UK',
          'US pre orders pass UK pre orders in week one',
          'Move event budget to the US',
        ),
        RK(
          'rk3',
          'A rival literary title launches the same week',
          'A Cold Harbour holds Mar 4',
          'Move to Feb 25',
        ),
      ],
      cannot: [
        CN(
          'cn1',
          'Review quality and prize chances',
          'No Qloo data covers critic reception or prizes.',
        ),
        CN(
          'cn2',
          'Sales, pre orders and bestseller lists',
          'Qloo has no sales data. You supply these numbers.',
        ),
        CN(
          'cn3',
          'Anchors for Mexico',
          'The book is not in Qloo yet, so Mexico is read from the author and comps. If few of them are known there, the line is a draft.',
        ),
      ],
      course: null,
      results: null,
    };
    if (!r.places.includes('Mexico')) {
      B.cannot = B.cannot.filter((x) => x.id !== 'cn3');
      B.s4 = B.s4.filter((x) => x.id !== 's4c');
    }
    return B;
  },
  scen: [
    {
      id: 'thriller',
      label: 'A big thriller launches the same week',
      re: /thriller|rival|same week|launch/,
      apply(b) {
        b.chosenDate = 'Feb 25';
        const s = fitIn(b.s1, 's1a');
        if (s) s.note = 'Pitch against it carefully while the rival is in market';
        b.s3.push(
          F('s3e', 'Crime Shelf Late (podcast)', 72, 'Listener overlap 72, a quieter slot', 'pod'),
        );
        b.risks.push(
          RK(
            'rk4',
            'The rival thriller takes review space',
            'The rival gets the weekend supplement slot',
            'Place the book in the book club press, not the weekend press',
          ),
        );
        const x = assumption(b, 'as3');
        if (x) {
          x.verdict = 'weak';
          x.why =
            'The festival date is a week after the rival launch. Press attention will already be spent.';
          x.fix = 'Keep the festival, add a second event the week after.';
        }
      },
    },
    {
      id: 'author',
      label: 'The author cannot tour',
      re: /author|tour|travel/,
      apply(b) {
        const x = assumption(b, 'as3');
        if (x) {
          x.verdict = 'breaks';
          x.why =
            'Festival audiences come for the author. Without a live appearance the overlap of 77 is not usable.';
          x.fix = 'Replace the festival with a recorded conversation and a podcast tour.';
        }
        const p = fitIn(b.s3, 's3a');
        if (p) {
          p.fit = 92;
          p.note = 'Moves up. A podcast tour replaces the live events.';
        }
        for (const s of b.s4) s.note = 'Needs a live author';
      },
    },
    {
      id: 'adapt',
      label: 'The adaptation news is delayed',
      re: /adapt|screen|film|series/,
      apply(b) {
        const x = assumption(b, 'as5');
        if (x) {
          x.verdict = 'weak';
          x.why =
            'Without the adaptation news, the screen angle is a hope rather than a fact. Overlap 74 stays, but the pitch loses its hook.';
          x.fix = 'Lead the pitch with the comps and keep the adaptation as a second line.';
        }
        for (const i of b.bridge ?? []) i.note = 'Keep as a second line';
      },
    },
  ],
  rescue(b, g) {
    const a2 = assumption(b, 'as2');
    if (a2) {
      a2.verdict = 'breaks';
      a2.why = `${g.W} delivered ${g.wa} percent against ${g.wp} planned. ${g.B} delivered ${g.ba} percent.`;
      a2.fix = `Move event budget and the next push toward ${g.B}.`;
    }
    b.assumptions.push(
      AS(
        'as8',
        `${g.B} readers are a second core market`,
        'holds',
        `${g.B} delivered ${g.ba} percent. Lift there is 1.6.`,
        '',
        'geo',
        `actual share(${g.B}) = ${g.ba}`,
      ),
    );
    const worst = b.places.find((p) => p.name === g.W);
    const best = b.places.find((p) => p.name === g.B);
    if (worst) worst.note = 'Underdelivered against the plan.';
    if (best) {
      best.lift = 1.8;
      best.note = 'Overdelivered. Move event budget here.';
    }
    b.s2.push(
      F('s2e', 'Bayline Reading Society', 80, 'Overlap 80 with the readers who bought', 'brand'),
    );
    b.s3.push(F('s3g', 'Tide Table (podcast)', 83, 'Listener overlap 83', 'pod'));
    b.s4.push(F('s4d', 'Harbour Book Fair, second night', 78, 'Reader overlap 78', 'geo'));
    b.course = {
      summary: `The plan assumed ${g.W} readers would lead with ${g.wp} percent. They delivered ${g.wa} percent, and ${g.B} delivered ${g.ba}. The book is being read, so the miss is about where its readers live.`,
      actions: [
        `Move the launch event budget toward ${g.B}.`,
        `Pitch the coastal ${g.B} bookshops first.`,
        'Add Tide Table (podcast) to the review run.',
        'Keep the festival slots that still hold.',
      ],
      territories: ['Mexico: hold spend until the first pre order week shows the split.'],
      stop: [`Stop the ${g.W} paid social push.`, 'Stop the Skyline Airport Shops placement.'],
    };
  },
  auditFix(b) {
    const a = assumption(b, 'as4');
    if (a) {
      a.verdict = 'breaks';
      a.why =
        'Overlap is 64. The plan puts most of its retail budget here, and two clubs score above 75.';
    }
    return {
      as1: 'Plan, p. 1',
      as2: 'Plan, p. 3',
      as3: 'Plan, p. 4',
      as4: 'Plan, p. 5',
      as5: 'Plan, p. 2',
      as6: 'Plan, p. 6',
      as7: 'Not written in the plan',
    };
  },
};
