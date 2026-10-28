import { outputTabKeySchema, type Verdict } from '@oraqul/schema';
import { VerdictPill } from '@oraqul/ui';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Closing } from '../../_marketing/closing';
import { findCase } from '../../_marketing/examples/cases';
import { ExamplesView } from '../../_marketing/examples/examples-view';
import { PageHero } from '../../_marketing/page-hero';
import { wrap } from '../../_marketing/section';

export const metadata: Metadata = {
  title: 'Examples · Oraqul',
  description:
    'Three full Oraqul plans: a film planned for four markets, an album rollout worked back from its date, and a podcast season sized to a micro budget. Invented data, every receipt open.',
};

const legend: { verdict: Verdict; text: string }[] = [
  { verdict: 'holds', text: 'Qloo data supports the belief.' },
  { verdict: 'weak', text: 'Some support, not enough to lean on.' },
  { verdict: 'breaks', text: 'The data points the other way.' },
  { verdict: 'cant', text: 'No signal to test. Nothing is guessed.' },
];

// The case and tab come from the address, which is request data, so only this part waits for it
// and the rest of the page prerenders. Both are checked here, at the boundary.
async function ExamplesFromAddress({
  searchParams,
}: {
  searchParams: PageProps<'/examples'>['searchParams'];
}) {
  const query = await searchParams;
  const tab = outputTabKeySchema.safeParse(query.tab);
  return (
    <ExamplesView
      initialCase={findCase(query.case)}
      initialTab={tab.success ? tab.data : undefined}
    />
  );
}

export default function Examples({ searchParams }: PageProps<'/examples'>) {
  return (
    <>
      <PageHero
        tone="dark"
        title="Three launches, every receipt open."
        lead="The real output screen, read only, for three made-up launches: a film, an album and a podcast. Pick one, click through its markets, calls and evidence, and open any receipt."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {legend.map((l) => (
            <li
              key={l.verdict}
              className="flex flex-col items-start gap-2.5 rounded-2xl bg-card p-4"
            >
              <VerdictPill verdict={l.verdict} />
              <p className="text-[15.5px] leading-[1.65]">{l.text}</p>
            </li>
          ))}
        </ul>
      </PageHero>
      <section aria-label="Examples" className="py-[clamp(40px,6vw,80px)]">
        <div className={wrap}>
          <Suspense fallback={<p className="text-[15px] text-muted">Loading the examples…</p>}>
            <ExamplesFromAddress searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
      <Closing />
    </>
  );
}
