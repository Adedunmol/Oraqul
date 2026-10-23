import type { Metadata } from 'next';
import { Closing } from '../../_marketing/closing';
import { GuideBody } from '../../_marketing/guide/guide';
import { PageHero } from '../../_marketing/page-hero';

export const metadata: Metadata = {
  title: 'Guide · Oraqul',
  description:
    'How to get the best plan out of Oraqul: what to put in a brief, which details matter most, how to read a plan, and a brief builder.',
};

export default function Guide() {
  return (
    <>
      <PageHero
        wash
        title="Get the best plan out of Oraqul."
        lead="Write one good message. This guide shows which details change the plan most, builds the brief for you, and explains how to read what comes back."
      />
      <GuideBody />
      <Closing />
    </>
  );
}
