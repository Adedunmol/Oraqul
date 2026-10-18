import type { Metadata } from 'next';
import { Idea, Markets, Problem } from '../../_marketing/about/about';
import { Closing } from '../../_marketing/closing';
import { PageHero } from '../../_marketing/page-hero';

export const metadata: Metadata = {
  title: 'About · Oraqul',
  description:
    'Why Oraqul exists: launch plans should rest on what audiences actually like. A culturally grounded launch agent for media and entertainment, built for launches in every market.',
};

export default function About() {
  return (
    <>
      <PageHero
        title="Launch plans should be checkable."
        lead="Oraqul is a culturally grounded launch agent for media and entertainment. It exists so a launch plan rests on what the audience actually likes, and the people who sign it off can see which lines are measured and which are practice."
      />
      <Problem />
      <Idea />
      <Markets />
      <Closing />
    </>
  );
}
