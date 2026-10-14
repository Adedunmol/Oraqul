import type { ReactNode } from 'react';

/** Display title and the primary action on the right. design-system §6 */
export function PageHead({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(26px,3vw,34px)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance">
          {title}
        </h1>
        {description ? <p className="max-w-[60ch] text-muted">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
