import type { SelectHTMLAttributes } from 'react';

/**
 * The label is required so the field is announced. `hideLabel` keeps it for screen readers only,
 * for a select that sits in a row where the row already says what it is for.
 */
export function Select({
  label,
  hideLabel,
  id,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; id: string; hideLabel?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-[13px] font-medium text-ink'}>
        {label}
      </label>
      <select
        id={id}
        className={`w-full rounded-[10px] border border-line bg-surface px-3 py-[9px] text-sm text-ink focus:border-accent focus:outline-2 focus:outline-accent/45 disabled:opacity-45 ${className ?? ''}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
