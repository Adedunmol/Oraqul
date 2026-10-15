import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';

const base =
  'inline-flex items-center gap-1.5 rounded-md bg-surface2 px-2.5 py-1 text-[12.5px] text-ink';

/** A quiet label. design-system §7.4 */
export function Chip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`${base} ${className ?? ''}`} {...props} />;
}

/** A filter or quick action chip. `selected` switches to the soft accent fill. design-system §7.4 */
export function ChipButton({
  selected,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={`${base} border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45 motion-reduce:transition-none ${selected ? 'border-accent/40 bg-accent-soft! font-semibold text-accent' : 'border-transparent bg-secondary! text-secondary-ink! hover:bg-secondary-hover!'} ${className ?? ''}`}
      {...props}
    />
  );
}
