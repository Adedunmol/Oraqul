import type { Metadata } from 'next';
import { CategorySections, CategoryTiles } from '../../_marketing/categories/category-sections';
import { Closing } from '../../_marketing/closing';
import { PageHero } from '../../_marketing/page-hero';

export const metadata: Metadata = {
  title: 'Categories · Oraqul',
  description:
    'Film and series, music, books, podcasts and games: what Oraqul tests against Qloo taste data in each, where the data is thin, and what your team brings.',
};

export default function Categories() {
  return (
    <>
      <PageHero
        title="Every kind of launch, tested its own way."
        lead="For each category: what Oraqul checks against Qloo taste data, where the data is thin and confidence is lower, and what your team brings because it is not taste data."
      >
        <CategoryTiles />
      </PageHero>
      <CategorySections />
      <Closing />
    </>
  );
}
