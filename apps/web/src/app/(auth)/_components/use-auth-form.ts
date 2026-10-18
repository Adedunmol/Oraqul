'use client';

import { nextPathSchema } from '@oraqul/schema';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ApiError, apiUrl } from '@/lib/api/http';
import { overviewPath } from '@/lib/routes';

const DEFAULT_NEXT = overviewPath;

export type AuthStep = 'signin' | 'verify' | 'reset';

function messageFor(error: unknown, step: AuthStep): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Too many tries. Ask for a new code in a few minutes.';
    if (step === 'signin' && error.status === 401) return 'Wrong email or password.';
    if ((step === 'verify' || step === 'reset') && error.status === 400) {
      return 'That code is invalid or has expired.';
    }
  }
  return 'Something went wrong. Try again.';
}

/** State every auth form shares: where to go after, the email carried between pages, and one pending and error pair. */
export function useAuthForm(step: AuthStep) {
  const router = useRouter();
  const params = useSearchParams();
  const parsedNext = nextPathSchema.safeParse(params.get('next'));
  const next = parsedNext.success ? parsedNext.data : DEFAULT_NEXT;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(
    params.get('error') === 'google'
      ? 'Google sign in did not work. Try again or use another way.'
      : '',
  );

  // A link to another auth page that keeps the page to return to after sign in.
  function href(path: string, extra?: { email?: string }): string {
    const query = new URLSearchParams();
    if (extra?.email) query.set('email', extra.email);
    if (parsedNext.success) query.set('next', parsedNext.data);
    const text = query.toString();
    return text ? `${path}?${text}` : path;
  }

  const googleHref = (() => {
    const url = apiUrl('/auth/google');
    url.searchParams.set('next', next);
    return url.toString();
  })();

  async function run(action: () => Promise<unknown>, onDone: () => void) {
    setPending(true);
    setError('');
    try {
      await action();
      onDone();
    } catch (caught) {
      setError(messageFor(caught, step));
    } finally {
      setPending(false);
    }
  }

  function enter() {
    router.push(next);
    router.refresh();
  }

  return {
    router,
    emailParam: params.get('email') ?? '',
    href,
    googleHref,
    pending,
    error,
    run,
    enter,
  };
}
