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
        heading: 'Say it once for the whole team',
        layout: 'list',
        items: [
          {
            label: 'Team defaults.',
            text: 'Owners paste what every plan should follow into Team, then Team defaults: your markets, a budget ceiling and its currency, tone and language, brand safety, banned partners and topics, channels you never use, and who must approve anything that leaves Oraqul. Templates sit beside the box, and plain sentences such as “We don’t welcome homophobic suggestions” work too.',
          },
          {
            label: 'You confirm each rule.',
            text: 'Nothing is followed until an owner confirms it. Each rule shows as a plain sentence beside the words it came from, whether code enforces it or it is only given to the writer, and anything it clashes with. Editors can propose rules.',
          },
          {
            label: 'What code enforces.',
            text: 'A budget ceiling, the places you cover (used when a brief names no city), banned partners, channels you never use and who approves. A rule that asks Oraqul to hide a weak result, to change a verdict, to treat people differently because of who they are, or to send things by itself is not accepted, and says why.',
          },
          {
            label: 'When a brief clashes.',
            text: 'If your message names something a rule rules out, Oraqul asks once whether to keep the limit or go ahead for this run. Going ahead is logged against the rule.',
          },
        ],
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
      'What to ask once you have a plan: what-ifs, rival dates, partner briefs, the creative kit, the campaign, the watch, your figures, a rescue, results and a refresh.',
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
            text: 'On the plan’s Campaign tab, set up its calendar as a dated checklist. Edit it, tick it off, and set up a two-angle test for any action. Turn on Watch and Oraqul alerts the team when a date slips. A revised plan gets its own set and the old one stays as you left it.',
          },
          {
            label: 'Put the dates in your calendar.',
            text: 'Download the plan’s dates as a calendar file from Export, or make a calendar link on the Campaign tab for your calendar app to subscribe to. It carries titles and dates only. Anyone with the link can read it, so share it with your team, and make a new one to turn the old one off.',
          },
          {
            label: 'Watch the launch.',
            text: 'Turn on Watch on the plan. Oraqul re-checks it on a schedule for a rival release near your date (with the page and the day it was read), a campaign date that has slipped and a plan that has grown old, and emails the owners and editors. It never changes your plan and never asks Qloo by itself. A check that needs Qloo, or a rescue, runs only when an owner or editor approves it.',
          },
          {
            label: 'Add your figures.',
            text: 'On the Watch tab, paste a line a day (“2027-03-01, 120”, with a city and a channel if you have them) or upload a CSV. Oraqul says whether you are ahead, on pace or behind the plan’s pace, with the gap and how many entries it rests on, or that it is too early to tell. The pace is a convention you can edit, and the read is direction, not a forecast.',
          },
          {
            label: 'Rescue a launch that is behind.',
            text: '“Rescue this launch”, or Start a rescue on the Watch tab when the figures are behind. It names the territory and channel to put the next seven days into, from your plan’s own findings and your figures. It makes no new Qloo call and saves a short plan beside yours.',
          },
          {
            label: 'Find sponsors and funding.',
            text: 'On the Funding and sponsors tab, say your stage and nationality, then “Find funding and sponsors”. You get the brands Qloo ranks for each of your territories with a recent sponsorship a page confirms, and funds, grants and programmes that are open now. Every fund shows its source and the day it was read, and an amount or date a page does not state shows as unknown. “Published criteria met” is not a promise: confirm on the source page before you apply. Oraqul never quotes a fee or the terms of a loan.',
          },
          {
            label: 'Pitch and apply from your own app.',
            text: 'Write the draft from the plan, approve it, and it opens in your own email or WhatsApp with the text ready. Oraqul sends nothing: you send it, then confirm “Yes, I sent it” and the item moves along your pipeline, with a follow up date in your calendar. If your team’s defaults say an owner must approve, only an owner can.',
          },
          {
            label: 'Use Oraqul from another agent.',
            text: 'In Settings, then Connections, make a personal token and connect Claude, ChatGPT or any MCP client to Oraqul’s hosted server. The agent can start a plan, an audit or a fix, follow the run and read the finished summary and watch events. It cannot send anything, change your defaults or make a token, and a run counts against your monthly runs.',
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
            text: 'No financial advice, no arranging or brokering financing, and no quote of a sponsorship fee or loan terms. It never says a team qualifies: it says which published criteria appear met and which are unknown.',
          },
          {
            text: 'No ads, trailers, images or video. It writes the script, shot list, key art brief, caption pack and hook options, and a person makes the final creative.',
          },
          {
            text: 'No sending or posting. Anything drafted is for you to review and send, and Oraqul posts nothing for you. A watch emails your team about the plan, and nothing else leaves Oraqul on its own.',
          },
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
