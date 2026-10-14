import type { HTMLAttributes } from 'react';

/** A solid surface with a hairline edge and a small lift (set on `bg-card`). design-system §7.8 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl bg-card ${className ?? ''}`} {...props} />;
}
