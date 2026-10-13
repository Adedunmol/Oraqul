const icons = {
  chevron: <path d="M7 9.5l5 5 5-5" />,
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
