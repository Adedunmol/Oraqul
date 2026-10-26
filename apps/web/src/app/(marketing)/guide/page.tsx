import type { Metadata } from 'next';
import { Closing } from '../../_marketing/closing';
import { GuideHub } from '../../_marketing/guide/guide';
import { PageHero } from '../../_marketing/page-hero';

export const metadata: Metadata = {
  title: 'Guide · Oraqul',
  description:
    'How to get the best plan out of Oraqul: what to put in a brief, how to read a plan, what to do after it, and an assistant that answers your questions.',
};

export default function Guide() {
  return (
    <>
      <PageHero
        wash
        title="Get the best plan out of Oraqul."
        lead="Write one good message. The guide shows which details change the plan most, builds the brief for you, explains what comes back, and answers your questions."
      />
      <GuideHub />
      <Closing />
    </>
  );
}
