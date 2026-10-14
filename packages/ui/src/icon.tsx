const icons = {
  chevron: <path d="M7 9.5l5 5 5-5" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6.5 6.5l11 11m0-11-11 11" />,
  plus: <path d="M12 5v14M5 12h14" />,
  pin: (
    <>
      <path d="M9 4h6l-1 6 3.5 3.5h-11L10 10z" />
      <path d="M12 13.5V20" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  attach: (
    <path d="M19 11.5l-7.1 7.1a4.6 4.6 0 0 1-6.5-6.5l7.4-7.4a3 3 0 0 1 4.3 4.3l-7.4 7.4a1.5 1.5 0 0 1-2.1-2.1l6.7-6.7" />
  ),
  sidebar: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M9.5 4.5v15" />
    </>
  ),
  theme: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
    </>
  ),
  signout: (
    <>
      <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </>
  ),
  overview: (
    <>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
      <path d="M9.5 20.5V14h5v6.5" />
    </>
  ),
  projects: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.2c2.8-.3 4.5 1.5 4.5 4.3" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3 9.5h4M17 9.5h4M3 14.5h4M17 14.5h4" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  books: (
    <>
      <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h10" />
    </>
  ),
  podcasts: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </>
  ),
  games: (
    <>
      <rect x="2.5" y="7" width="19" height="11" rx="5" />
      <path d="M7 10.5v4M5 12.5h4M16 11h.01M18.5 13.5h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
};

export type IconName = keyof typeof icons;

/** Stroke icons on a 24 grid. Decorative: the label next to it carries the meaning. */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`size-[18px] shrink-0 ${className ?? ''}`}
    >
      {icons[name]}
    </svg>
  );
}
