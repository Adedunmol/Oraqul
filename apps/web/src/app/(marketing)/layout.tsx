import type { ReactNode } from 'react';
import '../_marketing/marketing.css';
import { SiteFooter } from '../_marketing/site-footer';
import { SiteHeader } from '../_marketing/site-header';

// One designed rhythm of light and dark sections, whatever the visitor's theme: the page is pinned
// light and dark bands opt in with .scheme-dark. design-system §6 "Marketing pages".
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="scheme-light bg-canvas">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
