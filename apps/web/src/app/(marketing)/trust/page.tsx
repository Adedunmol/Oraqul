import type { Metadata } from 'next';
import { Closing } from '../../_marketing/closing';
import { PageHero } from '../../_marketing/page-hero';
import { Flow, Ledger, Promises, Roles, SignIn } from '../../_marketing/trust/trust';

export const metadata: Metadata = {
  title: 'Trust · Oraqul',
  description:
    'What data goes where in Oraqul: only public names, places and age bands go to Qloo, uploaded results are kept as totals, and roles decide who sees what.',
};

export default function Trust() {
  return (
    <>
      <PageHero
        title="What data goes where."
        lead="For reviewers, legal and anyone who has to sign off. What leaves your team, what Oraqul keeps, and who on your team can see it."
      >
        <Promises />
      </PageHero>
      <Flow />
      <Ledger />
      <Roles />
      <SignIn />
      <Closing />
    </>
  );
}
