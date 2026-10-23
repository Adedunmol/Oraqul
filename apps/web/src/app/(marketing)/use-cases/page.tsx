import type { Metadata } from 'next';
import { Closing } from '../../_marketing/closing';
import { PageHero } from '../../_marketing/page-hero';
import {
  CaseIndex,
  CheckCase,
  FixCase,
  PlanCase,
  WhatIfCase,
} from '../../_marketing/use-cases/cases';

export const metadata: Metadata = {
  title: 'Use cases · Oraqul',
  description:
    'Make a plan, check the plan you have, fix one that missed, then keep going with rival dates, what ifs and the creative kit. Each is grounded in real audience taste data.',
};

export default function UseCases() {
  return (
    <>
      <PageHero
        title="Four ways teams use Oraqul."
        lead="Before a launch, while you weigh it, and after it is out. Start from whatever you have, and every claim about taste is checked against real data."
      >
        <CaseIndex />
      </PageHero>
      <PlanCase />
      <CheckCase />
      <FixCase />
      <WhatIfCase />
      <Closing />
    </>
  );
}
