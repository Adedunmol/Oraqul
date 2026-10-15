import type { Metadata } from 'next';
import { Closing } from '../_marketing/closing';
import { AgentRun } from '../_marketing/home/agent-run';
import { CategoriesSection } from '../_marketing/home/categories-section';
import { Faq } from '../_marketing/home/faq';
import { Hero } from '../_marketing/home/hero';
import { Lifecycle } from '../_marketing/home/lifecycle';
import { Lift } from '../_marketing/home/lift';
import { Markup } from '../_marketing/home/markup';
import { Problems } from '../_marketing/home/problems';
import { Prompts } from '../_marketing/home/prompts';
import { TasteMap } from '../_marketing/home/taste-map';

export const metadata: Metadata = {
  title: 'Oraqul: a verifiable AI agent for launch planning in media and entertainment',
  description:
    'Oraqul plans, checks and fixes launches: film and series releases, albums and tours, books, podcasts and games. Every claim is tested against Qloo cultural taste data and comes with a receipt.',
};

export default function Home() {
  return (
    <>
      <Hero />
      <Prompts />
      <Problems />
      <AgentRun />
      <TasteMap />
      <Lifecycle />
      <Markup />
      <Lift />
      <CategoriesSection />
      <Faq />
      <Closing />
    </>
  );
}
