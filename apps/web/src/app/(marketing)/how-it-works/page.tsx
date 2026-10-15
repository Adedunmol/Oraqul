import type { Metadata } from 'next';
import { Closing } from '../../_marketing/closing';
import {
  Asks,
  BottomLine,
  Describe,
  KeepGoing,
  Tests,
  TraceCard,
} from '../../_marketing/how/steps';
import { PageHero } from '../../_marketing/page-hero';

export const metadata: Metadata = {
  title: 'How it works · Oraqul',
  description:
    'From one message to a launch plan you can defend: Oraqul reads what you are working on, tests every belief against Qloo taste data and ends with the bottom line and receipts.',
};

export default function HowItWorks() {
  return (
    <>
      <PageHero
        title="From one message to a plan you can defend."
        lead="Oraqul is an AI agent that shows its working. It reads what you are working on, tests every belief against Qloo’s cultural taste data, and ends with what to do first, every claim with a receipt."
      >
        <TraceCard />
      </PageHero>
      <Describe />
      <Asks />
      <Tests />
      <BottomLine />
      <KeepGoing />
      <Closing />
    </>
  );
}
