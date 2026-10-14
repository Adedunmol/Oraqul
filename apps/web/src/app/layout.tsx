import type { Metadata } from 'next';
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

// Titles and the bottom line: a sans with enough character to lead a page. Geist carries the rest.
const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
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
  description: 'A verifiable AI agent that builds, checks and repairs launch strategy.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${geist.variable} ${geistMono.variable} h-full antialiased`}
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
