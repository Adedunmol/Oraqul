import type { Metadata } from 'next';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  weight: ['500', '600'],
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

// Applies a saved light or dark choice before first paint. The key matches theme-toggle.tsx.
const themeScript =
  "try{var t=localStorage.getItem('oraqul-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}";

export const metadata: Metadata = {
  title: 'Oraqul',
  description: 'A verifiable AI agent that builds, checks and repairs launch strategy.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${geist.variable} ${geistMono.variable} h-full antialiased`}
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
