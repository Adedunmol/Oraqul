'use client';

import { Input } from '@oraqul/ui';
import { type ComponentProps, useState } from 'react';

/**
 * An Input that can show what was typed. It lives in web, not `packages/ui`: `ui` ships as one
 * bundle and a hook there breaks the server components that import VerdictPill.
 */
export function PasswordInput(props: Omit<ComponentProps<typeof Input>, 'type' | 'trailing'>) {
  const [shown, setShown] = useState(false);
  return (
    <Input
      {...props}
      type={shown ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setShown((value) => !value)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      }
    />
  );
}
