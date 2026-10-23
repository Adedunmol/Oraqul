import type { Metadata } from 'next';
import { Closing } from '../../_marketing/closing';
import { DevelopersBody } from '../../_marketing/developers/developers';
import { PageHero } from '../../_marketing/page-hero';

export const metadata: Metadata = {
  title: 'Developers · Oraqul',
  description:
    'The Oraqul engine as an MCP server: the same tools the agents use, each returning its data and the receipts behind it.',
};

export default function Developers() {
  return (
    <>
      <PageHero
        tone="dark"
        title="The engine, as tools."
        lead="Other agents can call the same tools Oraqul uses. Each call returns its data and a receipt for every Qloo call it made."
      />
      <DevelopersBody />
      <Closing />
    </>
  );
}
