import type { Metadata } from 'next';
import { CategorySections, CategoryTiles } from '../../_marketing/categories/category-sections';
import { Closing } from '../../_marketing/closing';
import { PageHero } from '../../_marketing/page-hero';

export const metadata: Metadata = {
  title: 'Categories · Oraqul',
  description:
    'Film and series, music, books, podcasts and games: what Oraqul checks in each, what else it handles, and what your team brings.',
};

export default function Categories() {
  return (
    <>
      <PageHero
        wash
        title="Every kind of launch, tested its own way."
        lead="For each category: what Oraqul checks, what else it handles when a title is new or niche, and what your team brings."
      >
        <CategoryTiles />
      </PageHero>
      <CategorySections />
      <Closing />
    </>
  );
}
