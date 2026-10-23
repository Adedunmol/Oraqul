import type { Metadata } from 'next';
import { Closing } from '../../_marketing/closing';
import { FormulaCard, MethodBody } from '../../_marketing/method/method';
import { PageHero } from '../../_marketing/page-hero';

export const metadata: Metadata = {
  title: 'Method · Oraqul',
  description:
    'How Oraqul computes verdicts, lift, fit, rival overlap and confidence from audience taste data. Code sets every number; the model writes the words.',
};

export default function Method() {
  return (
    <>
      <PageHero
        tone="dark"
        title="How Oraqul decides."
        lead="For anyone who has to judge the numbers. Every score is worked out by code from the taste data it returned, by the rules on this page, and every rule is written into the receipt that uses it."
      >
        <FormulaCard />
      </PageHero>
      <MethodBody />
      <Closing />
    </>
  );
}
