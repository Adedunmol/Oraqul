import type { Metadata } from 'next';
import { Closing } from '../_marketing/closing';
import { AgentRun } from '../_marketing/home/agent-run';
import { CategoriesSection } from '../_marketing/home/categories-section';
import { Difference } from '../_marketing/home/difference';
import { Faq } from '../_marketing/home/faq';
import { Hero } from '../_marketing/home/hero';
import { Jobs } from '../_marketing/home/jobs';
import { Regions } from '../_marketing/home/regions';
import { TasteMap } from '../_marketing/home/taste-map';

export const metadata: Metadata = {
  title: 'Oraqul: launch plans grounded in Qloo taste data',
  description:
    'Oraqul is an AI agent that builds, audits and fixes launch plans for film and series, music, books, podcasts, games and live shows. Audience taste is measured in Qloo, market facts are sourced, every number is computed by code and every claim opens its data.',
};

export default function Home() {
  return (
    <>
      <Hero />
      <Difference />
      <Jobs />
      <AgentRun />
      <TasteMap />
      <Regions />
      <CategoriesSection />
      <Faq short />
      <Closing />
    </>
  );
}
