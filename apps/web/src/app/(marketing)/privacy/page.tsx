import type { Metadata } from 'next';
import { PageHero } from '../../_marketing/page-hero';
import { PrivacyBody } from '../../_marketing/privacy/privacy';

export const metadata: Metadata = {
  title: 'Privacy · Oraqul',
  description:
    'What Oraqul collects, why, who else handles it, and how long it is kept, in plain words.',
};

export default function Privacy() {
  return (
    <>
      <PageHero
        wash
        title="Privacy, in plain words."
        lead="Last updated 14 October 2026. Oraqul is a hackathon project, so this is short and specific to what the product actually does."
      />
      <PrivacyBody />
    </>
  );
}
