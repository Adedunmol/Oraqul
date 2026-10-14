import type { HTMLAttributes } from 'react';

/** A filled surface with no border and no shadow. design-system §7.8 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl bg-card ${className ?? ''}`} {...props} />;
}
