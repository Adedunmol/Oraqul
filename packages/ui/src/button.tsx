import type { ComponentProps } from 'react';
import { Icon, type IconName } from './icon';

type Variant = 'default' | 'primary' | 'ghost' | 'danger' | 'dangerSolid';
type Size = 'default' | 'small';

const variants: Record<Variant, string> = {
  // The secondary look: a tinted indigo fill, so it reads as a button and never as a disabled one.
  default: 'border border-transparent bg-secondary text-secondary-ink hover:bg-secondary-hover',
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

// A button with an icon and a word needs less side padding; one with only an icon is a square.
const withIcon: Record<Size, string> = {
  default: 'h-10 pr-5 pl-4 text-sm',
  small: 'h-9 pr-4 pl-3 text-[13px]',
};
const iconOnlySizes: Record<Size, string> = { default: 'size-10', small: 'size-9' };

/** Class names for anything that must look like a button, such as a link to another origin. */
export function buttonClassName(
  variant: Variant = 'default',
  size: Size = 'default',
  shape: 'text' | 'icon' | 'iconOnly' = 'text',
): string {
  const sizing =
    shape === 'iconOnly' ? iconOnlySizes[size] : shape === 'icon' ? withIcon[size] : sizes[size];
  return `inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[opacity,transform,background-color,border-color] duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45 disabled:pointer-events-none motion-reduce:transition-none ${variants[variant]} ${sizing}`;
}

/**
 * `icon` adds a glyph before the label. A button with an icon and no children is icon only: it
 * needs an `aria-label`, which also becomes its tooltip unless `tip` says otherwise.
 */
export function Button({
  variant,
  size,
  type = 'button',
  className,
  icon,
  tip,
  children,
  ...props
}: ComponentProps<'button'> & {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  tip?: string;
}) {
  const iconOnly = icon !== undefined && children == null;
  const shape = iconOnly ? 'iconOnly' : icon ? 'icon' : 'text';
  return (
    <button
      type={type}
      data-tip={tip ?? (iconOnly ? props['aria-label'] : undefined)}
      className={`${buttonClassName(variant, size, shape)} ${className ?? ''}`}
      {...props}
    >
      {icon ? <Icon name={icon} className="size-4" /> : null}
      {children}
    </button>
  );
}
