import type { ButtonHTMLAttributes } from 'react';

type Variant = 'default' | 'primary' | 'ghost';
type Size = 'default' | 'small';

const variants: Record<Variant, string> = {
  default: 'border border-line bg-surface text-ink shadow-sm',
  primary: 'border border-transparent bg-ink text-bg hover:opacity-90',
  ghost: 'border border-transparent bg-transparent text-ink hover:bg-surface2',
};

const sizes: Record<Size, string> = {
  default: 'px-[14px] py-[7px] text-sm',
  small: 'px-[11px] py-1 text-[13px]',
};

/** Class names for anything that must look like a button, such as a link to another origin. */
export function buttonClassName(variant: Variant = 'default', size: Size = 'default'): string {
  return `inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-[opacity,transform,background-color] duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45 disabled:pointer-events-none motion-reduce:transition-none ${variants[variant]} ${sizes[size]}`;
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
