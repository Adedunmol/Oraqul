// The Guide's words, in one place. The Guide pages in `apps/web` render this, and the help bot in
// `apps/api` answers from the same text, so what the bot says is what the pages say. A page that
// also shows a live part (the brief builder, the launch rules) keeps that part in the web app; the
// bot gets its facts from `knowledge.ts`.

export interface GuideItem {
  label?: string;
  text: string;
  /** A smaller line under the text, such as what to bring. */
  note?: string;
}

export interface GuideComparison {
  label: string;
  weak: string;
  strong: string;
}

export interface GuideSection {
  /** Absent for the opening text of a page. */
  heading?: string;
  text?: string[];
  items?: GuideItem[];
  /** How `items` are drawn: cards in a grid, a numbered list, or plain bullets. */
  layout?: 'cards' | 'steps' | 'list';
  compare?: GuideComparison[];
}

export interface GuidePage {
  slug: string;
  title: string;
  /** One sentence, shown on the hub and used to pick pages for an answer. */
  summary: string;
  sections: GuideSection[];
}

/** What matters most in a brief, in order, with why. The brief builder counts these. */
export const GUIDE_DETAILS = [
  { id: 'release', label: 'Release date', why: 'Every calendar is worked back from it.' },
  {
    id: 'cities',
    label: 'Home city and diaspora cities',
    why: 'You get one plan per territory, home first.',
  },
  { id: 'comps', label: 'Comparable titles', why: 'They are how Qloo finds your audience.' },
  { id: 'band', label: 'Budget band', why: 'The plan proposes only what the budget can carry.' },
  {
    id: 'launcher',
    label: 'Who is launching',
    why: 'A solo author and a major studio are offered different partners.',
  },
  {
    id: 'rivals',
    label: 'Rivals with their dates',
    why: 'Each date is checked against the audience it shares.',
  },
  {
    id: 'target',
    label: 'A target for the one signal',
    why: 'The plan is judged on a number you chose.',
  },
  { id: 'ages', label: 'Age band', why: 'It is tested against who Qloo says the audience is.' },
  {
    id: 'partners',
    label: 'Partners already signed',
    why: 'They stay in the plan and are never suggested back.',
  },
  {
    id: 'brands',
    label: 'Brands you already know',
    why: 'They are asked of Qloo beside the ones Oraqul proposes, and never signed for you.',
  },
  {
    id: 'tone',
    label: 'Content rating or tone',
    why: 'A partner that does not fit the content is flagged.',
  },
  { id: 'channels', label: 'Platforms to plan on', why: 'The plan runs on these platforms.' },
] as const;

export const GUIDE_PAGES: GuidePage[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    summary: 'Start with one message, and pick what you want done: make, check or fix a plan.',
    sections: [
      {
        text: [
          'Oraqul starts from a message, not a form. Say what you are launching, where and when, and what you already have. It reads the category and the job, states what it understood, and asks only when it cannot go on without an answer. The better the message, the less it has to assume.',
        ],
      },
      {
        heading: 'Three jobs',
        layout: 'cards',
        items: [
          {
            label: 'Make a plan',
            text: 'Describe the launch. You get a plan with a bottom line, a plan per territory, the one signal it is judged on and a calendar worked back from your date.',
            note: 'Bring: a title, a release date and the cities.',
          },
          {
            label: 'Check my plan',
            text: 'Paste a plan you already have. Every belief in it is tested and marked Holds, Weak, Breaks or Could not test, with the sentence of your plan that states it.',
            note: 'Bring: the plan, as text or a file.',
          },
          {
            label: 'Fix my plan',
            text: 'Before launch, you get a better plan that keeps your choices. After launch, add results as totals and the new plan is built around the audience that showed up.',
            note: 'Bring: the plan, and results by city if it is out.',
          },
        ],
      },
    ],
  },
  {
    slug: 'write-a-brief',
    title: 'Write a brief',
    summary:
      'Which details change a plan most, what a loose brief looks like beside a strong one, and a builder that writes the brief for you.',
    sections: [
      {
        text: [
          'Fill in what you know. The brief is written in the forms Oraqul reads without guessing, and the list beside it shows what is still missing and why it matters. Leave anything out: the plan says what it assumed.',
        ],
      },
      {
        heading: 'What matters most',
        text: [
          'In order of how much each one changes the plan. Give the first few and you get most of the benefit.',
        ],
        layout: 'steps',
        items: GUIDE_DETAILS.map((d) => ({ label: d.label, text: d.why })),
      },
      {
        heading: 'Weak and strong, side by side',
        compare: [
          { label: 'Release date', weak: 'Opening in spring.', strong: 'Opening on 2027-03-12.' },
          {
            label: 'Cities',
            weak: 'Nigeria and abroad.',
            strong: 'Lagos first, then London, Houston and Atlanta.',
          },
          {
            label: 'Comps',
            weak: 'Like the big Nollywood hits.',
            strong: 'Comps: "Salt Road", "The Glass Lantern", "Midnight Harbor".',
          },
          {
            label: 'Budget',
            weak: 'We have a small budget.',
            strong: 'An independent budget. Or: budget $40k.',
          },
          {
            label: 'Rivals',
            weak: 'There are some big releases that month.',
            strong: 'Rivals: Harbor Lights on 2027-03-12; Third Mainland on 2027-03-19',
          },
          { label: 'Target', weak: 'We want it to do well.', strong: 'Target 5,000 presales.' },
        ],
        text: [
          'Use real, public names only: titles, artists, brands and cities. Oraqul sends nothing personal to Qloo, so leave out people’s details and customer lists.',
        ],
      },
    ],
  },
  {
    slug: 'read-a-plan',
    title: 'Read a plan',
    summary:
      'What a grounded line, a playbook line, a sourced fact, confidence and a receipt are, and what the verdicts and directions mean.',
    sections: [
      {
        heading: 'The words in a plan',
        layout: 'cards',
        items: [
          {
            label: 'Grounded line',
            text: 'A claim about taste, audience or place. It carries a small number that opens the Qloo finding behind it, and every name and number in it matches that finding.',
          },
          {
            label: 'Playbook line',
            text: 'Launch practice: timing, channels, how to brief a creative. It cites nothing and never claims what an audience likes.',
          },
          {
            label: 'Sourced fact',
            text: 'A dated market fact, such as a rival release or a window. It links to the page it came from and uses only that page’s numbers.',
          },
          {
            label: 'Confidence',
            text: 'High, medium or lower, set by code from how much the line rests on. It says how much the line rests on, not how good the result is.',
          },
          {
            label: 'Receipt',
            text: 'The exact Qloo call behind a line, with the rule that turned it into a verdict.',
          },
        ],
      },
      {
        heading: 'Two kinds of call',
        text: [
          'A belief in your plan gets a verdict: Holds, Weak, Breaks or Could not test. A decision gets a direction: Okay, Risky or Avoid.',
          'Directions are set by code from what Qloo returned, for each opening date, territory and partner. A direction on something you chose keeps your choice and says how to handle it. Neither is a forecast.',
        ],
      },
    ],
  },
  {
    slug: 'after-the-plan',
    title: 'After the plan',
    summary:
      'What to ask once you have a plan: what-ifs, rival dates, partner briefs, the creative kit, the campaign, results and a refresh.',
    sections: [
      {
        layout: 'list',
        items: [
          {
            label: 'Ask a what-if.',
            text: '“What if we open in Houston first?” reruns the plan with the change and marks what moved.',
          },
          {
            label: 'Check a rival date.',
            text: 'Name a rival and the day it opens. You supplied the date; Qloo says how much audience you share. For a live show, a rival on your night or in your week is flagged.',
          },
          {
            label: 'Brief a partner.',
            text: 'A pitch kit in text: why the audience fits, what the partner gets, the ask, a timeline, one or two ideas that leave the partner room, and a short script. You review it and send it yourself. Oraqul never sends.',
          },
          {
            label: 'Make the creative kit.',
            text: '“Make the creative kit for Lagos on Instagram” gives hooks, a script outline, a shot list, a key art brief and a caption pack. Ask for “every territory” and you get one kit that covers each on its lead channel.',
          },
          {
            label: 'Look at Worth a look.',
            text: 'Nearby markets and the strongest area of each of your cities, each with why, what the data does not show, a first test and what to measure. They stay beside your plan until you add one: “What if we add Accra?”.',
          },
          {
            label: 'Run the campaign.',
            text: 'On the plan’s Campaign tab, set up its calendar as actions. Edit them, tick them off, and set up a two-angle test for any of them. A revised plan gets its own set and the old one stays as you left it.',
          },
          {
            label: 'Add results.',
            text: 'After launch, give totals by city or age band, and say the period they cover and where they came from: “Source: box office report”. Oraqul sets them against where the plan put each place, and a fix writes a revised plan around who showed up. Your figures show what happened, not why. For a test, add the figures for each angle and Oraqul compares them, or says inconclusive when they are thin or close.',
          },
          {
            label: 'Check what has changed.',
            text: '“Check what has changed since this plan was made”, or a question such as “Has the release window changed?”. It asks again and shows what moved, which pages now say something different and the lines of your plan that rest on them. Your plan is untouched until you ask to fix it.',
          },
        ],
      },
    ],
  },
  {
    slug: 'limits',
    title: 'Limits and privacy',
    summary: 'What Oraqul will not do, and what it sends to Qloo.',
    sections: [
      {
        heading: 'What it will not do',
        layout: 'list',
        items: [
          {
            text: 'No forecasts of sales, streams, downloads or box office. A target is your goal, not a prediction.',
          },
          { text: 'No pricing advice, and no price for a partner. Price is always unknown.' },
          {
            text: 'No ads, trailers, images or video. It writes the script, shot list, key art brief, caption pack and hook options, and a person makes the final creative.',
          },
          { text: 'No sending. Anything drafted is for you to review and send.' },
        ],
      },
      {
        heading: 'What goes to Qloo',
        text: [
          'Only public names go to Qloo: titles, artists, brands, places and age bands. Nothing personal is sent, so leave out people’s details and customer lists.',
        ],
      },
    ],
  },
];

/** The two pages whose content comes from the rule library, so the web app draws them. */
export const GUIDE_RULE_PAGES: GuideIndexEntry[] = [
  {
    slug: 'categories',
    title: 'By category',
    summary:
      'What each of the six categories is judged on, where it leads and what else it helps with.',
  },
  {
    slug: 'launch-rules',
    title: 'The launch rules',
    summary:
      'The versioned rules each category plans by, with their sources, including live shows, the content calendar and partner tiers.',
  },
];

export interface GuideIndexEntry {
  slug: string;
  title: string;
  summary: string;
}

/** Every Guide page in reading order, for the hub, the contents and the bot's sources. */
export const GUIDE_INDEX: GuideIndexEntry[] = [
  ...GUIDE_PAGES.slice(0, 3),
  GUIDE_RULE_PAGES[0] as GuideIndexEntry,
  ...GUIDE_PAGES.slice(3, 4),
  GUIDE_RULE_PAGES[1] as GuideIndexEntry,
  ...GUIDE_PAGES.slice(4),
].map(({ slug, title, summary }) => ({ slug, title, summary }));
