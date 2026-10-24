import type { Metadata } from 'next';
import { Closing } from '../_marketing/closing';
import { AgentRun } from '../_marketing/home/agent-run';
import { CategoriesSection } from '../_marketing/home/categories-section';
import { Faq } from '../_marketing/home/faq';
import { Hero } from '../_marketing/home/hero';
import { Jobs } from '../_marketing/home/jobs';
import { ProductPreview } from '../_marketing/home/product-preview';
import { TasteMap } from '../_marketing/home/taste-map';

export const metadata: Metadata = {
  title: 'Oraqul: launch plans grounded in what audiences actually like',
  description:
    'Oraqul is an AI agent that plans, checks and fixes launches for film and series, music, books, podcasts, games and live shows, with every claim about your audience backed by real taste data.',
};

export default function Home() {
  return (
    <>
      <Hero />
      <ProductPreview />
      <Jobs />
      <AgentRun />
      <TasteMap />
      <CategoriesSection />
      <Faq short />
      <Closing />
    </>
  );
}
