import type { Metadata } from 'next';
import { Closing } from '../_marketing/closing';
import { AgentRun } from '../_marketing/home/agent-run';
import { CategoriesSection } from '../_marketing/home/categories-section';
import { Faq } from '../_marketing/home/faq';
import { Hero } from '../_marketing/home/hero';
import { Jobs } from '../_marketing/home/jobs';
import { Regions } from '../_marketing/home/regions';
import { TasteMap } from '../_marketing/home/taste-map';

export const metadata: Metadata = {
  title: 'Oraqul: build, audit and fix launch plans grounded in what audiences like',
  description:
    'Oraqul is an AI agent that builds, audits and fixes launch plans, then revises them from your results, for film and series, music, books, podcasts, games and live shows. Taste is measured, market facts are sourced and every number is computed by code.',
};

export default function Home() {
  return (
    <>
      <Hero />
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
