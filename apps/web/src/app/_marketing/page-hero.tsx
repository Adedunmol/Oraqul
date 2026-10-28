import type { ReactNode } from 'react';
import { h1Class, wrap } from './section';

/**
 * The opening of an inner marketing page: a large title and one lead, on the dot grid, with an
 * optional picture beside it. `tone` picks the band; every page varies what sits beside the title.
 */
export function PageHero({
  title,
  lead,
  tone = 'light',
  wash,
  children,
}: {
  title: ReactNode;
  lead: ReactNode;
  tone?: 'light' | 'dark';
  /** A soft indigo fade down from the top, for a light hero with nothing else beside the title. */
  wash?: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="page-title"
      className={`relative overflow-x-clip ${tone === 'dark' ? 'scheme-dark mk-glow bg-bg' : ''}`}
    >
      {wash ? <div aria-hidden="true" className="mk-fade absolute inset-0" /> : null}
      <div aria-hidden="true" className="mk-dots absolute inset-0" />
      <div
        className={`${wrap} relative grid gap-12 pt-[clamp(56px,9vw,128px)] pb-[clamp(56px,8vw,112px)] ${children ? 'min-[1000px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] min-[1000px]:items-center' : ''}`}
      >
        <div className="flex flex-col items-start gap-6">
          <h1 id="page-title" className={`mk-word max-w-[15ch] ${h1Class}`}>
            {title}
          </h1>
          <p
            className="mk-word max-w-[50ch] text-[clamp(17px,1.5vw,20px)] leading-[1.65] text-ink/80"
            style={{ animationDelay: '120ms' }}
          >
            {lead}
          </p>
        </div>
        {children ? (
          <div className="mk-word min-w-0" style={{ animationDelay: '240ms' }}>
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}
