import type { Metadata } from 'next';
import { PageHero } from '../../_marketing/page-hero';
import { TermsBody } from '../../_marketing/terms/terms';

export const metadata: Metadata = {
  title: 'Terms · Oraqul',
  description: 'The terms for using Oraqul, in plain words.',
};

export default function Terms() {
  return (
    <>
      <PageHero
        wash
        title="Terms, in plain words."
        lead="What you can expect from Oraqul and what it expects from you."
      />
      <TermsBody />
    </>
  );
}
