import type { Metadata } from 'next';
import { Closing } from '../_marketing/closing';
import { AgentRun } from '../_marketing/home/agent-run';
import { CategoriesSection } from '../_marketing/home/categories-section';
import { Faq } from '../_marketing/home/faq';
import { Hero } from '../_marketing/home/hero';
import { Craft, Territories } from '../_marketing/home/launch-rules';
import { Lifecycle } from '../_marketing/home/lifecycle';
import { Lift } from '../_marketing/home/lift';
import { Markup } from '../_marketing/home/markup';
import { Problems } from '../_marketing/home/problems';
import { Prompts } from '../_marketing/home/prompts';
import { TasteMap } from '../_marketing/home/taste-map';

export const metadata: Metadata = {
  title: 'Oraqul: launch plans grounded in what audiences actually like',
  description:
    'Oraqul plans, checks and fixes launches for film and series, music, books, podcasts and games. One plan per territory, worked back from your date, with every claim about taste tested against Qloo data and a receipt for each.',
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
      <Territories />
      <Markup />
      <Craft />
      <Lift />
      <CategoriesSection />
      <Faq />
      <Closing />
    </>
  );
}
