import { GUIDE_INDEX } from '@oraqul/packs';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Closing } from '../../../_marketing/closing';
import { GuidePageBody } from '../../../_marketing/guide/guide';
import { PageHero } from '../../../_marketing/page-hero';

export function generateStaticParams() {
  return GUIDE_INDEX.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = GUIDE_INDEX.find((p) => p.slug === slug);
  return page ? { title: `${page.title} · Guide · Oraqul`, description: page.summary } : {};
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = GUIDE_INDEX.find((p) => p.slug === slug);
  if (!page) notFound();
  return (
    <>
      <PageHero wash title={page.title} lead={page.summary} />
      <GuidePageBody slug={slug} />
      <Closing />
    </>
  );
}
