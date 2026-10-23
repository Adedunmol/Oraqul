import { Icon } from '@oraqul/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { band, h2Class, wrap } from '../section';

// Answers say only what the product does today (spec §3 to §5, §9.5).
const faqs: { q: string; a: ReactNode; home?: ReactNode }[] = [
  {
    home: 'An agent. You say what you are working on in plain words, and it decides what to look up, tests what it finds, checks its own draft and comes back with a plan. You keep talking to it in the same chat.',
    q: 'Is Oraqul an AI agent or a dashboard?',
    a: 'An agent. You tell it what you are working on in plain words. It plans its own steps, looks things up in the taste data, tests what it finds, reviews its own draft against your request, and comes back with a plan. You keep talking to it in the same chat.',
  },
  {
    home: 'From Qloo, which holds audience taste data across film and TV, music, books, podcasts, games, brands and places. Every claim links to the data behind it.',
    q: 'Where does the data come from?',
    a: 'From Qloo, cultural data on what real audiences like across film and TV, music, books, podcasts, games, brands and places. Every claim in an answer links to the data behind it.',
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
    q: 'What is a receipt?',
    a: 'The record behind one claim: what was asked, what came back, and the rule that turned it into a verdict. In a plan, a claim about taste carries a small number that opens its receipt, and the Evidence tab lists them all.',
  },
  {
    q: 'Does it ask about my budget?',
    a: 'Once, if your brief does not say. It asks for a band (micro, independent, mid-size or major), or you can skip it and it plans for an independent release and says so. The band decides which partners and moves it may propose: a flagship brand is not offered to a budget that cannot carry it.',
  },
  {
    q: 'Can I set a target?',
    a: 'Yes. Every plan is judged on one signal for its category, such as advance screenings and presales for a film or wishlists for a game. Give your own number, or where Oraqul has a sourced benchmark it shows it. A target is a goal you set, never a prediction.',
  },
  {
    q: 'What is a plan for each market?',
    a: 'One plan for each place you open, called a territory: the home market first, then the diaspora cities, such as Lagos, then London, Houston and Atlanta. Each has its own call (okay, risky or avoid), lead channels and partners. Your own cities are never dropped.',
  },
  {
    q: 'Can it check my release date against rivals?',
    a: 'Yes, with the rival releases and dates you give it, for example “Rivals: Harbor Lights on 2027-03-12”. The data has no release calendar, so the dates are yours; Oraqul measures how much of your audience each rival shares.',
  },
  {
    q: 'Does it make trailers or ads?',
    a: 'No. It writes the scripts, shot lists, key art briefs, caption packs and hook options a team needs to make them, for each territory and channel. A person makes the final creative.',
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
    a: 'Film and series releases, music releases and tours, book launches, podcast seasons and game launches. Each category has its own checks, its own calendar worked back from your date, and its own signal.',
  },
  {
    q: 'Does it work outside the US and UK?',
    a: 'Yes. It tests titles from any market and ranks cities like Mexico City, Seoul and São Paulo beside London, Chicago and Toronto. Where the data for a place is thin, it says so plainly and lowers its confidence.',
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
    <section aria-labelledby="faq-title" className={`bg-bg ${band}`}>
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
