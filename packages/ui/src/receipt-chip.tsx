import type { ButtonHTMLAttributes } from 'react';

/** Opens the receipt drawer for one line. Every line that makes a claim carries one. design-system §7.7 */
export function ReceiptChip({
  className,
  type = 'button',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-button px-2 py-0.5 text-xs text-ink transition-colors duration-150 hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${className ?? ''}`}
      {...props}
    >
      View receipt
    </button>
  );
}
