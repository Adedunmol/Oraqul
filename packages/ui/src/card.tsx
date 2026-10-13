import type { HTMLAttributes } from 'react';

/** A bordered surface with no shadow. design-system §7.8 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-2xl border border-line bg-surface ${className ?? ''}`} {...props} />
  );
}
