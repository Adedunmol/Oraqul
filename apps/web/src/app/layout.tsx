import type { Metadata } from 'next';
import { Geist, Geist_Mono, Mona_Sans } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

// Mona Sans is the public brand face: a neo-grotesk with a width axis, set a little wide at large
// sizes so headlines have presence without looking like every other product page. The signed-in
// product uses Geist for both headings and reading text, so dense work does not switch typefaces as
// the reader moves through a plan.
const monaSans = Mona_Sans({
  variable: '--font-mona-sans',
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
});

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

// Applies the saved theme and sidebar choices before first paint, so neither flashes. The keys
// match theme-toggle.tsx and sidebar-toggle.tsx.
const themeScript =
  "try{var d=document.documentElement,t=localStorage.getItem('oraqul-theme');if(t==='light'||t==='dark')d.dataset.theme=t;if(localStorage.getItem('oraqul-sidebar')==='collapsed')d.dataset.sidebar='collapsed'}catch(e){}";

export const metadata: Metadata = {
  title: 'Oraqul',
  description:
    'A culturally grounded launch agent for media and entertainment. It builds a launch plan, audits the one you have, fixes weak decisions and revises the plan from your results, grounded in Qloo taste data.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${monaSans.variable} ${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string, no user input
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </body>
    </html>
  );
}
