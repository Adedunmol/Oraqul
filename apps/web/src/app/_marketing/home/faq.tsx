import { Icon } from '@oraqul/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { band, h2Class, wrap } from '../section';

// Answers say only what the product does today (spec §3 to §5, §9.5).
const faqs: { q: string; a: ReactNode }[] = [
  {
    q: 'Is Oraqul an AI agent or a dashboard?',
    a: 'An agent. You tell it what you are working on in plain words. It plans its own steps, calls tools that query Qloo, tests what it finds, has a second model call try to break its answer, and comes back with a plan. You keep talking to it in the same chat.',
  },
  {
    q: 'Where does the data come from?',
    a: 'From Qloo, cultural data on what real audiences like across film and TV, music, books, podcasts, games, brands and places. Every claim in an answer links to the Qloo call behind it.',
  },
  {
    q: 'Can the AI make up a number?',
    a: (
      <>
        No. Scores, verdicts and confidence are computed by code from the values Qloo returned in
        the same run. The model only writes the words around them, and an answer that names a title
        or place outside that data is rejected and rerun.{' '}
        <Link href="/method">Read the method</Link>.
      </>
    ),
  },
  {
    q: 'What is a receipt?',
    a: 'The record behind one claim: what was sent to Qloo, what came back, and the rule that turned it into a verdict. Open it from any line with View receipt.',
  },
  {
    q: 'Does it forecast sales or streams?',
    a: 'It measures audience taste: who likes what, and where. Sales, streams and ticket numbers are yours to bring, and when you add them Oraqul compares them with what the plan expected.',
  },
  {
    q: 'What if my title is not in Qloo yet?',
    a: 'That is expected. Qloo holds taste, not unreleased titles, so Oraqul does not look for yours. It describes the launch by what surrounds it: comparable titles, the people involved, themes and the audience you want, and asks Qloo about those. It can also check taste across domains, such as whether the fans of top selling musicians also read books like yours. A clear match is evidence for the plan. A weak one is only read as a warning when it is compared with other titles in the same call.',
  },
  {
    q: 'What kinds of launch does it cover?',
    a: 'Film and series releases, albums and tours, book launches, podcast seasons and game launches. Each category has its own questions, views and what if tests.',
  },
  {
    q: 'Does it work outside the US and UK?',
    a: 'Yes. It tests titles from any market and ranks cities like Mexico City, Seoul and São Paulo beside London, Chicago and Toronto. Where the data for a place is thin, it says so plainly and lowers its confidence.',
  },
  {
    q: 'What happens to my data?',
    a: (
      <>
        Only public names, places and age bands go to Qloo. Uploaded results are kept as totals,
        with personal columns dropped. Your work is visible only to your team.{' '}
        <Link href="/trust">What data goes where</Link>.
      </>
    ),
  },
  {
    q: 'Can it contact partners for me?',
    a: 'It drafts partner briefs and next steps for you to send. It never sends anything itself.',
  },
];

/** Questions as native disclosures, so they work with a keyboard and without script. */
export function Faq() {
  return (
    <section aria-labelledby="faq-title" className={`bg-bg ${band}`}>
      <div className={`${wrap} grid gap-12 min-[1000px]:grid-cols-[0.8fr_1.2fr]`}>
        <div className="flex flex-col gap-5 min-[1000px]:sticky min-[1000px]:top-28 min-[1000px]:self-start">
          <h2 id="faq-title" className={h2Class}>
            Questions people ask.
          </h2>
          <p className="max-w-[40ch] text-[17px] leading-[1.6] text-ink/75">
            Anything else, see how it works or open the examples and click a receipt.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] font-medium">
            <Link href="/how-it-works" className="text-accent hover:underline">
              How it works
            </Link>
            <Link href="/examples" className="text-accent hover:underline">
              See the examples
            </Link>
          </div>
        </div>
        <ul className="flex flex-col gap-2">
          {faqs.map((f) => (
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
                  {f.a}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
