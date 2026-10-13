'use client';

import { nextPathSchema } from '@oraqul/schema';
import { Button, buttonClassName, Input } from '@oraqul/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { confirmReset, login, requestCode, requestReset, signup, verifyCode } from '@/lib/api/auth';
import { ApiError, apiUrl } from '@/lib/api/http';
import { PasswordInput } from './password-input';

type View = 'signin' | 'signup' | 'forgot' | 'codeEmail' | 'verify' | 'reset';

const DEFAULT_NEXT = '/projects';

function messageFor(error: unknown, view: View): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Too many tries. Ask for a new code in a few minutes.';
    if (view === 'signin' && error.status === 401) return 'Wrong email or password.';
    if ((view === 'verify' || view === 'reset') && error.status === 400) {
      return 'That code is invalid or has expired.';
    }
  }
  return 'Something went wrong. Try again.';
}

export function SignInPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const parsedNext = nextPathSchema.safeParse(params.get('next'));
  const next = parsedNext.success ? parsedNext.data : DEFAULT_NEXT;

  const [view, setView] = useState<View>('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(
    params.get('error') === 'google'
      ? 'Google sign in did not work. Try again or use another way.'
      : '',
  );
  const [notice, setNotice] = useState('');

  const googleHref = (() => {
    const url = apiUrl('/auth/google');
    url.searchParams.set('next', next);
    return url.toString();
  })();

  function go(nextView: View) {
    setView(nextView);
    setError('');
    setNotice('');
    setCode('');
  }

  async function run(action: () => Promise<void>, onDone: () => void) {
    setPending(true);
    setError('');
    try {
      await action();
      onDone();
    } catch (caught) {
      setError(messageFor(caught, view));
    } finally {
      setPending(false);
    }
  }

  function enter() {
    router.push(next);
    router.refresh();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    switch (view) {
      case 'signin':
        return run(() => login(email, password).then(() => undefined), enter);
      case 'signup':
        return run(
          () => signup({ name, email, password }),
          () => {
            go('verify');
            setNotice(`We sent a 6 digit code to ${email}.`);
          },
        );
      case 'codeEmail':
        return run(
          () => requestCode(email),
          () => {
            go('verify');
            setNotice(`We sent a 6 digit code to ${email}.`);
          },
        );
      case 'verify':
        return run(() => verifyCode(email, code).then(() => undefined), enter);
      case 'forgot':
        return run(
          () => requestReset(email),
          () => {
            go('reset');
            setNotice(`If ${email} has an account, we sent a 6 digit code to it.`);
          },
        );
      case 'reset':
        return run(() => confirmReset({ email, code, password }).then(() => undefined), enter);
    }
  }

  const showEmail = view !== 'verify' && view !== 'reset';
  const heading: Record<View, string> = {
    signin: 'Sign in',
    signup: 'Create your account',
    forgot: 'Reset your password',
    codeEmail: 'Sign in with an email code',
    verify: 'Enter your code',
    reset: 'Choose a new password',
  };
  const submitLabel: Record<View, string> = {
    signin: 'Sign in',
    signup: 'Create account',
    forgot: 'Send code',
    codeEmail: 'Send code',
    verify: 'Continue',
    reset: 'Save password and sign in',
  };

  return (
    <section
      aria-labelledby="sign-in-heading"
      className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6"
    >
      <h2 id="sign-in-heading" className="font-display text-xl font-medium">
        {heading[view]}
      </h2>

      <a href={googleHref} className={`${buttonClassName('default')} w-full`}>
        Continue with Google
      </a>

      <p className="flex items-center gap-3 text-[13px] text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </p>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {notice ? <p className="text-[13px] text-muted">{notice}</p> : null}
        {view === 'signup' ? (
          <Input
            id="name"
            label="Your name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        ) : null}
        {showEmail ? (
          <Input
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        ) : null}
        {view === 'signin' || view === 'signup' || view === 'reset' ? (
          <PasswordInput
            id="password"
            label={view === 'reset' ? 'New password' : 'Password'}
            autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
            minLength={view === 'signin' ? undefined : 8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        ) : null}
        {view === 'verify' || view === 'reset' ? (
          <Input
            id="code"
            label="6 digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
          />
        ) : null}

        {error ? (
          <p role="alert" className="text-[13px] text-breaks">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'One moment…' : submitLabel[view]}
        </Button>
      </form>

      <nav
        aria-label="Other ways to sign in"
        className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]"
      >
        {view !== 'signin' ? (
          <LinkButton onClick={() => go('signin')}>Sign in with a password</LinkButton>
        ) : null}
        {view !== 'codeEmail' && view !== 'verify' ? (
          <LinkButton onClick={() => go('codeEmail')}>Email me a code</LinkButton>
        ) : null}
        {view === 'signin' ? (
          <LinkButton onClick={() => go('forgot')}>Forgot password?</LinkButton>
        ) : null}
        {view !== 'signup' ? (
          <LinkButton onClick={() => go('signup')}>Create an account</LinkButton>
        ) : null}
      </nav>
    </section>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md py-1 text-muted underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  );
}
