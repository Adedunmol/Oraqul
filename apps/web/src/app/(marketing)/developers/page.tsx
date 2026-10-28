import type { Metadata } from 'next';
import { Closing } from '../../_marketing/closing';
import { DevelopersBody } from '../../_marketing/developers/developers';
import { PageHero } from '../../_marketing/page-hero';

export const metadata: Metadata = {
  title: 'Developers · Oraqul',
  description:
    'Oraqul as a hosted MCP server for plans, and a local server for the Qloo tools. Connect Claude, ChatGPT or any MCP client with a personal token.',
};

export default function Developers() {
  return (
    <>
      <PageHero
        tone="dark"
        title="Oraqul, as tools."
        lead="Other agents can plan a launch through Oraqul and read the result. Or run the Qloo tools locally, each returning its data and a receipt for every Qloo call it made."
      />
      <DevelopersBody />
      <Closing />
    </>
  );
}
