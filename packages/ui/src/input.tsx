import type { InputHTMLAttributes, ReactNode } from 'react';

/**
 * The label is required so every field is announced; pass `error` to show a message under it.
 * `trailing` sits inside the right edge of the field, for a control that acts on the value.
 */
export function Input({
  label,
  error,
  trailing,
  id,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  error?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <div className="relative flex">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-lg border border-line bg-surface py-[9px] pl-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-accent/45 ${trailing ? 'pr-16' : 'pr-3'} ${className ?? ''}`}
          {...props}
        />
        {trailing ? (
          <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-breaks">
          {error}
        </p>
      ) : null}
    </div>
  );
}
