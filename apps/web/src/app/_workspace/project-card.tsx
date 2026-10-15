import type { Category } from '@oraqul/schema';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** The grid every list of these cards sits in, so Projects and Overview line up. */
export const cardGridClass =
  'grid grid-cols-1 gap-4 min-[900px]:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]';

/**
 * The one card for a project or work on one: tinted with its category colour, a title that
 * covers the card as its link, one muted line, then a footer. Used by the project lists and by
 * Overview, so both read as one family. design-system §7.12. The link covers the card, so a pin
 * can sit on top of it without a button inside a link.
 */
export function CardShell({
  category,
  href,
  title,
  meta,
  pin,
  footerStart,
  footerEnd,
}: {
  category: Category;
  href: string;
  title: string;
  /** One line. Name the category in it wherever the list mixes categories. */
  meta: string;
  pin?: ReactNode;
  footerStart: ReactNode;
  /** Shown only on hover or focus of the card, and always on touch screens. */
  footerEnd?: ReactNode;
}) {
  return (
    <div
      data-cat={category}
      className="cat-card group relative flex h-full flex-col rounded-2xl transition-colors duration-150 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent motion-reduce:transition-none"
    >
      <div className="flex items-start gap-3.5 p-5 pb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="font-display truncate text-[15.5px] font-semibold tracking-[-0.01em]">
            <Link
              href={href}
              className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
            >
              {title}
            </Link>
          </h3>
          <p className="truncate text-[13px] leading-[1.45] text-muted">{meta}</p>
        </div>
        {pin}
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 px-5 pt-1 pb-5 text-[12.5px] text-muted">
        {footerStart}
        {footerEnd ? (
          // Opacity, not display, so it stays readable to screen readers and shows on focus.
          <span className="shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100">
            {footerEnd}
          </span>
        ) : null}
      </div>
    </div>
  );
}
