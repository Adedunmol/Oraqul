import type { Metadata } from 'next';
import { Idea, Markets, Problem } from '../../_marketing/about/about';
import { Closing } from '../../_marketing/closing';
import { PageHero } from '../../_marketing/page-hero';

export const metadata: Metadata = {
  title: 'About · Oraqul',
  description:
    'Why Oraqul exists: launch plans deserve to be checkable. A verifiable AI agent for media and entertainment, built for launches in every market.',
};

export default function About() {
  return (
    <>
      <PageHero
        title="Launch plans should be checkable."
        lead="Oraqul is a verifiable AI agent for launch planning in media and entertainment. It exists so the people who make a plan, and the people who sign it off, can see why every line is there."
      />
      <Problem />
      <Idea />
      <Markets />
      <Closing />
    </>
  );
}
