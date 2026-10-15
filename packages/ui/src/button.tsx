import type { ButtonHTMLAttributes } from 'react';

type Variant = 'default' | 'primary' | 'ghost' | 'danger' | 'dangerSolid';
type Size = 'default' | 'small';

const variants: Record<Variant, string> = {
  default: 'border border-transparent bg-button text-ink hover:bg-button-hover',
  primary:
    'border border-primary bg-primary text-primary-ink shadow-primary hover:border-primary-hover hover:bg-primary-hover',
  ghost: 'border border-transparent bg-transparent text-ink hover:bg-surface2',
  // Red marks an action that removes something. Soft to offer it, solid to confirm it.
  danger: 'border border-transparent bg-breaks-bg text-breaks hover:bg-breaks/20',
  dangerSolid: 'border border-breaks bg-breaks text-surface hover:opacity-90',
};

const sizes: Record<Size, string> = {
  default: 'h-10 px-5 text-sm',
  small: 'h-9 px-4 text-[13px]',
};

/** Class names for anything that must look like a button, such as a link to another origin. */
export function buttonClassName(variant: Variant = 'default', size: Size = 'default'): string {
  return `inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[opacity,transform,background-color,border-color] duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45 disabled:pointer-events-none motion-reduce:transition-none ${variants[variant]} ${sizes[size]}`;
}

export function Button({
  variant,
  size,
  type = 'button',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={`${buttonClassName(variant, size)} ${className ?? ''}`}
      {...props}
    />
  );
}
