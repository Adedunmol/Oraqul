import { Icon } from '@oraqul/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { band, fitBand, h2Class, wrap } from '../section';

// Answers say only what the product does today (spec §3 to §5, §9.5).
const faqs: { q: string; a: ReactNode; home?: ReactNode }[] = [
  {
    home: 'An agent. You say what you are working on in plain words. It runs the same tested checks on every plan, looks up more when the evidence is thin, checks its own draft and comes back with a plan. You keep talking to it in the same chat.',
    q: 'Is Oraqul an AI agent or a dashboard?',
    a: 'An agent. You tell it what you are working on in plain words. It runs the same tested checks on every plan, looks things up in the taste data and decides which extra lookups it needs when the evidence is thin, reviews its own draft against your request, and comes back with a plan. You keep talking to it in the same chat.',
  },
  {
    home: 'Taste and place come from Qloo, which holds audience taste data across film and TV, music, books, podcasts, games, brands and places. Dated market facts such as rivals and release windows come from web research, each linked to its page. Code computes every number.',
    q: 'Where does the data come from?',
    a: 'Three places. Taste and place are measured in Qloo, cultural data on what real audiences like across film and TV, music, books, podcasts, games, brands and places. Dated market facts, such as rivals and release windows, are sourced from web research and link to their page. Every number and verdict is computed by code. The model writes the plan, and launch craft is labelled as such.',
  },
  {
    home: 'No. Code works out every score and verdict from the data. The AI only writes the words around them, and an answer that names something outside the data is rejected and rerun.',
    q: 'Can the AI make up a number?',
    a: (
      <>
        No. Scores, verdicts and confidence are computed by code from the data returned in the same
        run. The model only writes the words around them, and an answer that names a title or place
        outside that data is rejected and rerun. <Link href="/method">Read the method</Link>.
      </>
    ),
  },
  {
    home: 'Add your results as totals by city or age band, with the period and where they came from. Oraqul sets them against the plan and writes a revised plan beside the old one. It says what happened, never why: a cause is a hypothesis to test.',
    q: 'What happens after the launch?',
    a: 'Add your results as totals by city or age band, with the period they cover and where they came from. Oraqul sets each place against where the plan put it, in code, and a fix writes a revised plan around who showed up. The old plan is kept beside the new one. Your figures are your own evidence, kept apart from the taste data: they show what happened, and Oraqul never states why as fact.',
  },
  {
    q: 'Can it tell me what has changed since my plan was made?',
    a: 'Yes, when you ask. It asks Qloo and the web again with your plan’s own brief and sets the answers beside what the plan saved: findings that moved, pages that now say something different, each with the day it was read, and the lines of your plan that rest on them. Something is called changed only when the plan had an earlier finding or fact to compare. Your plan is untouched until you ask for a revision.',
  },
  {
    q: 'Does it find markets I had not thought of?',
    a: 'Yes, and it keeps them beside your plan. Nearby cities that rank above your weakest, and the strongest area of each of your cities, appear under Worth a look with why, what the data does not show, a first test and what to measure. Nothing joins your plan until you add it: ask “What if we add Chicago?”. If the evidence is thin, it says so rather than filling a list.',
  },
  {
    q: 'Can it help me run the campaign?',
    a: 'It turns the plan’s content calendar into actions in the project, each with a guide from the creative kit that you adapt. Edit an action, tick it off, and set up a two-angle test for any of them. Add your own figures and Oraqul compares them, saying inconclusive when they are thin or close. A revised plan gets its own set. Oraqul watches the dated actions and the launch and alerts the team when something slips, but it posts nothing and sends nothing itself.',
  },
  {
    q: 'How does it use the places I name?',
    a: 'Every city is read, not just listed. Oraqul asks Qloo what the audience for your comparable titles looks like there, ranks all your cities in one call so their scores compare, and gives each a verdict and its own plan. For film and music plans it also reads neighbourhoods near the strongest cells, as leads to confirm on the ground. Nearby cities that rank above your weakest appear under Worth a look. A place with too little data to rank is marked as such, with lower confidence, and your own cities are never dropped.',
  },
  {
    q: 'What is a receipt?',
    a: 'The record behind one claim: what was asked, what came back, and the rule that turned it into a verdict. In a plan, a claim about taste carries a small number that opens its receipt, and the Evidence tab lists them all.',
  },
  {
    q: 'Does it ask about my budget?',
    a: 'Once, if your brief does not say. It asks for a band (micro, independent, mid-size or major), or you can skip it and it plans for an independent release and says so. The band, and who is launching if your brief says (a solo author, a small team, an established company or a major studio), decide which partners and moves it may propose. A flagship brand is not part of the plan for a solo launch, a small team or a micro budget. It is listed apart as a goal for later, and never written into the plan’s moves unless you named it.',
  },
  {
    q: 'Can I set a target?',
    a: 'Yes. Every plan is judged on one signal for its category, such as advance screenings and presales for a film or wishlists for a game. Give your own number, or where Oraqul has a benchmark of its own it shows it, marked as a target to aim for. A target is a goal you set, never a prediction.',
  },
  {
    q: 'What is a plan for each market?',
    a: 'One plan for each place you open, called a territory: the home market first, such as New York, then each other city you name, such as Los Angeles, Atlanta and London. Each has its own call (okay, risky or avoid), lead channels, and the partners Qloo ranked there. WhatsApp is a sharing layer and never a lead channel. Your own cities are never dropped.',
  },
  {
    q: 'Can it check my release date against rivals?',
    a: 'Yes, with the rival releases and dates you give it, for example “Rivals: Harbor Lights on 2027-03-12”. The data has no release calendar, so the dates are yours; Oraqul measures how much of your audience each rival shares.',
  },
  {
    q: 'Does it make trailers or ads?',
    a: 'No. It writes the scripts, shot lists, key art briefs, caption packs and hook options a team needs to make them, for one territory and channel, or for every territory at once when you ask for all of them. A person makes the final creative.',
  },
  {
    home: 'No. It shows who likes what and where, and gives a direction, not a forecast. When you add your own results, it compares them with what the plan expected.',
    q: 'Does it forecast sales or streams?',
    a: 'No. It measures audience taste, who likes what and where, and gives a direction, not a forecast. Sales, streams and ticket numbers are yours to bring, and when you add them Oraqul compares them with what the plan expected.',
  },
  {
    q: 'What if my title is not in Qloo yet?',
    a: 'That is expected. The data holds taste, not unreleased titles, so Oraqul does not look for yours. It describes the launch by what surrounds it: comparable titles, the people involved, themes and the audience you want, and asks the data about those. A clear match is evidence for the plan. A weak one is only read as a warning when it is compared with other titles in the same call.',
  },
  {
    q: 'What kinds of launch does it cover?',
    a: 'Film and series releases, music releases and tours, book launches, podcast seasons, game launches and single live shows or short runs. Each category has its own checks, its own calendar worked back from your date, and its own signal.',
  },
  {
    q: 'Does it work outside the US and UK?',
    a: 'Yes. It tests titles from any market and ranks cities like Mexico City, Seoul and São Paulo beside New York, Chicago and London. Where the data for a place is thin, it says so plainly and lowers its confidence.',
  },
  {
    home: 'Only public names, places and age bands leave Oraqul. Uploaded results are kept as totals, and your work is visible only to your team.',
    q: 'What happens to my data?',
    a: (
      <>
        Only public names, places and age bands go to Qloo, the taste data provider. Uploaded
        results are kept as totals, with personal columns dropped. Your work is visible only to your
        team. <Link href="/trust">What data goes where</Link>.
      </>
    ),
  },
  {
    q: 'Can it contact partners for me?',
    a: 'It drafts partner briefs and next steps for you to send. It never sends anything itself.',
  },
];

/**
 * Questions as native disclosures, so they work with a keyboard and without script. The home page
 * shows the short answers to the few that matter first; every question keeps its full answer here.
 */
export function Faq({ short = false }: { short?: boolean }) {
  const items = short ? faqs.filter((f) => f.home) : faqs;
  return (
    <section aria-labelledby="faq-title" className={`bg-bg ${short ? fitBand : band}`}>
      <div className={`${wrap} grid gap-12 min-[1000px]:grid-cols-[0.8fr_1.2fr]`}>
        <div className="flex flex-col gap-5 min-[1000px]:sticky min-[1000px]:top-28 min-[1000px]:self-start">
          <h2 id="faq-title" className={h2Class}>
            Questions people ask.
          </h2>
          <p className="max-w-[40ch] text-[17px] leading-[1.6] text-ink/75">
            {short
              ? 'The short answers. The rest are on the how it works page.'
              : 'Anything else, open the examples and click a receipt.'}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] font-medium">
            {short ? (
              <Link href="/how-it-works" className="text-accent hover:underline">
                How it works
              </Link>
            ) : null}
            <Link href="/examples" className="text-accent hover:underline">
              See the examples
            </Link>
          </div>
        </div>
        <ul className="flex flex-col gap-2">
          {items.map((f) => (
            <li key={f.q}>
              <details className="group rounded-2xl bg-canvas open:bg-card open:shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[17px] font-medium focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <Icon
                    name="plus"
                    className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                  />
                </summary>
                <div className="max-w-[62ch] px-5 pb-5 text-[15.5px] leading-[1.65] text-ink/80 [&_a]:font-medium [&_a]:text-accent [&_a]:underline">
                  {short ? f.home : f.a}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
