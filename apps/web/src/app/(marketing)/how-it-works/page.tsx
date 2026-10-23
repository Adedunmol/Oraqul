import type { Metadata } from 'next';
import { Closing } from '../../_marketing/closing';
import { Faq } from '../../_marketing/home/faq';
import { Craft, Territories } from '../../_marketing/how/launch-rules';
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
    'From one message to a launch plan you can defend: Oraqul reads what you are working on, checks each assumption against real audience taste data, and ends with what to do first and a receipt for every claim.',
};

export default function HowItWorks() {
  return (
    <>
      <PageHero
        title="From one message to a plan you can defend."
        lead="Oraqul is an AI agent that shows its working. It reads what you are working on, checks each assumption against real audience taste data, and ends with what to do first. Every claim comes with a receipt."
      >
        <TraceCard />
      </PageHero>
      <Describe />
      <Asks />
      <Tests />
      <BottomLine />
      <Territories />
      <Craft />
      <KeepGoing />
      <Faq />
      <Closing />
    </>
  );
}
